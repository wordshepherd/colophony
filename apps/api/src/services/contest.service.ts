import {
  contestGroups,
  contestJudges,
  contestResults,
  submissionPeriods,
  submissions,
  submissionVotes,
  paymentTransactions,
  organizationMembers,
  users,
  eq,
  and,
  type DrizzleDb,
} from '@colophony/db';
import { count, sql, desc } from 'drizzle-orm';
import {
  AuditActions,
  AuditResources,
  type CreateContestGroupInput,
  type UpdateContestGroupInput,
  type ListContestGroupsInput,
  type AssignContestJudgeInput,
  type UpdateContestJudgeInput,
  type CreateContestResultInput,
  type UpdateContestResultInput,
  type ListContestResultsInput,
  type ContestLeaderboardEntry,
} from '@colophony/types';
import type { ServiceContext } from './types.js';
import { assertEditorOrAdmin, assertBusinessOpsOrAdmin } from './errors.js';
import {
  resolveBlindMode,
  applySubmitterBlinding,
} from './blind-review.helper.js';

// ---------------------------------------------------------------------------
// Error classes
// ---------------------------------------------------------------------------

export class ContestGroupNotFoundError extends Error {
  constructor(id: string) {
    super(`Contest group "${id}" not found`);
    this.name = 'ContestGroupNotFoundError';
  }
}

export class ContestJudgeNotFoundError extends Error {
  constructor(id: string) {
    super(`Contest judge "${id}" not found`);
    this.name = 'ContestJudgeNotFoundError';
  }
}

export class ContestJudgeAlreadyAssignedError extends Error {
  constructor(userId: string, periodId: string) {
    super(
      `User "${userId}" is already assigned as judge for period "${periodId}"`,
    );
    this.name = 'ContestJudgeAlreadyAssignedError';
  }
}

export class ContestResultNotFoundError extends Error {
  constructor(id: string) {
    super(`Contest result "${id}" not found`);
    this.name = 'ContestResultNotFoundError';
  }
}

export class ContestResultAlreadyExistsError extends Error {
  constructor(submissionId: string, periodId: string) {
    super(
      `Result already exists for submission "${submissionId}" in period "${periodId}"`,
    );
    this.name = 'ContestResultAlreadyExistsError';
  }
}

export class PeriodNotContestError extends Error {
  constructor(periodId: string) {
    super(`Period "${periodId}" is not a contest`);
    this.name = 'PeriodNotContestError';
  }
}

export class WinnersAlreadyAnnouncedError extends Error {
  constructor(periodId: string) {
    super(`Winners have already been announced for period "${periodId}"`);
    this.name = 'WinnersAlreadyAnnouncedError';
  }
}

export class PrizeAlreadyDisbursedError extends Error {
  constructor(resultId: string) {
    super(`Prize has already been disbursed for result "${resultId}"`);
    this.name = 'PrizeAlreadyDisbursedError';
  }
}

export class NoPrizeAmountError extends Error {
  constructor(resultId: string) {
    super(`Result "${resultId}" has no prize amount to disburse`);
    this.name = 'NoPrizeAmountError';
  }
}

export class UserNotOrgMemberError extends Error {
  constructor(userId: string) {
    super(`User "${userId}" is not a member of this organization`);
    this.name = 'UserNotOrgMemberError';
  }
}

export class GroupHasRoundsError extends Error {
  constructor(groupId: string) {
    super(
      `Cannot delete contest group "${groupId}" — it still has linked rounds`,
    );
    this.name = 'GroupHasRoundsError';
  }
}

