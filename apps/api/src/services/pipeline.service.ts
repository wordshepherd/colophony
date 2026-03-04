import {
  pipelineItems,
  pipelineHistory,
  pipelineComments,
  submissions,
  publications,
  users,
  eq,
  and,
  sql,
  type DrizzleDb,
} from '@colophony/db';
import { desc, inArray, count, getTableColumns } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import type {
  CreatePipelineItemInput,
  UpdatePipelineStageInput,
  AssignPipelineRoleInput,
  AddPipelineCommentInput,
  ListPipelineItemsInput,
  PipelineStage,
} from '@colophony/types';
import {
  AuditActions,
  AuditResources,
  isValidPipelineTransition,
} from '@colophony/types';
import type { ServiceContext } from './types.js';
import { assertEditorOrAdmin } from './errors.js';
import { enqueueOutboxEvent } from './outbox.js';

// ---------------------------------------------------------------------------
// Error classes
// ---------------------------------------------------------------------------

export class PipelineItemNotFoundError extends Error {
  constructor(id: string) {
    super(`Pipeline item "${id}" not found`);
    this.name = 'PipelineItemNotFoundError';
  }
}

export class PipelineItemAlreadyExistsError extends Error {
  constructor(submissionId: string) {
    super(`Submission "${submissionId}" already has a pipeline item`);
    this.name = 'PipelineItemAlreadyExistsError';
  }
}

export class SubmissionNotAcceptedError extends Error {
  constructor(submissionId: string, currentStatus: string) {
    super(
      `Submission "${submissionId}" has status "${currentStatus}" — only ACCEPTED submissions can enter the pipeline`,
    );
    this.name = 'SubmissionNotAcceptedError';
  }
}

