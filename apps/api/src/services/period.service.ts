import {
  submissionPeriods,
  submissions,
  eq,
  and,
  sql,
  type DrizzleDb,
} from '@colophony/db';
import { desc, ilike, count } from 'drizzle-orm';
import type {
  CreateSubmissionPeriodInput,
  UpdateSubmissionPeriodInput,
  ListSubmissionPeriodsInput,
  PeriodStatus,
  SubmissionPeriod,
} from '@colophony/types';
import { AuditActions, AuditResources } from '@colophony/types';
import type { ServiceContext } from './types.js';
import { assertEditorOrAdmin } from './errors.js';

// ---------------------------------------------------------------------------
// Error classes
// ---------------------------------------------------------------------------

export class PeriodNotFoundError extends Error {
  constructor(id: string) {
    super(`Submission period "${id}" not found`);
    this.name = 'PeriodNotFoundError';
  }
}

export class PeriodHasSubmissionsError extends Error {
  constructor() {
    super('Cannot delete: period has submissions');
    this.name = 'PeriodHasSubmissionsError';
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Coerce Drizzle row (fee is `string | null` from `numeric(10,2)`) to match
 * the Zod `SubmissionPeriod` type where `fee` is `number | null`.
 */
function mapRow(row: Record<string, unknown>): SubmissionPeriod {
  return {
    ...row,
    fee: row.fee != null ? Number(row.fee) : null,
  } as SubmissionPeriod;
}

/**
 * Build SQL conditions for a computed period status filter.
 * UPCOMING = opensAt > NOW(), OPEN = opensAt <= NOW() AND closesAt >= NOW(),
 * CLOSED = closesAt < NOW()
 */
function statusCondition(status: PeriodStatus) {
  switch (status) {
    case 'UPCOMING':
      return sql`${submissionPeriods.opensAt} > NOW()`;
    case 'OPEN':
      return and(
        sql`${submissionPeriods.opensAt} <= NOW()`,
        sql`${submissionPeriods.closesAt} >= NOW()`,
      );
    case 'CLOSED':
      return sql`${submissionPeriods.closesAt} < NOW()`;
  }
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export const periodService = {
  // -------------------------------------------------------------------------
  // List / Get
  // -------------------------------------------------------------------------

  async list(tx: DrizzleDb, input: ListSubmissionPeriodsInput) {
    const { status, search, page, limit } = input;
    const offset = (page - 1) * limit;

    const conditions = [];
    if (status) conditions.push(statusCondition(status));
    if (search) conditions.push(ilike(submissionPeriods.name, `%${search}%`));

    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const [items, countResult] = await Promise.all([
      tx
        .select()
        .from(submissionPeriods)
        .where(where)
        .orderBy(desc(submissionPeriods.opensAt))
        .limit(limit)
        .offset(offset),
      tx.select({ count: count() }).from(submissionPeriods).where(where),
    ]);

    const total = countResult[0]?.count ?? 0;
    return {
      items: items.map(mapRow),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  },

  async getById(tx: DrizzleDb, id: string): Promise<SubmissionPeriod | null> {
    const [row] = await tx
      .select()
      .from(submissionPeriods)
      .where(eq(submissionPeriods.id, id))
      .limit(1);

    return row ? mapRow(row) : null;
  },

  // -------------------------------------------------------------------------
  // Create / Update / Delete
  // -------------------------------------------------------------------------

  async create(
    tx: DrizzleDb,
    input: CreateSubmissionPeriodInput,
    orgId: string,
  ): Promise<SubmissionPeriod> {
    const [row] = await tx
      .insert(submissionPeriods)
      .values({
        organizationId: orgId,
        name: input.name,
        description: input.description ?? null,
        opensAt: input.opensAt,
        closesAt: input.closesAt,
        fee: input.fee != null ? String(input.fee) : null,
        maxSubmissions: input.maxSubmissions ?? null,
        formDefinitionId: input.formDefinitionId ?? null,
      })
      .returning();

    return mapRow(row);
  },

  async createWithAudit(
    ctx: ServiceContext,
    input: CreateSubmissionPeriodInput,
  ): Promise<SubmissionPeriod> {
    assertEditorOrAdmin(ctx.actor.role);
    const period = await periodService.create(ctx.tx, input, ctx.actor.orgId);
    await ctx.audit({
      action: AuditActions.PERIOD_CREATED,
      resource: AuditResources.PERIOD,
      resourceId: period.id,
      newValue: { name: input.name },
    });
    return period;
  },

  async update(
    tx: DrizzleDb,
    id: string,
    input: UpdateSubmissionPeriodInput,
  ): Promise<SubmissionPeriod | null> {
    const values: Record<string, unknown> = { updatedAt: new Date() };
    if (input.name !== undefined) values.name = input.name;
    if (input.description !== undefined)
      values.description = input.description ?? null;
    if (input.opensAt !== undefined) values.opensAt = input.opensAt;
    if (input.closesAt !== undefined) values.closesAt = input.closesAt;
    if (input.fee !== undefined)
      values.fee = input.fee != null ? String(input.fee) : null;
    if (input.maxSubmissions !== undefined)
      values.maxSubmissions = input.maxSubmissions ?? null;
    if (input.formDefinitionId !== undefined)
      values.formDefinitionId = input.formDefinitionId ?? null;

    const [row] = await tx
      .update(submissionPeriods)
      .set(values)
      .where(eq(submissionPeriods.id, id))
      .returning();

    return row ? mapRow(row) : null;
  },

  async updateWithAudit(
    ctx: ServiceContext,
    id: string,
    input: UpdateSubmissionPeriodInput,
  ): Promise<SubmissionPeriod> {
    assertEditorOrAdmin(ctx.actor.role);
    const updated = await periodService.update(ctx.tx, id, input);
    if (!updated) throw new PeriodNotFoundError(id);
    await ctx.audit({
      action: AuditActions.PERIOD_UPDATED,
      resource: AuditResources.PERIOD,
      resourceId: id,
      newValue: input,
    });
    return updated;
  },

  async delete(tx: DrizzleDb, id: string): Promise<SubmissionPeriod | null> {
    // Check for submissions referencing this period
    const [subCount] = await tx
      .select({ count: count() })
      .from(submissions)
      .where(eq(submissions.submissionPeriodId, id));

    if ((subCount?.count ?? 0) > 0) throw new PeriodHasSubmissionsError();

    const [row] = await tx
      .delete(submissionPeriods)
      .where(eq(submissionPeriods.id, id))
      .returning();

    return row ? mapRow(row) : null;
  },

  async deleteWithAudit(
    ctx: ServiceContext,
    id: string,
  ): Promise<{ success: true }> {
    assertEditorOrAdmin(ctx.actor.role);
    const deleted = await periodService.delete(ctx.tx, id);
    if (!deleted) throw new PeriodNotFoundError(id);
    await ctx.audit({
      action: AuditActions.PERIOD_DELETED,
      resource: AuditResources.PERIOD,
      resourceId: id,
      oldValue: { name: deleted.name },
    });
    return { success: true };
  },
};
