import { portfolioEntries, eq, and, desc, type DrizzleDb } from '@colophony/db';
import { count } from 'drizzle-orm';
import { AuditActions, AuditResources } from '@colophony/types';
import type {
  ListPortfolioEntriesInput,
  CreatePortfolioEntryInput,
  PortfolioEntryType,
} from '@colophony/types';
import type { UserServiceContext } from './types.js';
import { ForbiddenError } from './errors.js';

// ---------------------------------------------------------------------------
// Error classes
// ---------------------------------------------------------------------------

export class PortfolioEntryNotFoundError extends Error {
  constructor(id: string) {
    super(`Portfolio entry "${id}" not found`);
    this.name = 'PortfolioEntryNotFoundError';
  }
}

export class PortfolioEntryTypeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PortfolioEntryTypeError';
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function assertExternalType(type: PortfolioEntryType): void {
  if (type !== 'external') {
    throw new PortfolioEntryTypeError(
      'Only external portfolio entries can be modified via the API',
    );
  }
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export const portfolioEntryService = {
  // -------------------------------------------------------------------------
  // Pure data methods
  // -------------------------------------------------------------------------

  async list(tx: DrizzleDb, userId: string, input: ListPortfolioEntriesInput) {
    const { type, page, limit } = input;
    const offset = (page - 1) * limit;

    const conditions = [eq(portfolioEntries.userId, userId)];
    if (type) {
      conditions.push(eq(portfolioEntries.type, type));
    }

    const where = and(...conditions);

    const [items, countResult] = await Promise.all([
      tx
        .select()
        .from(portfolioEntries)
        .where(where)
        .orderBy(desc(portfolioEntries.updatedAt))
        .limit(limit)
        .offset(offset),
      tx.select({ count: count() }).from(portfolioEntries).where(where),
    ]);

    const total = countResult[0]?.count ?? 0;
    return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
  },

  async getById(tx: DrizzleDb, id: string) {
    const [row] = await tx
      .select()
      .from(portfolioEntries)
      .where(eq(portfolioEntries.id, id))
      .limit(1);
    return row ?? null;
  },

  async create(
    tx: DrizzleDb,
    userId: string,
    input: CreatePortfolioEntryInput,
  ) {
    const [row] = await tx
      .insert(portfolioEntries)
      .values({
        userId,
        type: 'external',
        title: input.title,
        publicationName: input.publicationName,
        publishedAt: input.publishedAt ?? null,
        url: input.url ?? null,
        notes: input.notes ?? null,
      })
      .returning();
    return row;
  },

  async update(
    tx: DrizzleDb,
    id: string,
    data: {
      title?: string;
      publicationName?: string;
      publishedAt?: Date | null;
      url?: string | null;
      notes?: string | null;
    },
  ) {
    const values: Record<string, unknown> = { updatedAt: new Date() };
    if (data.title !== undefined) values.title = data.title;
    if (data.publicationName !== undefined)
      values.publicationName = data.publicationName;
    if (data.publishedAt !== undefined) values.publishedAt = data.publishedAt;
    if (data.url !== undefined) values.url = data.url;
    if (data.notes !== undefined) values.notes = data.notes;

    const [row] = await tx
      .update(portfolioEntries)
      .set(values)
      .where(eq(portfolioEntries.id, id))
      .returning();
    return row ?? null;
  },

  async delete(tx: DrizzleDb, id: string) {
    const [row] = await tx
      .delete(portfolioEntries)
      .where(eq(portfolioEntries.id, id))
      .returning();
    return row ?? null;
  },

  // -------------------------------------------------------------------------
  // Audit-wrapped methods
  // -------------------------------------------------------------------------

  async createWithAudit(
    ctx: UserServiceContext,
    input: CreatePortfolioEntryInput,
  ) {
    const entry = await portfolioEntryService.create(ctx.tx, ctx.userId, input);

    await ctx.audit({
      action: AuditActions.PORTFOLIO_ENTRY_CREATED,
      resource: AuditResources.PORTFOLIO_ENTRY,
      resourceId: entry.id,
      newValue: {
        title: input.title,
        publicationName: input.publicationName,
        type: 'external',
      },
    });

    return entry;
  },

  async updateWithAudit(
    ctx: UserServiceContext,
    input: {
      id: string;
      title?: string;
      publicationName?: string;
      publishedAt?: Date | null;
      url?: string | null;
      notes?: string | null;
    },
  ) {
    const existing = await portfolioEntryService.getById(ctx.tx, input.id);
    if (!existing) throw new PortfolioEntryNotFoundError(input.id);

    if (existing.userId !== ctx.userId) {
      throw new ForbiddenError('You do not own this portfolio entry');
    }

    assertExternalType(existing.type);

    const updated = await portfolioEntryService.update(ctx.tx, input.id, {
      title: input.title,
      publicationName: input.publicationName,
      publishedAt: input.publishedAt,
      url: input.url,
      notes: input.notes,
    });
    if (!updated) return existing;

    await ctx.audit({
      action: AuditActions.PORTFOLIO_ENTRY_UPDATED,
      resource: AuditResources.PORTFOLIO_ENTRY,
      resourceId: input.id,
      oldValue: {
        title: existing.title,
        publicationName: existing.publicationName,
      },
      newValue: {
        title: updated.title,
        publicationName: updated.publicationName,
      },
    });

    return updated;
  },

  async deleteWithAudit(ctx: UserServiceContext, id: string) {
    const existing = await portfolioEntryService.getById(ctx.tx, id);
    if (!existing) throw new PortfolioEntryNotFoundError(id);

    if (existing.userId !== ctx.userId) {
      throw new ForbiddenError('You do not own this portfolio entry');
    }

    assertExternalType(existing.type);

    await portfolioEntryService.delete(ctx.tx, id);

    await ctx.audit({
      action: AuditActions.PORTFOLIO_ENTRY_DELETED,
      resource: AuditResources.PORTFOLIO_ENTRY,
      resourceId: id,
      oldValue: {
        title: existing.title,
        publicationName: existing.publicationName,
        type: existing.type,
      },
    });
  },
};
