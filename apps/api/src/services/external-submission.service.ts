import { externalSubmissions, eq, and, type DrizzleDb } from '@colophony/db';
import { desc, ilike, count } from 'drizzle-orm';
import type { ListExternalSubmissionsInput, CSRStatus } from '@colophony/types';
import { AuditActions, AuditResources } from '@colophony/types';
import type { UserServiceContext } from './types.js';

// ---------------------------------------------------------------------------
// Error classes
// ---------------------------------------------------------------------------

export class ExternalSubmissionNotFoundError extends Error {
  constructor(id: string) {
    super(`External submission "${id}" not found`);
    this.name = 'ExternalSubmissionNotFoundError';
  }
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export const externalSubmissionService = {
  async list(
    tx: DrizzleDb,
    userId: string,
    input: ListExternalSubmissionsInput,
  ) {
    const { search, status, page, limit } = input;
    const offset = (page - 1) * limit;

    const conditions = [eq(externalSubmissions.userId, userId)];
    if (search) {
      const escaped = search.replace(/[\\%_]/g, '\\$&');
      conditions.push(ilike(externalSubmissions.journalName, `%${escaped}%`));
    }
    if (status) {
      conditions.push(eq(externalSubmissions.status, status));
    }

    const where = and(...conditions);

    const [items, countResult] = await Promise.all([
      tx
        .select()
        .from(externalSubmissions)
        .where(where)
        .orderBy(desc(externalSubmissions.updatedAt))
        .limit(limit)
        .offset(offset),
      tx.select({ count: count() }).from(externalSubmissions).where(where),
    ]);

    const total = countResult[0]?.count ?? 0;
    return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
  },

  async getById(tx: DrizzleDb, id: string) {
    const [row] = await tx
      .select()
      .from(externalSubmissions)
      .where(eq(externalSubmissions.id, id))
      .limit(1);
    return row ?? null;
  },

  async create(
    tx: DrizzleDb,
    userId: string,
    input: {
      journalName: string;
      journalDirectoryId?: string;
      manuscriptId?: string;
      status?: CSRStatus;
      sentAt?: string;
      respondedAt?: string;
      method?: string;
      notes?: string;
    },
  ) {
    const [row] = await tx
      .insert(externalSubmissions)
      .values({
        userId,
        journalName: input.journalName,
        journalDirectoryId: input.journalDirectoryId ?? null,
        manuscriptId: input.manuscriptId ?? null,
        status: input.status ?? 'sent',
        sentAt: input.sentAt ? new Date(input.sentAt) : null,
        respondedAt: input.respondedAt ? new Date(input.respondedAt) : null,
        method: input.method ?? null,
        notes: input.notes ?? null,
      })
      .returning();
    return row;
  },

  async update(
    tx: DrizzleDb,
    id: string,
    input: {
      journalName?: string;
      journalDirectoryId?: string;
      manuscriptId?: string;
      status?: CSRStatus;
      sentAt?: string;
      respondedAt?: string;
      method?: string;
      notes?: string;
    },
  ) {
    const setData: Record<string, unknown> = { updatedAt: new Date() };
    if (input.journalName !== undefined)
      setData.journalName = input.journalName;
    if (input.journalDirectoryId !== undefined)
      setData.journalDirectoryId = input.journalDirectoryId;
    if (input.manuscriptId !== undefined)
      setData.manuscriptId = input.manuscriptId;
    if (input.status !== undefined) setData.status = input.status;
    if (input.sentAt !== undefined)
      setData.sentAt = input.sentAt ? new Date(input.sentAt) : null;
    if (input.respondedAt !== undefined)
      setData.respondedAt = input.respondedAt
        ? new Date(input.respondedAt)
        : null;
    if (input.method !== undefined) setData.method = input.method;
    if (input.notes !== undefined) setData.notes = input.notes;

    const [updated] = await tx
      .update(externalSubmissions)
      .set(setData)
      .where(eq(externalSubmissions.id, id))
      .returning();
    return updated ?? null;
  },

  async delete(tx: DrizzleDb, id: string) {
    const [deleted] = await tx
      .delete(externalSubmissions)
      .where(eq(externalSubmissions.id, id))
      .returning();
    return deleted ?? null;
  },

  // -------------------------------------------------------------------------
  // Audited wrappers
  // -------------------------------------------------------------------------

  async createWithAudit(
    ctx: UserServiceContext,
    input: {
      journalName: string;
      journalDirectoryId?: string;
      manuscriptId?: string;
      status?: CSRStatus;
      sentAt?: string;
      respondedAt?: string;
      method?: string;
      notes?: string;
    },
  ) {
    const row = await externalSubmissionService.create(
      ctx.tx,
      ctx.userId,
      input,
    );
    await ctx.audit({
      action: AuditActions.EXTERNAL_SUBMISSION_CREATED,
      resource: AuditResources.EXTERNAL_SUBMISSION,
      resourceId: row.id,
      newValue: { journalName: input.journalName, status: input.status },
    });
    return row;
  },

  async updateWithAudit(
    ctx: UserServiceContext,
    id: string,
    input: {
      journalName?: string;
      journalDirectoryId?: string;
      manuscriptId?: string;
      status?: CSRStatus;
      sentAt?: string;
      respondedAt?: string;
      method?: string;
      notes?: string;
    },
  ) {
    const existing = await externalSubmissionService.getById(ctx.tx, id);
    if (!existing) throw new ExternalSubmissionNotFoundError(id);

    const updated = await externalSubmissionService.update(ctx.tx, id, input);
    if (!updated) throw new ExternalSubmissionNotFoundError(id);

    await ctx.audit({
      action: AuditActions.EXTERNAL_SUBMISSION_UPDATED,
      resource: AuditResources.EXTERNAL_SUBMISSION,
      resourceId: id,
      newValue: input,
    });
    return updated;
  },

  async deleteWithAudit(ctx: UserServiceContext, id: string) {
    const existing = await externalSubmissionService.getById(ctx.tx, id);
    if (!existing) throw new ExternalSubmissionNotFoundError(id);

    const deleted = await externalSubmissionService.delete(ctx.tx, id);
    if (!deleted) throw new ExternalSubmissionNotFoundError(id);

    await ctx.audit({
      action: AuditActions.EXTERNAL_SUBMISSION_DELETED,
      resource: AuditResources.EXTERNAL_SUBMISSION,
      resourceId: id,
      newValue: { journalName: existing.journalName },
    });
  },
};
