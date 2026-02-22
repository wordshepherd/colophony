import {
  manuscripts,
  manuscriptVersions,
  files,
  submissions,
  eq,
  and,
  sql,
  type DrizzleDb,
} from '@colophony/db';
import { desc, asc, ilike, count } from 'drizzle-orm';
import type {
  CreateManuscriptInput,
  UpdateManuscriptInput,
  ListManuscriptsInput,
} from '@colophony/types';
import { AuditActions, AuditResources } from '@colophony/types';
import type { UserServiceContext } from './types.js';

// ---------------------------------------------------------------------------
// Error classes
// ---------------------------------------------------------------------------

export class ManuscriptNotFoundError extends Error {
  constructor(id: string) {
    super(`Manuscript "${id}" not found`);
    this.name = 'ManuscriptNotFoundError';
  }
}

export class ManuscriptVersionNotFoundError extends Error {
  constructor(id: string) {
    super(`Manuscript version "${id}" not found`);
    this.name = 'ManuscriptVersionNotFoundError';
  }
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export const manuscriptService = {
  // -------------------------------------------------------------------------
  // Queries (user-scoped, no org needed — RLS filters by owner_id)
  // -------------------------------------------------------------------------

  async list(tx: DrizzleDb, ownerId: string, input: ListManuscriptsInput) {
    const { search, page, limit } = input;
    const offset = (page - 1) * limit;

    const conditions = [eq(manuscripts.ownerId, ownerId)];
    if (search) {
      conditions.push(ilike(manuscripts.title, `%${search}%`));
    }

    const where = and(...conditions);

    const [items, countResult] = await Promise.all([
      tx
        .select()
        .from(manuscripts)
        .where(where)
        .orderBy(desc(manuscripts.updatedAt))
        .limit(limit)
        .offset(offset),
      tx.select({ count: count() }).from(manuscripts).where(where),
    ]);

    const total = countResult[0]?.count ?? 0;
    return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
  },

  async getById(tx: DrizzleDb, id: string) {
    const [manuscript] = await tx
      .select()
      .from(manuscripts)
      .where(eq(manuscripts.id, id))
      .limit(1);
    return manuscript ?? null;
  },

  async getDetail(tx: DrizzleDb, id: string) {
    const manuscript = await manuscriptService.getById(tx, id);
    if (!manuscript) return null;

    const versions = await tx
      .select()
      .from(manuscriptVersions)
      .where(eq(manuscriptVersions.manuscriptId, id))
      .orderBy(asc(manuscriptVersions.versionNumber));

    const versionsWithFiles = await Promise.all(
      versions.map(async (version) => {
        const versionFiles = await tx
          .select()
          .from(files)
          .where(eq(files.manuscriptVersionId, version.id))
          .orderBy(asc(files.uploadedAt));
        return { ...version, files: versionFiles };
      }),
    );

    return { ...manuscript, versions: versionsWithFiles };
  },

  // -------------------------------------------------------------------------
  // Mutations
  // -------------------------------------------------------------------------

  async create(tx: DrizzleDb, ownerId: string, input: CreateManuscriptInput) {
    const [manuscript] = await tx
      .insert(manuscripts)
      .values({
        ownerId,
        title: input.title,
        description: input.description ?? null,
      })
      .returning();

    // Auto-create version 1
    await tx.insert(manuscriptVersions).values({
      manuscriptId: manuscript.id,
      versionNumber: 1,
      label: null,
    });

    return manuscript;
  },

  async update(tx: DrizzleDb, id: string, input: UpdateManuscriptInput) {
    const setData: Record<string, unknown> = { updatedAt: new Date() };
    if (input.title !== undefined) setData.title = input.title;
    if (input.description !== undefined)
      setData.description = input.description;

    const [updated] = await tx
      .update(manuscripts)
      .set(setData)
      .where(eq(manuscripts.id, id))
      .returning();

    return updated ?? null;
  },

  async delete(tx: DrizzleDb, id: string) {
    const [deleted] = await tx
      .delete(manuscripts)
      .where(eq(manuscripts.id, id))
      .returning();
    return deleted ?? null;
  },

  // -------------------------------------------------------------------------
  // Version management
  // -------------------------------------------------------------------------

  async createVersion(tx: DrizzleDb, manuscriptId: string, label?: string) {
    // Get next version number
    const [maxResult] = await tx
      .select({
        maxVersion: sql<number>`coalesce(max(${manuscriptVersions.versionNumber}), 0)`,
      })
      .from(manuscriptVersions)
      .where(eq(manuscriptVersions.manuscriptId, manuscriptId));

    const nextVersion = (maxResult?.maxVersion ?? 0) + 1;

    const [version] = await tx
      .insert(manuscriptVersions)
      .values({
        manuscriptId,
        versionNumber: nextVersion,
        label: label ?? null,
      })
      .returning();

    return version;
  },

  async listVersions(tx: DrizzleDb, manuscriptId: string) {
    return tx
      .select()
      .from(manuscriptVersions)
      .where(eq(manuscriptVersions.manuscriptId, manuscriptId))
      .orderBy(asc(manuscriptVersions.versionNumber));
  },

  async getVersionById(tx: DrizzleDb, versionId: string) {
    const [version] = await tx
      .select()
      .from(manuscriptVersions)
      .where(eq(manuscriptVersions.id, versionId))
      .limit(1);
    return version ?? null;
  },

  async getVersionDetail(tx: DrizzleDb, versionId: string) {
    const version = await manuscriptService.getVersionById(tx, versionId);
    if (!version) return null;

    const versionFiles = await tx
      .select()
      .from(files)
      .where(eq(files.manuscriptVersionId, versionId))
      .orderBy(asc(files.uploadedAt));

    return { ...version, files: versionFiles };
  },

  // -------------------------------------------------------------------------
  // Cross-org query: find submissions using this manuscript
  // -------------------------------------------------------------------------

  async getRelatedSubmissions(tx: DrizzleDb, manuscriptId: string) {
    const versions = await tx
      .select({
        id: manuscriptVersions.id,
        versionNumber: manuscriptVersions.versionNumber,
      })
      .from(manuscriptVersions)
      .where(eq(manuscriptVersions.manuscriptId, manuscriptId));

    if (versions.length === 0) return [];

    const versionIds = versions.map((v) => v.id);
    const versionMap = new Map(versions.map((v) => [v.id, v.versionNumber]));

    const relatedSubs = await tx
      .select({
        id: submissions.id,
        organizationId: submissions.organizationId,
        status: submissions.status,
        title: submissions.title,
        manuscriptVersionId: submissions.manuscriptVersionId,
        submittedAt: submissions.submittedAt,
      })
      .from(submissions)
      .where(
        sql`${submissions.manuscriptVersionId} IN (${sql.join(
          versionIds.map((id) => sql`${id}::uuid`),
          sql`, `,
        )})`,
      );

    return relatedSubs.map((sub) => ({
      id: sub.id,
      organizationId: sub.organizationId,
      status: sub.status,
      title: sub.title,
      versionNumber: versionMap.get(sub.manuscriptVersionId!) ?? 0,
      submittedAt: sub.submittedAt,
    }));
  },

  // -------------------------------------------------------------------------
  // Audited wrappers
  // -------------------------------------------------------------------------

  async createWithAudit(ctx: UserServiceContext, input: CreateManuscriptInput) {
    const manuscript = await manuscriptService.create(
      ctx.tx,
      ctx.userId,
      input,
    );
    await ctx.audit({
      action: AuditActions.MANUSCRIPT_CREATED,
      resource: AuditResources.MANUSCRIPT,
      resourceId: manuscript.id,
      newValue: { title: input.title },
    });
    return manuscript;
  },

  async updateWithAudit(
    ctx: UserServiceContext,
    id: string,
    input: UpdateManuscriptInput,
  ) {
    const existing = await manuscriptService.getById(ctx.tx, id);
    if (!existing) throw new ManuscriptNotFoundError(id);

    const updated = await manuscriptService.update(ctx.tx, id, input);
    if (!updated) throw new ManuscriptNotFoundError(id);

    await ctx.audit({
      action: AuditActions.MANUSCRIPT_UPDATED,
      resource: AuditResources.MANUSCRIPT,
      resourceId: id,
      newValue: input,
    });
    return updated;
  },

  async deleteWithAudit(ctx: UserServiceContext, id: string) {
    const existing = await manuscriptService.getById(ctx.tx, id);
    if (!existing) throw new ManuscriptNotFoundError(id);

    const deleted = await manuscriptService.delete(ctx.tx, id);
    if (!deleted) throw new ManuscriptNotFoundError(id);

    await ctx.audit({
      action: AuditActions.MANUSCRIPT_DELETED,
      resource: AuditResources.MANUSCRIPT,
      resourceId: id,
      newValue: { title: existing.title },
    });
  },

  async createVersionWithAudit(
    ctx: UserServiceContext,
    manuscriptId: string,
    label?: string,
  ) {
    const manuscript = await manuscriptService.getById(ctx.tx, manuscriptId);
    if (!manuscript) throw new ManuscriptNotFoundError(manuscriptId);

    const version = await manuscriptService.createVersion(
      ctx.tx,
      manuscriptId,
      label,
    );

    await ctx.audit({
      action: AuditActions.MANUSCRIPT_VERSION_CREATED,
      resource: AuditResources.MANUSCRIPT,
      resourceId: manuscriptId,
      newValue: {
        versionId: version.id,
        versionNumber: version.versionNumber,
        label,
      },
    });

    return version;
  },
};
