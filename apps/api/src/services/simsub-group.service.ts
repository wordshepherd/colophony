import {
  simsubGroups,
  simsubGroupSubmissions,
  submissions,
  externalSubmissions,
  organizations,
  eq,
  and,
  desc,
  type DrizzleDb,
} from '@colophony/db';
import { count, isNotNull } from 'drizzle-orm';
import { AuditActions, AuditResources } from '@colophony/types';
import type {
  ListSimsubGroupsInput,
  CreateSimsubGroupInput,
  AddSimsubGroupSubmissionInput,
  RemoveSimsubGroupSubmissionInput,
  AvailableSimsubSubmissionsInput,
  SimsubGroupStatus,
} from '@colophony/types';
import type { UserServiceContext } from './types.js';
import { ForbiddenError } from './errors.js';
import { submissionService } from './submission.service.js';
import { externalSubmissionService } from './external-submission.service.js';
import { manuscriptService } from './manuscript.service.js';

// ---------------------------------------------------------------------------
// Error classes
// ---------------------------------------------------------------------------

export class SimsubGroupNotFoundError extends Error {
  constructor(id: string) {
    super(`Sim-sub group "${id}" not found`);
    this.name = 'SimsubGroupNotFoundError';
  }
}

export class SimsubGroupSubmissionNotFoundError extends Error {
  constructor() {
    super('Sim-sub group submission not found');
    this.name = 'SimsubGroupSubmissionNotFoundError';
  }
}