export class DisbursementExistsError extends Error {
  constructor(resultId: string) {
    super(
      `Cannot delete result "${resultId}" — it has an existing disbursement`,
    );
    this.name = 'DisbursementExistsError';
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function assertPeriodIsContest(
  tx: DrizzleDb,
  periodId: string,
  orgId: string,
) {
  const [period] = await tx
    .select({
      id: submissionPeriods.id,
      isContest: submissionPeriods.isContest,
    })
    .from(submissionPeriods)
    .where(
      and(
        eq(submissionPeriods.id, periodId),
        eq(submissionPeriods.organizationId, orgId),
      ),
    )
    .limit(1);

  if (!period) throw new PeriodNotContestError(periodId);
  if (!period.isContest) throw new PeriodNotContestError(periodId);
  return period;
}

async function assertOrgMember(tx: DrizzleDb, userId: string, orgId: string) {
  const [member] = await tx
    .select({ id: organizationMembers.id })
    .from(organizationMembers)
    .where(
      and(
        eq(organizationMembers.userId, userId),
        eq(organizationMembers.organizationId, orgId),
      ),
    )
    .limit(1);

  if (!member) throw new UserNotOrgMemberError(userId);
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export const contestService = {
  // =========================================================================
  // Contest Groups
  // =========================================================================

  async createGroup(
    tx: DrizzleDb,
    orgId: string,
    input: CreateContestGroupInput,
  ) {
    const [group] = await tx
      .insert(contestGroups)
      .values({
        organizationId: orgId,
        name: input.name,
        description: input.description ?? null,
        totalRoundsPlanned: input.totalRoundsPlanned ?? null,
      })
      .returning();
    return group;
  },

  async getGroupById(tx: DrizzleDb, id: string, orgId: string) {
    const [group] = await tx
      .select()
      .from(contestGroups)
      .where(
        and(eq(contestGroups.id, id), eq(contestGroups.organizationId, orgId)),
      )
      .limit(1);
    return group ?? null;
  },

  async listGroups(
    tx: DrizzleDb,
    orgId: string,
    input: ListContestGroupsInput,
  ) {
    const { page, limit } = input;
    const offset = (page - 1) * limit;
    const where = eq(contestGroups.organizationId, orgId);

    const [items, [{ total }]] = await Promise.all([
      tx
        .select()
        .from(contestGroups)
        .where(where)
        .orderBy(desc(contestGroups.createdAt))
        .limit(limit)
        .offset(offset),
      tx.select({ total: count() }).from(contestGroups).where(where),
    ]);

    return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
  },

  async updateGroup(
    tx: DrizzleDb,
    id: string,
    orgId: string,
    input: UpdateContestGroupInput,
  ) {
    const updateData: Record<string, unknown> = {};
    if (input.name !== undefined) updateData.name = input.name;
    if (input.description !== undefined)
      updateData.description = input.description;
    if (input.totalRoundsPlanned !== undefined)
      updateData.totalRoundsPlanned = input.totalRoundsPlanned;

    if (Object.keys(updateData).length === 0) return null;

    const [updated] = await tx
      .update(contestGroups)
      .set(updateData)
      .where(
        and(eq(contestGroups.id, id), eq(contestGroups.organizationId, orgId)),
      )
      .returning();
    return updated ?? null;
  },

  async deleteGroup(tx: DrizzleDb, id: string, orgId: string) {
    // Check for linked rounds
    const [roundCount] = await tx
      .select({ total: count() })
      .from(submissionPeriods)
      .where(
        and(
          eq(submissionPeriods.contestGroupId, id),
          eq(submissionPeriods.organizationId, orgId),
        ),
      );
    if (roundCount.total > 0) throw new GroupHasRoundsError(id);

    const [deleted] = await tx
      .delete(contestGroups)
      .where(
        and(eq(contestGroups.id, id), eq(contestGroups.organizationId, orgId)),
      )
      .returning();
    return deleted ?? null;
  },

  async listGroupRounds(tx: DrizzleDb, groupId: string, orgId: string) {
    return tx
      .select()
      .from(submissionPeriods)
      .where(
        and(
          eq(submissionPeriods.contestGroupId, groupId),
          eq(submissionPeriods.organizationId, orgId),
        ),
      )
      .orderBy(submissionPeriods.contestRound)
      .limit(20);
  },

  // =========================================================================
  // Contest Judges
  // =========================================================================

  async assignJudge(
    tx: DrizzleDb,
    orgId: string,
    input: AssignContestJudgeInput,
    assignedBy: string,
  ) {
    await assertPeriodIsContest(tx, input.submissionPeriodId, orgId);
    await assertOrgMember(tx, input.userId, orgId);

    // Check for duplicate
    const [existing] = await tx
      .select({ id: contestJudges.id })
      .from(contestJudges)
      .where(
        and(
          eq(contestJudges.submissionPeriodId, input.submissionPeriodId),
          eq(contestJudges.userId, input.userId),
          eq(contestJudges.organizationId, orgId),
        ),
      )
      .limit(1);
    if (existing)
      throw new ContestJudgeAlreadyAssignedError(
        input.userId,
        input.submissionPeriodId,
      );

    const [judge] = await tx
      .insert(contestJudges)
      .values({
        organizationId: orgId,
        submissionPeriodId: input.submissionPeriodId,
        userId: input.userId,
        role: input.role ?? 'judge',
        assignedBy,
        notes: input.notes ?? null,
      })
      .returning();
    return judge;
  },

  async updateJudge(
    tx: DrizzleDb,
    id: string,
    orgId: string,
    input: UpdateContestJudgeInput,
  ) {
    const updateData: Record<string, unknown> = {};
    if (input.role !== undefined) updateData.role = input.role;
    if (input.notes !== undefined) updateData.notes = input.notes;

    if (Object.keys(updateData).length === 0) return null;

    const [updated] = await tx
      .update(contestJudges)
      .set(updateData)
      .where(
        and(eq(contestJudges.id, id), eq(contestJudges.organizationId, orgId)),
      )
      .returning();
    return updated ?? null;
  },

  async removeJudge(tx: DrizzleDb, id: string, orgId: string) {
    const [deleted] = await tx
      .delete(contestJudges)
      .where(
        and(eq(contestJudges.id, id), eq(contestJudges.organizationId, orgId)),
      )
      .returning();
    return deleted ?? null;
  },

  async listJudges(tx: DrizzleDb, periodId: string, orgId: string) {
    return tx
      .select({
        id: contestJudges.id,
        submissionPeriodId: contestJudges.submissionPeriodId,
        userId: contestJudges.userId,
        userEmail: users.email,
        role: contestJudges.role,
        assignedBy: contestJudges.assignedBy,
        assignedAt: contestJudges.assignedAt,
        notes: contestJudges.notes,
      })
      .from(contestJudges)
      .leftJoin(users, eq(users.id, contestJudges.userId))
      .where(
        and(
          eq(contestJudges.submissionPeriodId, periodId),
          eq(contestJudges.organizationId, orgId),
        ),
      )
      .orderBy(contestJudges.assignedAt)
      .limit(100);
  },

  /**
   * Check if a user is a contest judge for the given submission's period.
   * Used by D4 extension of assertEditorAdminOrReviewer.
   */
  async isJudgeForSubmissionPeriod(
    tx: DrizzleDb,
    userId: string,
    submissionPeriodId: string | null,
  ): Promise<boolean> {
    if (!submissionPeriodId) return false;
    const [judge] = await tx
      .select({ id: contestJudges.id })
      .from(contestJudges)
      .where(
        and(
          eq(contestJudges.userId, userId),
          eq(contestJudges.submissionPeriodId, submissionPeriodId),
        ),
      )
      .limit(1);
    return !!judge;
  },

  // =========================================================================
  // Contest Results
  // =========================================================================

  async createResult(
    tx: DrizzleDb,
    orgId: string,
    input: CreateContestResultInput,
  ) {
    await assertPeriodIsContest(tx, input.submissionPeriodId, orgId);

    // Check for duplicate
    const [existing] = await tx
      .select({ id: contestResults.id })
      .from(contestResults)
      .where(
        and(
          eq(contestResults.submissionPeriodId, input.submissionPeriodId),
          eq(contestResults.submissionId, input.submissionId),
          eq(contestResults.organizationId, orgId),
        ),
      )
      .limit(1);
    if (existing)
      throw new ContestResultAlreadyExistsError(
        input.submissionId,
        input.submissionPeriodId,
      );

    const [result] = await tx
      .insert(contestResults)
      .values({
        organizationId: orgId,
        submissionPeriodId: input.submissionPeriodId,
        submissionId: input.submissionId,
        placement: input.placement ?? null,
        category: input.category ?? null,
        prizeAmount: input.prizeAmount ?? null,
        prizeCurrency: input.prizeCurrency ?? 'usd',
        notes: input.notes ?? null,
      })
      .returning();
    return result;
  },

  async updateResult(
    tx: DrizzleDb,
    id: string,
    orgId: string,
    input: UpdateContestResultInput,
  ) {
    const updateData: Record<string, unknown> = {};
    if (input.placement !== undefined) updateData.placement = input.placement;
    if (input.category !== undefined) updateData.category = input.category;
    if (input.prizeAmount !== undefined)
      updateData.prizeAmount = input.prizeAmount;
    if (input.prizeCurrency !== undefined)
      updateData.prizeCurrency = input.prizeCurrency;
    if (input.notes !== undefined) updateData.notes = input.notes;

    if (Object.keys(updateData).length === 0) return null;

    const [updated] = await tx
      .update(contestResults)
      .set(updateData)
      .where(
        and(
          eq(contestResults.id, id),
          eq(contestResults.organizationId, orgId),
        ),
      )
      .returning();
    return updated ?? null;
  },

  async deleteResult(tx: DrizzleDb, id: string, orgId: string) {
    // Prevent deletion if disbursement exists
    const [result] = await tx
      .select({
        id: contestResults.id,
        disbursementId: contestResults.disbursementId,
      })
      .from(contestResults)
      .where(
        and(
          eq(contestResults.id, id),
          eq(contestResults.organizationId, orgId),
        ),
      )
      .limit(1);

    if (!result) throw new ContestResultNotFoundError(id);
    if (result.disbursementId) throw new DisbursementExistsError(id);

    await tx
      .delete(contestResults)
      .where(
        and(
          eq(contestResults.id, id),
          eq(contestResults.organizationId, orgId),
        ),
      );
  },

  async listResults(
    tx: DrizzleDb,
    periodId: string,
    orgId: string,
    input: ListContestResultsInput,
  ) {
    const { page, limit } = input;
    const offset = (page - 1) * limit;

    const conditions = [
      eq(contestResults.submissionPeriodId, periodId),
      eq(contestResults.organizationId, orgId),
    ];
    if (input.category) {
      conditions.push(eq(contestResults.category, input.category));
    }
    const where = and(...conditions);

    const [items, [{ total }]] = await Promise.all([
      tx
        .select({
          id: contestResults.id,
          submissionPeriodId: contestResults.submissionPeriodId,
          submissionId: contestResults.submissionId,
          submissionTitle: submissions.title,
          submitterEmail: users.email,
          placement: contestResults.placement,
          category: contestResults.category,
          prizeAmount: contestResults.prizeAmount,
          prizeCurrency: contestResults.prizeCurrency,
          disbursementId: contestResults.disbursementId,
          disbursementStatus: paymentTransactions.status,
          announcedAt: contestResults.announcedAt,
          notes: contestResults.notes,
          createdAt: contestResults.createdAt,
          updatedAt: contestResults.updatedAt,
        })
        .from(contestResults)
        .leftJoin(submissions, eq(contestResults.submissionId, submissions.id))
        .leftJoin(users, eq(submissions.submitterId, users.id))
        .leftJoin(
          paymentTransactions,
          eq(contestResults.disbursementId, paymentTransactions.id),
        )
        .where(where)
        .orderBy(contestResults.placement)
        .limit(limit)
        .offset(offset),
      tx.select({ total: count() }).from(contestResults).where(where),
    ]);

    return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
  },

  // =========================================================================
  // Leaderboard
  // =========================================================================

  async getLeaderboard(
    tx: DrizzleDb,
    periodId: string,
    orgId: string,
  ): Promise<ContestLeaderboardEntry[]> {
    // Get submissions in this period with aggregated vote data
    const rows = await tx
      .select({
        submissionId: submissions.id,
        submissionTitle: submissions.title,
        submitterEmail: users.email,
        averageScore: sql<string | null>`AVG(${submissionVotes.score})`,
        totalVotes: sql<number>`COUNT(${submissionVotes.id})::int`,
        acceptCount: sql<number>`COUNT(CASE WHEN ${submissionVotes.decision} = 'ACCEPT' THEN 1 END)::int`,
        rejectCount: sql<number>`COUNT(CASE WHEN ${submissionVotes.decision} = 'REJECT' THEN 1 END)::int`,
        maybeCount: sql<number>`COUNT(CASE WHEN ${submissionVotes.decision} = 'MAYBE' THEN 1 END)::int`,
      })
      .from(submissions)
      .leftJoin(
        submissionVotes,
        eq(submissionVotes.submissionId, submissions.id),
      )
      .leftJoin(users, eq(submissions.submitterId, users.id))
      .where(
        and(
          eq(submissions.submissionPeriodId, periodId),
          eq(submissions.organizationId, orgId),
        ),
      )
      .groupBy(submissions.id, submissions.title, users.email)
      .orderBy(
        desc(sql`AVG(${submissionVotes.score})`),
        desc(
          sql`COUNT(CASE WHEN ${submissionVotes.decision} = 'ACCEPT' THEN 1 END)`,
        ),
      )
      .limit(500);

    // Look up existing placements
    const resultRows = await tx
      .select({
        submissionId: contestResults.submissionId,
        placement: contestResults.placement,
      })
      .from(contestResults)
      .where(
        and(
          eq(contestResults.submissionPeriodId, periodId),
          eq(contestResults.organizationId, orgId),
        ),
      );

    const placementMap = new Map(
      resultRows.map((r) => [r.submissionId, r.placement]),
    );

    return rows.map((row) => ({
      submissionId: row.submissionId,
      submissionTitle: row.submissionTitle,
      submitterEmail: row.submitterEmail,
      averageScore: row.averageScore ? Number(row.averageScore) : null,
      totalVotes: row.totalVotes,
      acceptCount: row.acceptCount,
      rejectCount: row.rejectCount,
      maybeCount: row.maybeCount,
      placement: placementMap.get(row.submissionId) ?? null,
    }));
  },

  // =========================================================================
  // Actions
  // =========================================================================

  async announceWinners(tx: DrizzleDb, periodId: string, orgId: string) {
    // Verify period exists and is contest
    const [period] = await tx
      .select({
        id: submissionPeriods.id,
        isContest: submissionPeriods.isContest,
        contestWinnersAnnouncedAt: submissionPeriods.contestWinnersAnnouncedAt,
      })
      .from(submissionPeriods)
      .where(
        and(
          eq(submissionPeriods.id, periodId),
          eq(submissionPeriods.organizationId, orgId),
        ),
      )
      .limit(1);

    if (!period || !period.isContest) throw new PeriodNotContestError(periodId);
    if (period.contestWinnersAnnouncedAt)
      throw new WinnersAlreadyAnnouncedError(periodId);

    const now = new Date();

    // Set announcedAt on all results for this period
    await tx
      .update(contestResults)
      .set({ announcedAt: now })
      .where(
        and(
          eq(contestResults.submissionPeriodId, periodId),
          eq(contestResults.organizationId, orgId),
        ),
      );

    // Set contestWinnersAnnouncedAt on the period
    await tx
      .update(submissionPeriods)
      .set({ contestWinnersAnnouncedAt: now })
      .where(
        and(
          eq(submissionPeriods.id, periodId),
          eq(submissionPeriods.organizationId, orgId),
        ),
      );
  },

  async disbursePrize(tx: DrizzleDb, resultId: string, orgId: string) {
    const [result] = await tx
      .select()
      .from(contestResults)
      .where(
        and(
          eq(contestResults.id, resultId),
          eq(contestResults.organizationId, orgId),
        ),
      )
      .limit(1);

    if (!result) throw new ContestResultNotFoundError(resultId);
    if (result.disbursementId) throw new PrizeAlreadyDisbursedError(resultId);
    if (!result.prizeAmount || result.prizeAmount <= 0)
      throw new NoPrizeAmountError(resultId);

    // Create outbound payment transaction
    const [transaction] = await tx
      .insert(paymentTransactions)
      .values({
        organizationId: orgId,
        submissionId: result.submissionId,
        type: 'contributor_payment',
        direction: 'outbound',
        amount: result.prizeAmount,
        currency: result.prizeCurrency,
        status: 'PENDING',
        description: `Contest prize — placement #${result.placement ?? 'N/A'}`,
        metadata: {
          contestResultId: result.id,
          submissionPeriodId: result.submissionPeriodId,
          placement: result.placement,
          category: result.category,
        },
      })
      .returning();

    // Link disbursement to result
    await tx
      .update(contestResults)
      .set({ disbursementId: transaction.id })
      .where(
        and(
          eq(contestResults.id, resultId),
          eq(contestResults.organizationId, orgId),
        ),
      );

    return {
      result: { ...result, disbursementId: transaction.id },
      transaction,
    };
  },

  // =========================================================================
  // Audit-wrapped methods
  // =========================================================================

  async createGroupWithAudit(
    ctx: ServiceContext,
    input: CreateContestGroupInput,
  ) {
    assertEditorOrAdmin(ctx.actor.roles);
    const group = await contestService.createGroup(
      ctx.tx,
      ctx.actor.orgId,
      input,
    );
    await ctx.audit({
      action: AuditActions.CONTEST_GROUP_CREATED,
      resource: AuditResources.CONTEST_GROUP,
      resourceId: group.id,
      newValue: { name: input.name },
    });
    return group;
  },

  async updateGroupWithAudit(
    ctx: ServiceContext,
    id: string,
    input: UpdateContestGroupInput,
  ) {
    assertEditorOrAdmin(ctx.actor.roles);
    const existing = await contestService.getGroupById(
      ctx.tx,
      id,
      ctx.actor.orgId,
    );
    if (!existing) throw new ContestGroupNotFoundError(id);

    const updated = await contestService.updateGroup(
      ctx.tx,
      id,
      ctx.actor.orgId,
      input,
    );
    if (!updated) return existing; // no-op

    await ctx.audit({
      action: AuditActions.CONTEST_GROUP_UPDATED,
      resource: AuditResources.CONTEST_GROUP,
      resourceId: id,
      oldValue: { name: existing.name, description: existing.description },
      newValue: { name: updated.name, description: updated.description },
    });
    return updated;
  },

  async deleteGroupWithAudit(ctx: ServiceContext, id: string) {
    assertEditorOrAdmin(ctx.actor.roles);
    const existing = await contestService.getGroupById(
      ctx.tx,
      id,
      ctx.actor.orgId,
    );
    if (!existing) throw new ContestGroupNotFoundError(id);

    await contestService.deleteGroup(ctx.tx, id, ctx.actor.orgId);
    await ctx.audit({
      action: AuditActions.CONTEST_GROUP_DELETED,
      resource: AuditResources.CONTEST_GROUP,
      resourceId: id,
      oldValue: { name: existing.name },
    });
  },

  async assignJudgeWithAudit(
    ctx: ServiceContext,
    input: AssignContestJudgeInput,
  ) {
    assertEditorOrAdmin(ctx.actor.roles);
    const judge = await contestService.assignJudge(
      ctx.tx,
      ctx.actor.orgId,
      input,
      ctx.actor.userId,
    );
    await ctx.audit({
      action: AuditActions.CONTEST_JUDGE_ASSIGNED,
      resource: AuditResources.CONTEST,
      resourceId: judge.id,
      newValue: {
        submissionPeriodId: input.submissionPeriodId,
        userId: input.userId,
        role: judge.role,
      },
    });
    return judge;
  },

  async updateJudgeWithAudit(
    ctx: ServiceContext,
    input: UpdateContestJudgeInput,
  ) {
    assertEditorOrAdmin(ctx.actor.roles);

    const [existing] = await ctx.tx
      .select()
      .from(contestJudges)
      .where(
        and(
          eq(contestJudges.id, input.id),
          eq(contestJudges.organizationId, ctx.actor.orgId),
        ),
      )
      .limit(1);
    if (!existing) throw new ContestJudgeNotFoundError(input.id);

    const updated = await contestService.updateJudge(
      ctx.tx,
      input.id,
      ctx.actor.orgId,
      input,
    );
    if (!updated) return existing;

    await ctx.audit({
      action: AuditActions.CONTEST_JUDGE_UPDATED,
      resource: AuditResources.CONTEST,
      resourceId: input.id,
      oldValue: { role: existing.role, notes: existing.notes },
      newValue: { role: updated.role, notes: updated.notes },
    });
    return updated;
  },

  async removeJudgeWithAudit(ctx: ServiceContext, id: string) {
    assertEditorOrAdmin(ctx.actor.roles);

    const [existing] = await ctx.tx
      .select()
      .from(contestJudges)
      .where(
        and(
          eq(contestJudges.id, id),
          eq(contestJudges.organizationId, ctx.actor.orgId),
        ),
      )
      .limit(1);
    if (!existing) throw new ContestJudgeNotFoundError(id);

    await contestService.removeJudge(ctx.tx, id, ctx.actor.orgId);
    await ctx.audit({
      action: AuditActions.CONTEST_JUDGE_REMOVED,
      resource: AuditResources.CONTEST,
      resourceId: id,
      oldValue: {
        submissionPeriodId: existing.submissionPeriodId,
        userId: existing.userId,
        role: existing.role,
      },
    });
  },

  async createResultWithAudit(
    ctx: ServiceContext,
    input: CreateContestResultInput,
  ) {
    assertEditorOrAdmin(ctx.actor.roles);
    const result = await contestService.createResult(
      ctx.tx,
      ctx.actor.orgId,
      input,
    );
    await ctx.audit({
      action: AuditActions.CONTEST_RESULT_CREATED,
      resource: AuditResources.CONTEST,
      resourceId: result.id,
      newValue: {
        submissionId: input.submissionId,
        placement: result.placement,
        category: result.category,
        prizeAmount: result.prizeAmount,
      },
    });
    return result;
  },

  async updateResultWithAudit(
    ctx: ServiceContext,
    input: UpdateContestResultInput,
  ) {
    assertEditorOrAdmin(ctx.actor.roles);

    const [existing] = await ctx.tx
      .select()
      .from(contestResults)
      .where(
        and(
          eq(contestResults.id, input.id),
          eq(contestResults.organizationId, ctx.actor.orgId),
        ),
      )
      .limit(1);
    if (!existing) throw new ContestResultNotFoundError(input.id);

    const updated = await contestService.updateResult(
      ctx.tx,
      input.id,
      ctx.actor.orgId,
      input,
    );
    if (!updated) return existing;

    await ctx.audit({
      action: AuditActions.CONTEST_RESULT_UPDATED,
      resource: AuditResources.CONTEST,
      resourceId: input.id,
      oldValue: {
        placement: existing.placement,
        category: existing.category,
        prizeAmount: existing.prizeAmount,
      },
      newValue: {
        placement: updated.placement,
        category: updated.category,
        prizeAmount: updated.prizeAmount,
      },
    });
    return updated;
  },

  async deleteResultWithAudit(ctx: ServiceContext, id: string) {
    assertEditorOrAdmin(ctx.actor.roles);
    await contestService.deleteResult(ctx.tx, id, ctx.actor.orgId);
    await ctx.audit({
      action: AuditActions.CONTEST_RESULT_DELETED,
      resource: AuditResources.CONTEST,
      resourceId: id,
    });
  },

  async announceWinnersWithAudit(ctx: ServiceContext, periodId: string) {
    assertEditorOrAdmin(ctx.actor.roles);
    await contestService.announceWinners(ctx.tx, periodId, ctx.actor.orgId);
    await ctx.audit({
      action: AuditActions.CONTEST_WINNERS_ANNOUNCED,
      resource: AuditResources.CONTEST,
      resourceId: periodId,
    });
  },

  async disbursePrizeWithAudit(ctx: ServiceContext, resultId: string) {
    assertBusinessOpsOrAdmin(ctx.actor.roles);
    const { result, transaction } = await contestService.disbursePrize(
      ctx.tx,
      resultId,
      ctx.actor.orgId,
    );
    await ctx.audit({
      action: AuditActions.CONTEST_PRIZE_DISBURSED,
      resource: AuditResources.CONTEST,
      resourceId: resultId,
      newValue: {
        transactionId: transaction.id,
        amount: transaction.amount,
        currency: transaction.currency,
      },
    });
    return { result, transaction };
  },

  // =========================================================================
  // Leaderboard with blinding
  // =========================================================================

  async getLeaderboardWithAccess(
    svc: ServiceContext,
    periodId: string,
  ): Promise<ContestLeaderboardEntry[]> {
    const entries = await contestService.getLeaderboard(
      svc.tx,
      periodId,
      svc.actor.orgId,
    );

    // Apply blinding to submitter emails
    const blindMode = await resolveBlindMode(svc.tx, periodId);
    return entries.map((entry) => {
      const blinded = applySubmitterBlinding(
        { submitterEmail: entry.submitterEmail },
        blindMode,
        svc.actor.roles,
      );
      return { ...entry, submitterEmail: blinded.submitterEmail };
    });
  },

  // =========================================================================
  // Results with blinding
  // =========================================================================

  async listResultsWithAccess(
    svc: ServiceContext,
    periodId: string,
    input: ListContestResultsInput,
  ) {
    const result = await contestService.listResults(
      svc.tx,
      periodId,
      svc.actor.orgId,
      input,
    );

    const blindMode = await resolveBlindMode(svc.tx, periodId);
    const items = result.items.map((item) => {
      const blinded = applySubmitterBlinding(
        { submitterEmail: item.submitterEmail },
        blindMode,
        svc.actor.roles,
      );
      return { ...item, submitterEmail: blinded.submitterEmail };
    });

    return { ...result, items };
  },

  // =========================================================================
  // Judges with blinding
  // =========================================================================

  async listJudgesWithAccess(svc: ServiceContext, periodId: string) {
    assertEditorOrAdmin(svc.actor.roles);
    const judges = await contestService.listJudges(
      svc.tx,
      periodId,
      svc.actor.orgId,
    );

    // In double-blind mode, non-admin users don't see judge emails
    const blindMode = await resolveBlindMode(svc.tx, periodId);
    if (blindMode === 'double_blind' && !svc.actor.roles.includes('ADMIN')) {
      return judges.map((j) => ({ ...j, userEmail: null }));
    }
    return judges;
  },
};