export class InvalidPipelineTransitionError extends Error {
  constructor(from: string, to: string) {
    super(`Invalid pipeline transition from "${from}" to "${to}"`);
    this.name = 'InvalidPipelineTransitionError';
  }
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export const pipelineService = {
  // -------------------------------------------------------------------------
  // List / Get
  // -------------------------------------------------------------------------

  async list(tx: DrizzleDb, input: ListPipelineItemsInput) {
    const {
      stage,
      publicationId,
      assignedCopyeditorId,
      assignedProofreaderId,
      search,
      page,
      limit,
    } = input;
    const offset = (page - 1) * limit;

    const conditions = [];
    if (stage) conditions.push(eq(pipelineItems.stage, stage));
    if (publicationId)
      conditions.push(eq(pipelineItems.publicationId, publicationId));
    if (assignedCopyeditorId)
      conditions.push(
        eq(pipelineItems.assignedCopyeditorId, assignedCopyeditorId),
      );
    if (assignedProofreaderId)
      conditions.push(
        eq(pipelineItems.assignedProofreaderId, assignedProofreaderId),
      );

    // Search by submission title via subquery
    if (search) {
      conditions.push(
        inArray(
          pipelineItems.submissionId,
          tx
            .select({ id: submissions.id })
            .from(submissions)
            .where(sql`${submissions.title} ILIKE ${'%' + search + '%'}`),
        ),
      );
    }

    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const copyeditors = alias(users, 'copyeditors');
    const proofreaders = alias(users, 'proofreaders');

    const [rows, countResult] = await Promise.all([
      tx
        .select({
          ...getTableColumns(pipelineItems),
          submission: { title: submissions.title },
          publication: { name: publications.name },
          assignedCopyeditor: { email: copyeditors.email },
          assignedProofreader: { email: proofreaders.email },
        })
        .from(pipelineItems)
        .leftJoin(submissions, eq(pipelineItems.submissionId, submissions.id))
        .leftJoin(
          publications,
          eq(pipelineItems.publicationId, publications.id),
        )
        .leftJoin(
          copyeditors,
          eq(pipelineItems.assignedCopyeditorId, copyeditors.id),
        )
        .leftJoin(
          proofreaders,
          eq(pipelineItems.assignedProofreaderId, proofreaders.id),
        )
        .where(where)
        .orderBy(desc(pipelineItems.createdAt))
        .limit(limit)
        .offset(offset),
      tx.select({ count: count() }).from(pipelineItems).where(where),
    ]);

    // Clean up null join results to match optional schema shape
    const items = rows.map((row) => ({
      ...row,
      submission: row.submission?.title != null ? row.submission : undefined,
      publication: row.publication?.name != null ? row.publication : undefined,
      assignedCopyeditor:
        row.assignedCopyeditor?.email != null
          ? row.assignedCopyeditor
          : undefined,
      assignedProofreader:
        row.assignedProofreader?.email != null
          ? row.assignedProofreader
          : undefined,
    }));

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
    const copyeditors = alias(users, 'copyeditors');
    const proofreaders = alias(users, 'proofreaders');

    const [row] = await tx
      .select({
        ...getTableColumns(pipelineItems),
        submission: { title: submissions.title },
        publication: { name: publications.name },
        assignedCopyeditor: { email: copyeditors.email },
        assignedProofreader: { email: proofreaders.email },
      })
      .from(pipelineItems)
      .leftJoin(submissions, eq(pipelineItems.submissionId, submissions.id))
      .leftJoin(publications, eq(pipelineItems.publicationId, publications.id))
      .leftJoin(
        copyeditors,
        eq(pipelineItems.assignedCopyeditorId, copyeditors.id),
      )
      .leftJoin(
        proofreaders,
        eq(pipelineItems.assignedProofreaderId, proofreaders.id),
      )
      .where(eq(pipelineItems.id, id))
      .limit(1);

    if (!row) return null;

    return {
      ...row,
      submission: row.submission?.title != null ? row.submission : undefined,
      publication: row.publication?.name != null ? row.publication : undefined,
      assignedCopyeditor:
        row.assignedCopyeditor?.email != null
          ? row.assignedCopyeditor
          : undefined,
      assignedProofreader:
        row.assignedProofreader?.email != null
          ? row.assignedProofreader
          : undefined,
    };
  },

  async getBySubmissionId(tx: DrizzleDb, submissionId: string) {
    const [row] = await tx
      .select()
      .from(pipelineItems)
      .where(eq(pipelineItems.submissionId, submissionId))
      .limit(1);

    return row ?? null;
  },

  // -------------------------------------------------------------------------
  // Create
  // -------------------------------------------------------------------------

  async create(tx: DrizzleDb, input: CreatePipelineItemInput, orgId: string) {
    // Verify the submission exists and is ACCEPTED
    const [submission] = await tx
      .select({ id: submissions.id, status: submissions.status })
      .from(submissions)
      .where(eq(submissions.id, input.submissionId))
      .limit(1);

    if (!submission) {
      throw new PipelineItemNotFoundError(input.submissionId);
    }
    if (submission.status !== 'ACCEPTED') {
      throw new SubmissionNotAcceptedError(
        input.submissionId,
        submission.status,
      );
    }

    // Check uniqueness: one pipeline item per submission
    const existing = await pipelineService.getBySubmissionId(
      tx,
      input.submissionId,
    );
    if (existing) throw new PipelineItemAlreadyExistsError(input.submissionId);

    const [row] = await tx
      .insert(pipelineItems)
      .values({
        organizationId: orgId,
        submissionId: input.submissionId,
        publicationId: input.publicationId ?? null,
      })
      .returning();

    // Write initial history entry
    await tx.insert(pipelineHistory).values({
      pipelineItemId: row.id,
      fromStage: null,
      toStage: 'COPYEDIT_PENDING',
    });

    return row;
  },

  async createWithAudit(ctx: ServiceContext, input: CreatePipelineItemInput) {
    assertEditorOrAdmin(ctx.actor.role);
    const item = await pipelineService.create(ctx.tx, input, ctx.actor.orgId);
    await ctx.audit({
      action: AuditActions.PIPELINE_ITEM_CREATED,
      resource: AuditResources.PIPELINE_ITEM,
      resourceId: item.id,
      newValue: {
        submissionId: input.submissionId,
        publicationId: input.publicationId,
      },
    });
    return item;
  },

  // -------------------------------------------------------------------------
  // Stage transitions
  // -------------------------------------------------------------------------

  async updateStage(
    tx: DrizzleDb,
    id: string,
    input: UpdatePipelineStageInput,
    changedBy?: string,
  ) {
    const item = await pipelineService.getById(tx, id);
    if (!item) throw new PipelineItemNotFoundError(id);

    if (!isValidPipelineTransition(item.stage, input.stage)) {
      throw new InvalidPipelineTransitionError(item.stage, input.stage);
    }

    const [updated] = await tx
      .update(pipelineItems)
      .set({ stage: input.stage, updatedAt: new Date() })
      .where(eq(pipelineItems.id, id))
      .returning();

    // Write history entry
    await tx.insert(pipelineHistory).values({
      pipelineItemId: id,
      fromStage: item.stage,
      toStage: input.stage,
      changedBy: changedBy ?? null,
      comment: input.comment ?? null,
    });

    return updated;
  },

  async updateStageWithAudit(
    ctx: ServiceContext,
    id: string,
    input: UpdatePipelineStageInput,
  ) {
    assertEditorOrAdmin(ctx.actor.role);
    // Capture the previous stage before the update for the audit trail
    const current = await pipelineService.getById(ctx.tx, id);
    if (!current) throw new PipelineItemNotFoundError(id);
    const previousStage = current.stage;
    const updated = await pipelineService.updateStage(
      ctx.tx,
      id,
      input,
      ctx.actor.userId,
    );
    await ctx.audit({
      action: AuditActions.PIPELINE_STAGE_CHANGED,
      resource: AuditResources.PIPELINE_ITEM,
      resourceId: id,
      oldValue: { stage: previousStage },
      newValue: { stage: input.stage },
    });

    // Emit pipeline events consumed by Inngest workflows
    const eventMap: Partial<Record<PipelineStage, string>> = {
      AUTHOR_REVIEW: 'slate/pipeline.copyedit-completed',
      READY_TO_PUBLISH: 'slate/pipeline.proofread-completed',
    };
    // Author review completion emits with approved flag based on direction
    if (previousStage === 'AUTHOR_REVIEW') {
      const approved = input.stage === 'PROOFREAD';
      await enqueueOutboxEvent(
        ctx.tx,
        'slate/pipeline.author-review-completed',
        { orgId: ctx.actor.orgId, pipelineItemId: id, approved },
      );
    } else {
      const eventName = eventMap[input.stage];
      if (eventName) {
        await enqueueOutboxEvent(ctx.tx, eventName, {
          orgId: ctx.actor.orgId,
          pipelineItemId: id,
        });
      }
    }

    return updated;
  },

  // -------------------------------------------------------------------------
  // Assign roles
  // -------------------------------------------------------------------------

  async assignCopyeditor(
    tx: DrizzleDb,
    id: string,
    input: AssignPipelineRoleInput,
  ) {
    const [row] = await tx
      .update(pipelineItems)
      .set({ assignedCopyeditorId: input.userId, updatedAt: new Date() })
      .where(eq(pipelineItems.id, id))
      .returning();

    return row ?? null;
  },

  async assignCopyeditorWithAudit(
    ctx: ServiceContext,
    id: string,
    input: AssignPipelineRoleInput,
  ) {
    assertEditorOrAdmin(ctx.actor.role);
    const updated = await pipelineService.assignCopyeditor(ctx.tx, id, input);
    if (!updated) throw new PipelineItemNotFoundError(id);
    await ctx.audit({
      action: AuditActions.PIPELINE_COPYEDITOR_ASSIGNED,
      resource: AuditResources.PIPELINE_ITEM,
      resourceId: id,
      newValue: { assignedCopyeditorId: input.userId },
    });

    // Emit event for Inngest pipeline workflow
    await enqueueOutboxEvent(ctx.tx, 'slate/pipeline.copyeditor-assigned', {
      orgId: ctx.actor.orgId,
      pipelineItemId: id,
      copyeditorId: input.userId,
    });

    return updated;
  },

  async assignProofreader(
    tx: DrizzleDb,
    id: string,
    input: AssignPipelineRoleInput,
  ) {
    const [row] = await tx
      .update(pipelineItems)
      .set({ assignedProofreaderId: input.userId, updatedAt: new Date() })
      .where(eq(pipelineItems.id, id))
      .returning();

    return row ?? null;
  },

  async assignProofreaderWithAudit(
    ctx: ServiceContext,
    id: string,
    input: AssignPipelineRoleInput,
  ) {
    assertEditorOrAdmin(ctx.actor.role);
    const updated = await pipelineService.assignProofreader(ctx.tx, id, input);
    if (!updated) throw new PipelineItemNotFoundError(id);
    await ctx.audit({
      action: AuditActions.PIPELINE_PROOFREADER_ASSIGNED,
      resource: AuditResources.PIPELINE_ITEM,
      resourceId: id,
      newValue: { assignedProofreaderId: input.userId },
    });
    return updated;
  },

  // -------------------------------------------------------------------------
  // Comments
  // -------------------------------------------------------------------------

  async addComment(
    tx: DrizzleDb,
    pipelineItemId: string,
    input: AddPipelineCommentInput,
    authorId: string | null,
    stage: PipelineStage,
  ) {
    const [row] = await tx
      .insert(pipelineComments)
      .values({
        pipelineItemId,
        authorId,
        content: input.content,
        stage,
      })
      .returning();

    return row;
  },

  async addCommentWithAudit(
    ctx: ServiceContext,
    pipelineItemId: string,
    input: AddPipelineCommentInput,
  ) {
    assertEditorOrAdmin(ctx.actor.role);
    const item = await pipelineService.getById(ctx.tx, pipelineItemId);
    if (!item) throw new PipelineItemNotFoundError(pipelineItemId);

    const comment = await pipelineService.addComment(
      ctx.tx,
      pipelineItemId,
      input,
      ctx.actor.userId,
      item.stage,
    );
    await ctx.audit({
      action: AuditActions.PIPELINE_COMMENT_ADDED,
      resource: AuditResources.PIPELINE_ITEM,
      resourceId: pipelineItemId,
      newValue: { commentId: comment.id },
    });
    return comment;
  },

  async listComments(tx: DrizzleDb, pipelineItemId: string) {
    return tx
      .select()
      .from(pipelineComments)
      .where(eq(pipelineComments.pipelineItemId, pipelineItemId))
      .orderBy(desc(pipelineComments.createdAt))
      .limit(1000);
  },

  // -------------------------------------------------------------------------
  // History
  // -------------------------------------------------------------------------

  async getHistory(tx: DrizzleDb, pipelineItemId: string) {
    return tx
      .select()
      .from(pipelineHistory)
      .where(eq(pipelineHistory.pipelineItemId, pipelineItemId))
      .orderBy(desc(pipelineHistory.changedAt))
      .limit(1000);
  },
};