export class InvalidSimsubGroupStatusTransitionError extends Error {
  constructor(from: string, to: string) {
    super(
      `Cannot transition sim-sub group from "${from}" to "${to}". Only ACTIVE groups can change status.`,
    );
    this.name = 'InvalidSimsubGroupStatusTransitionError';
  }
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export const simsubGroupService = {
  // -------------------------------------------------------------------------
  // Pure data methods
  // -------------------------------------------------------------------------

  async list(tx: DrizzleDb, userId: string, input: ListSimsubGroupsInput) {
    const { status, manuscriptId, page, limit } = input;
    const offset = (page - 1) * limit;

    const conditions = [eq(simsubGroups.userId, userId)];
    if (status) {
      conditions.push(eq(simsubGroups.status, status));
    }
    if (manuscriptId) {
      conditions.push(eq(simsubGroups.manuscriptId, manuscriptId));
    }

    const where = and(...conditions);

    const [items, countResult] = await Promise.all([
      tx
        .select()
        .from(simsubGroups)
        .where(where)
        .orderBy(desc(simsubGroups.updatedAt))
        .limit(limit)
        .offset(offset),
      tx.select({ count: count() }).from(simsubGroups).where(where),
    ]);

    const total = countResult[0]?.count ?? 0;
    return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
  },

  async getById(tx: DrizzleDb, id: string) {
    const [row] = await tx
      .select()
      .from(simsubGroups)
      .where(eq(simsubGroups.id, id))
      .limit(1);
    return row ?? null;
  },

  async getDetail(tx: DrizzleDb, id: string) {
    const group = await simsubGroupService.getById(tx, id);
    if (!group) return null;

    // Fetch manuscript title if linked
    let manuscriptTitle: string | null = null;
    if (group.manuscriptId) {
      const ms = await manuscriptService.getById(tx, group.manuscriptId);
      manuscriptTitle = ms?.title ?? null;
    }

    // Fetch junction rows with enrichment via LEFT JOINs
    const junctions = await tx
      .select({
        id: simsubGroupSubmissions.id,
        simsubGroupId: simsubGroupSubmissions.simsubGroupId,
        addedAt: simsubGroupSubmissions.addedAt,
        submissionId: simsubGroupSubmissions.submissionId,
        externalSubmissionId: simsubGroupSubmissions.externalSubmissionId,
        submissionTitle: submissions.title,
        submissionStatus: submissions.status,
        organizationName: organizations.name,
        submittedAt: submissions.submittedAt,
        journalName: externalSubmissions.journalName,
        externalStatus: externalSubmissions.status,
        sentAt: externalSubmissions.sentAt,
      })
      .from(simsubGroupSubmissions)
      .leftJoin(
        submissions,
        eq(simsubGroupSubmissions.submissionId, submissions.id),
      )
      .leftJoin(organizations, eq(submissions.organizationId, organizations.id))
      .leftJoin(
        externalSubmissions,
        eq(simsubGroupSubmissions.externalSubmissionId, externalSubmissions.id),
      )
      .where(eq(simsubGroupSubmissions.simsubGroupId, id))
      .orderBy(desc(simsubGroupSubmissions.addedAt))
      .limit(100);

    const enrichedSubs = junctions.map((j) => ({
      id: j.id,
      simsubGroupId: j.simsubGroupId,
      addedAt: j.addedAt,
      type: j.submissionId ? ('colophony' as const) : ('external' as const),
      submissionId: j.submissionId,
      submissionTitle: j.submissionTitle,
      submissionStatus: j.submissionStatus,
      magazineName: j.organizationName,
      submittedAt: j.submittedAt,
      externalSubmissionId: j.externalSubmissionId,
      journalName: j.journalName,
      externalStatus: j.externalStatus,
      sentAt: j.sentAt,
    }));

    return { ...group, submissions: enrichedSubs, manuscriptTitle };
  },

  async create(tx: DrizzleDb, userId: string, input: CreateSimsubGroupInput) {
    const [row] = await tx
      .insert(simsubGroups)
      .values({
        userId,
        name: input.name,
        manuscriptId: input.manuscriptId ?? null,
        notes: input.notes ?? null,
      })
      .returning();
    return row;
  },

  async update(
    tx: DrizzleDb,
    id: string,
    data: { name?: string; status?: SimsubGroupStatus; notes?: string | null },
  ) {
    const values: Record<string, unknown> = { updatedAt: new Date() };
    if (data.name !== undefined) values.name = data.name;
    if (data.status !== undefined) values.status = data.status;
    if (data.notes !== undefined) values.notes = data.notes;

    const [row] = await tx
      .update(simsubGroups)
      .set(values)
      .where(eq(simsubGroups.id, id))
      .returning();
    return row ?? null;
  },

  async delete(tx: DrizzleDb, id: string) {
    const [row] = await tx
      .delete(simsubGroups)
      .where(eq(simsubGroups.id, id))
      .returning();
    return row ?? null;
  },

  async addSubmission(
    tx: DrizzleDb,
    userId: string,
    input: AddSimsubGroupSubmissionInput,
  ) {
    const [row] = await tx
      .insert(simsubGroupSubmissions)
      .values({
        userId,
        simsubGroupId: input.groupId,
        submissionId: input.submissionId ?? null,
        externalSubmissionId: input.externalSubmissionId ?? null,
      })
      .returning();
    return row;
  },

  async removeSubmission(
    tx: DrizzleDb,
    input: RemoveSimsubGroupSubmissionInput,
  ) {
    const conditions = [
      eq(simsubGroupSubmissions.simsubGroupId, input.groupId),
    ];
    if (input.submissionId) {
      conditions.push(
        eq(simsubGroupSubmissions.submissionId, input.submissionId),
      );
    }
    if (input.externalSubmissionId) {
      conditions.push(
        eq(
          simsubGroupSubmissions.externalSubmissionId,
          input.externalSubmissionId,
        ),
      );
    }

    const [row] = await tx
      .delete(simsubGroupSubmissions)
      .where(and(...conditions))
      .returning();
    return row ?? null;
  },

  // -------------------------------------------------------------------------
  // Audit-wrapped methods
  // -------------------------------------------------------------------------

  async createWithAudit(
    ctx: UserServiceContext,
    input: CreateSimsubGroupInput,
  ) {
    // Defense-in-depth: verify manuscript ownership if provided
    if (input.manuscriptId) {
      const manuscript = await manuscriptService.getById(
        ctx.tx,
        input.manuscriptId,
      );
      if (!manuscript || manuscript.ownerId !== ctx.userId) {
        throw new ForbiddenError('You do not own the referenced manuscript');
      }
    }

    const group = await simsubGroupService.create(ctx.tx, ctx.userId, input);

    await ctx.audit({
      action: AuditActions.SIMSUB_GROUP_CREATED,
      resource: AuditResources.SIMSUB_GROUP,
      resourceId: group.id,
      newValue: { name: input.name, manuscriptId: input.manuscriptId },
    });

    return group;
  },

  async updateWithAudit(
    ctx: UserServiceContext,
    input: {
      id: string;
      name?: string;
      status?: SimsubGroupStatus;
      notes?: string | null;
    },
  ) {
    const existing = await simsubGroupService.getById(ctx.tx, input.id);
    if (!existing) throw new SimsubGroupNotFoundError(input.id);

    // Defense-in-depth: ownership check
    if (existing.userId !== ctx.userId) {
      throw new ForbiddenError('You do not own this sim-sub group');
    }

    // Status transition guard: only ACTIVE groups can change status
    if (
      input.status !== undefined &&
      input.status !== existing.status &&
      existing.status !== 'ACTIVE'
    ) {
      throw new InvalidSimsubGroupStatusTransitionError(
        existing.status,
        input.status,
      );
    }

    const updated = await simsubGroupService.update(ctx.tx, input.id, {
      name: input.name,
      status: input.status,
      notes: input.notes,
    });
    if (!updated) return existing;

    await ctx.audit({
      action: AuditActions.SIMSUB_GROUP_UPDATED,
      resource: AuditResources.SIMSUB_GROUP,
      resourceId: input.id,
      oldValue: {
        name: existing.name,
        status: existing.status,
        notes: existing.notes,
      },
      newValue: {
        name: updated.name,
        status: updated.status,
        notes: updated.notes,
      },
    });

    return updated;
  },

  async deleteWithAudit(ctx: UserServiceContext, id: string) {
    const existing = await simsubGroupService.getById(ctx.tx, id);
    if (!existing) throw new SimsubGroupNotFoundError(id);

    if (existing.userId !== ctx.userId) {
      throw new ForbiddenError('You do not own this sim-sub group');
    }

    await simsubGroupService.delete(ctx.tx, id);

    await ctx.audit({
      action: AuditActions.SIMSUB_GROUP_DELETED,
      resource: AuditResources.SIMSUB_GROUP,
      resourceId: id,
      oldValue: { name: existing.name, status: existing.status },
    });
  },

  async addSubmissionWithAudit(
    ctx: UserServiceContext,
    input: AddSimsubGroupSubmissionInput,
  ) {
    // Defense-in-depth: verify group ownership
    const group = await simsubGroupService.getById(ctx.tx, input.groupId);
    if (!group) throw new SimsubGroupNotFoundError(input.groupId);
    if (group.userId !== ctx.userId) {
      throw new ForbiddenError('You do not own this sim-sub group');
    }

    // P2 defense-in-depth: verify referenced record ownership
    if (input.submissionId) {
      const submission = await submissionService.getById(
        ctx.tx,
        input.submissionId,
      );
      if (!submission) {
        throw new SimsubGroupSubmissionNotFoundError();
      }
      if (submission.submitterId !== ctx.userId) {
        throw new ForbiddenError('You do not own the referenced submission');
      }
    }

    if (input.externalSubmissionId) {
      const external = await externalSubmissionService.getById(
        ctx.tx,
        input.externalSubmissionId,
      );
      if (!external) {
        throw new SimsubGroupSubmissionNotFoundError();
      }
      if (external.userId !== ctx.userId) {
        throw new ForbiddenError(
          'You do not own the referenced external submission',
        );
      }
    }

    const junction = await simsubGroupService.addSubmission(
      ctx.tx,
      ctx.userId,
      input,
    );

    await ctx.audit({
      action: AuditActions.SIMSUB_GROUP_SUBMISSION_ADDED,
      resource: AuditResources.SIMSUB_GROUP,
      resourceId: input.groupId,
      newValue: {
        submissionId: input.submissionId,
        externalSubmissionId: input.externalSubmissionId,
      },
    });

    return junction;
  },

  async removeSubmissionWithAudit(
    ctx: UserServiceContext,
    input: RemoveSimsubGroupSubmissionInput,
  ) {
    // Defense-in-depth: verify group ownership
    const group = await simsubGroupService.getById(ctx.tx, input.groupId);
    if (!group) throw new SimsubGroupNotFoundError(input.groupId);
    if (group.userId !== ctx.userId) {
      throw new ForbiddenError('You do not own this sim-sub group');
    }

    const deleted = await simsubGroupService.removeSubmission(ctx.tx, input);
    if (!deleted) throw new SimsubGroupSubmissionNotFoundError();

    await ctx.audit({
      action: AuditActions.SIMSUB_GROUP_SUBMISSION_REMOVED,
      resource: AuditResources.SIMSUB_GROUP,
      resourceId: input.groupId,
      oldValue: {
        submissionId: input.submissionId,
        externalSubmissionId: input.externalSubmissionId,
      },
    });
  },

  // -------------------------------------------------------------------------
  // Picker queries (for add-submission dialog)
  // -------------------------------------------------------------------------

  async availableSubmissions(
    ctx: UserServiceContext,
    input: AvailableSimsubSubmissionsInput,
  ) {
    // Defense-in-depth: verify group ownership
    const group = await simsubGroupService.getById(ctx.tx, input.groupId);
    if (!group) throw new SimsubGroupNotFoundError(input.groupId);
    if (group.userId !== ctx.userId) {
      throw new ForbiddenError('You do not own this sim-sub group');
    }

    const existing = await ctx.tx
      .select({ submissionId: simsubGroupSubmissions.submissionId })
      .from(simsubGroupSubmissions)
      .where(
        and(
          eq(simsubGroupSubmissions.simsubGroupId, input.groupId),
          isNotNull(simsubGroupSubmissions.submissionId),
        ),
      );
    const excludeIds = existing
      .map((r) => r.submissionId)
      .filter(Boolean) as string[];

    const rows = await ctx.tx
      .select({
        id: submissions.id,
        title: submissions.title,
        status: submissions.status,
        organizationId: submissions.organizationId,
      })
      .from(submissions)
      .where(eq(submissions.submitterId, ctx.userId))
      .orderBy(desc(submissions.createdAt))
      .limit(50);

    return rows.filter((r) => !excludeIds.includes(r.id));
  },

  async availableExternalSubmissions(
    ctx: UserServiceContext,
    input: AvailableSimsubSubmissionsInput,
  ) {
    // Defense-in-depth: verify group ownership
    const group = await simsubGroupService.getById(ctx.tx, input.groupId);
    if (!group) throw new SimsubGroupNotFoundError(input.groupId);
    if (group.userId !== ctx.userId) {
      throw new ForbiddenError('You do not own this sim-sub group');
    }

    const existing = await ctx.tx
      .select({
        externalSubmissionId: simsubGroupSubmissions.externalSubmissionId,
      })
      .from(simsubGroupSubmissions)
      .where(
        and(
          eq(simsubGroupSubmissions.simsubGroupId, input.groupId),
          isNotNull(simsubGroupSubmissions.externalSubmissionId),
        ),
      );
    const excludeIds = existing
      .map((r) => r.externalSubmissionId)
      .filter(Boolean) as string[];

    const rows = await ctx.tx
      .select({
        id: externalSubmissions.id,
        journalName: externalSubmissions.journalName,
        status: externalSubmissions.status,
        sentAt: externalSubmissions.sentAt,
      })
      .from(externalSubmissions)
      .where(eq(externalSubmissions.userId, ctx.userId))
      .orderBy(desc(externalSubmissions.createdAt))
      .limit(50);

    return rows.filter((r) => !excludeIds.includes(r.id));
  },
};
