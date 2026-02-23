import { publications, eq, and, sql, type DrizzleDb } from '@colophony/db';
import { desc, ilike, count } from 'drizzle-orm';
import type {
  CreatePublicationInput,
  UpdatePublicationInput,
  ListPublicationsInput,
} from '@colophony/types';
import { AuditActions, AuditResources } from '@colophony/types';
import type { ServiceContext } from './types.js';
import { assertEditorOrAdmin } from './errors.js';

// ---------------------------------------------------------------------------
// Error classes
// ---------------------------------------------------------------------------

export class PublicationNotFoundError extends Error {
  constructor(id: string) {
    super(`Publication "${id}" not found`);
    this.name = 'PublicationNotFoundError';
  }
}

export class PublicationSlugConflictError extends Error {
  constructor(slug: string) {
    super(`Publication slug "${slug}" already exists in this organization`);
    this.name = 'PublicationSlugConflictError';
  }
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export const publicationService = {
  // -------------------------------------------------------------------------
  // List / Get
  // -------------------------------------------------------------------------

  async list(tx: DrizzleDb, input: ListPublicationsInput) {
    const { status, search, page, limit } = input;
    const offset = (page - 1) * limit;

    const conditions = [];
    if (status) conditions.push(eq(publications.status, status));
    if (search) conditions.push(ilike(publications.name, `%${search}%`));

    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const [items, countResult] = await Promise.all([
      tx
        .select()
        .from(publications)
        .where(where)
        .orderBy(desc(publications.createdAt))
        .limit(limit)
        .offset(offset),
      tx.select({ count: count() }).from(publications).where(where),
    ]);

    const total = countResult[0]?.count ?? 0;
    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  },

  async getById(tx: DrizzleDb, id: string) {
    const [row] = await tx
      .select()
      .from(publications)
      .where(eq(publications.id, id))
      .limit(1);

    return row ?? null;
  },

  async getBySlug(tx: DrizzleDb, slug: string) {
    const [row] = await tx
      .select()
      .from(publications)
      .where(sql`lower(${publications.slug}) = lower(${slug})`)
      .limit(1);

    return row ?? null;
  },

  // -------------------------------------------------------------------------
  // Create / Update / Archive
  // -------------------------------------------------------------------------

  async create(tx: DrizzleDb, input: CreatePublicationInput, orgId: string) {
    // Check slug uniqueness within org
    const existing = await publicationService.getBySlug(tx, input.slug);
    if (existing) throw new PublicationSlugConflictError(input.slug);

    const [row] = await tx
      .insert(publications)
      .values({
        organizationId: orgId,
        name: input.name,
        slug: input.slug,
        description: input.description ?? null,
        settings: input.settings ?? null,
      })
      .returning();

    return row;
  },

  async createWithAudit(ctx: ServiceContext, input: CreatePublicationInput) {
    assertEditorOrAdmin(ctx.actor.role);
    const publication = await publicationService.create(
      ctx.tx,
      input,
      ctx.actor.orgId,
    );
    await ctx.audit({
      action: AuditActions.PUBLICATION_CREATED,
      resource: AuditResources.PUBLICATION,
      resourceId: publication.id,
      newValue: { name: input.name, slug: input.slug },
    });
    return publication;
  },

  async update(tx: DrizzleDb, id: string, input: UpdatePublicationInput) {
    const values: Record<string, unknown> = { updatedAt: new Date() };
    if (input.name !== undefined) values.name = input.name;
    if (input.slug !== undefined) {
      // Check slug uniqueness if changing
      const existing = await publicationService.getBySlug(tx, input.slug);
      if (existing && existing.id !== id) {
        throw new PublicationSlugConflictError(input.slug);
      }
      values.slug = input.slug;
    }
    if (input.description !== undefined)
      values.description = input.description ?? null;
    if (input.settings !== undefined) values.settings = input.settings ?? null;

    const [row] = await tx
      .update(publications)
      .set(values)
      .where(eq(publications.id, id))
      .returning();

    return row ?? null;
  },

  async updateWithAudit(
    ctx: ServiceContext,
    id: string,
    input: UpdatePublicationInput,
  ) {
    assertEditorOrAdmin(ctx.actor.role);
    const updated = await publicationService.update(ctx.tx, id, input);
    if (!updated) throw new PublicationNotFoundError(id);
    await ctx.audit({
      action: AuditActions.PUBLICATION_UPDATED,
      resource: AuditResources.PUBLICATION,
      resourceId: id,
      newValue: input,
    });
    return updated;
  },

  async archive(tx: DrizzleDb, id: string) {
    const [row] = await tx
      .update(publications)
      .set({ status: 'ARCHIVED', updatedAt: new Date() })
      .where(eq(publications.id, id))
      .returning();

    return row ?? null;
  },

  async archiveWithAudit(ctx: ServiceContext, id: string) {
    assertEditorOrAdmin(ctx.actor.role);
    const archived = await publicationService.archive(ctx.tx, id);
    if (!archived) throw new PublicationNotFoundError(id);
    await ctx.audit({
      action: AuditActions.PUBLICATION_ARCHIVED,
      resource: AuditResources.PUBLICATION,
      resourceId: id,
      oldValue: { status: 'ACTIVE' },
      newValue: { status: 'ARCHIVED' },
    });
    return archived;
  },
};
