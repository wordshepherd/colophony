import {
  pipelineItems,
  pipelineHistory,
  pipelineComments,
  submissions,
  publications,
  users,
  manuscripts,
  manuscriptVersions,
  issues,
  issueItems,
  issueSections,
  contracts,
  eq,
  and,
  not,
  sql,
  type DrizzleDb,
} from '@colophony/db';
import { desc, inArray, count, getTableColumns, asc } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import type {
  CreatePipelineItemInput,
  UpdatePipelineStageInput,
  AssignPipelineRoleInput,
  AddPipelineCommentInput,
  ListPipelineItemsInput,
  PipelineStage,
  SaveCopyeditInput,
  ProductionDashboardInput,
} from '@colophony/types';
import {
  AuditActions,
  AuditResources,
  isValidPipelineTransition,
} from '@colophony/types';
import type { ServiceContext } from './types.js';
import { assertEditorOrProductionOrAdmin } from './errors.js';
import { enqueueOutboxEvent } from './outbox.js';
import { isUniqueViolation } from './pg-errors.js';
import type { S3StorageAdapter } from '../adapters/storage/index.js';
import { convertProseMirrorToDocx } from '../converters/prosemirror-to-docx.js';
import { convertFile } from '../converters/index.js';
import type { ProseMirrorDoc } from '@colophony/types';

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

  async list(tx: DrizzleDb, input: ListPipelineItemsInput, orgId: string) {
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
    conditions.push(eq(pipelineItems.organizationId, orgId));
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

    // Search by submission title via subquery. The subquery carries the org
    // predicate too — the outer `inArray` intersects it with an org-scoped set,
    // so results were already correct, but an unscoped subquery scans every
    // tenant's titles to get there.
    if (search) {
      conditions.push(
        inArray(
          pipelineItems.submissionId,
          tx
            .select({ id: submissions.id })
            .from(submissions)
            .where(
              and(
                eq(submissions.organizationId, orgId),
                sql`${submissions.title} ILIKE ${'%' + search + '%'}`,
              ),
            ),
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
        // Org predicate on the join, not just the FK. Isolation would otherwise
        // rest entirely on the pipeline_items row being org-scoped plus FK
        // integrity — which `create` violated until this change.
        // The two `users` aliases carry no such term because `users` has no org
        // column; a non-member assignee is the separate concern noted on
        // `assignCopyeditor`.
        .leftJoin(
          submissions,
          and(
            eq(pipelineItems.submissionId, submissions.id),
            eq(submissions.organizationId, orgId),
          ),
        )
        .leftJoin(
          publications,
          and(
            eq(pipelineItems.publicationId, publications.id),
            eq(publications.organizationId, orgId),
          ),
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

  async getById(tx: DrizzleDb, id: string, orgId: string) {
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
      // Org predicate on the join — see the note in `list` above.
      .leftJoin(
        submissions,
        and(
          eq(pipelineItems.submissionId, submissions.id),
          eq(submissions.organizationId, orgId),
        ),
      )
      .leftJoin(
        publications,
        and(
          eq(pipelineItems.publicationId, publications.id),
          eq(publications.organizationId, orgId),
        ),
      )
      .leftJoin(
        copyeditors,
        eq(pipelineItems.assignedCopyeditorId, copyeditors.id),
      )
      .leftJoin(
        proofreaders,
        eq(pipelineItems.assignedProofreaderId, proofreaders.id),
      )
      .where(
        and(eq(pipelineItems.id, id), eq(pipelineItems.organizationId, orgId)),
      )
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

  /**
   * Look up the pipeline item for a submission, scoped to the caller's org.
   * Filters on organizationId explicitly, with RLS as the backstop rather than
   * the only defence. This is a bare `select()` with no projection, so without
   * the predicate it returns another org's whole row — both assignee ids, all
   * three due dates and the Inngest run id included.
   */
  async getBySubmissionId(tx: DrizzleDb, submissionId: string, orgId: string) {
    const [row] = await tx
      .select()
      .from(pipelineItems)
      .where(
        and(
          eq(pipelineItems.submissionId, submissionId),
          eq(pipelineItems.organizationId, orgId),
        ),
      )
      .limit(1);

    return row ?? null;
  },

  // -------------------------------------------------------------------------
  // Create
  // -------------------------------------------------------------------------

  async create(tx: DrizzleDb, input: CreatePipelineItemInput, orgId: string) {
    // Verify the submission exists, belongs to this org, and is ACCEPTED.
    // The org predicate is load-bearing on both counts: without it a caller can
    // create an item in its own org pointing at another tenant's submission —
    // which `list`/`getById` then join and hand back — and the
    // SubmissionNotAcceptedError below turns into a status oracle for
    // submissions the caller cannot otherwise see.
    const [submission] = await tx
      .select({ id: submissions.id, status: submissions.status })
      .from(submissions)
      .where(
        and(
          eq(submissions.id, input.submissionId),
          eq(submissions.organizationId, orgId),
        ),
      )
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

    // Check uniqueness: one pipeline item per submission.
    // This is an optimisation for the common case, not the guarantee — see the
    // 23505 handler below.
    const existing = await pipelineService.getBySubmissionId(
      tx,
      input.submissionId,
      orgId,
    );
    if (existing) throw new PipelineItemAlreadyExistsError(input.submissionId);

    // `pipeline_items_submission_id_idx` is a GLOBAL unique index on
    // submission_id, so the org-scoped pre-check above cannot pre-empt it: a row
    // owned by another org — creatable before this predicate existed — passes the
    // check and then collides here. Map it rather than letting a raw 23505 surface
    // as a 500. Match on the SQLSTATE, not the message; `saveCopyedit` string-matches
    // 'unique constraint' and should not be copied.
    let row: typeof pipelineItems.$inferSelect;
    try {
      [row] = await tx
        .insert(pipelineItems)
        .values({
          organizationId: orgId,
          submissionId: input.submissionId,
          publicationId: input.publicationId ?? null,
        })
        .returning();
    } catch (err: unknown) {
      if (isUniqueViolation(err)) {
        throw new PipelineItemAlreadyExistsError(input.submissionId);
      }
      throw err;
    }

    // Write initial history entry
    await tx.insert(pipelineHistory).values({
      pipelineItemId: row.id,
      fromStage: null,
      toStage: 'COPYEDIT_PENDING',
    });

    return row;
  },

  async createWithAudit(ctx: ServiceContext, input: CreatePipelineItemInput) {
    assertEditorOrProductionOrAdmin(ctx.actor.roles);
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
    orgId: string,
    changedBy?: string,
  ) {
    const item = await pipelineService.getById(tx, id, orgId);
    if (!item) throw new PipelineItemNotFoundError(id);

    if (!isValidPipelineTransition(item.stage, input.stage)) {
      throw new InvalidPipelineTransitionError(item.stage, input.stage);
    }

    // Second, independent defence. The org-scoped `getById` above already proved
    // this primary key belongs to `orgId`, and a PK matches exactly one row, so
    // no input makes the two WHERE forms differ while that guard stands. This
    // predicate is what keeps the method correct if the guard is ever refactored
    // away — verified by reverting each in turn: either alone still rejects a
    // cross-org call, and only reverting both lets one through.
    //
    // The `!updated` check is not tidying. The history insert below is
    // unconditional, so a zero-row update would still write a row against the
    // other org's item, which `getHistory` would then hand back to them — i.e.
    // adding the predicate without this check would be worse than adding neither.
    const [updated] = await tx
      .update(pipelineItems)
      .set({ stage: input.stage, updatedAt: new Date() })
      .where(
        and(eq(pipelineItems.id, id), eq(pipelineItems.organizationId, orgId)),
      )
      .returning();

    if (!updated) throw new PipelineItemNotFoundError(id);

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
    assertEditorOrProductionOrAdmin(ctx.actor.roles);
    // Capture the previous stage before the update for the audit trail
    const current = await pipelineService.getById(ctx.tx, id, ctx.actor.orgId);
    if (!current) throw new PipelineItemNotFoundError(id);
    const previousStage = current.stage;
    const updated = await pipelineService.updateStage(
      ctx.tx,
      id,
      input,
      ctx.actor.orgId,
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

  /**
   * Assign a copyeditor, scoped to the caller's org. Filters on organizationId
   * explicitly, with RLS as the backstop rather than the only defence — an item
   * belonging to another org matches nothing and reads as not found.
   *
   * The predicate goes on the UPDATE itself because there is no preceding read
   * to carry it: this method is a bare write, unlike `updateStage`, which guards
   * with an org-scoped `getById` first.
   *
   * Note this does *not* check that `input.userId` belongs to `orgId`. Assigning
   * a non-member is a separate, open concern — `users` carries no org column, so
   * it needs a membership lookup rather than a predicate.
   */
  async assignCopyeditor(
    tx: DrizzleDb,
    id: string,
    input: AssignPipelineRoleInput,
    orgId: string,
  ) {
    const [row] = await tx
      .update(pipelineItems)
      .set({ assignedCopyeditorId: input.userId, updatedAt: new Date() })
      .where(
        and(eq(pipelineItems.id, id), eq(pipelineItems.organizationId, orgId)),
      )
      .returning();

    return row ?? null;
  },

  async assignCopyeditorWithAudit(
    ctx: ServiceContext,
    id: string,
    input: AssignPipelineRoleInput,
  ) {
    assertEditorOrProductionOrAdmin(ctx.actor.roles);
    const updated = await pipelineService.assignCopyeditor(
      ctx.tx,
      id,
      input,
      ctx.actor.orgId,
    );
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

  /**
   * Assign a proofreader, scoped to the caller's org. Same shape and same
   * reasoning as `assignCopyeditor` above, including the membership caveat.
   */
  async assignProofreader(
    tx: DrizzleDb,
    id: string,
    input: AssignPipelineRoleInput,
    orgId: string,
  ) {
    const [row] = await tx
      .update(pipelineItems)
      .set({ assignedProofreaderId: input.userId, updatedAt: new Date() })
      .where(
        and(eq(pipelineItems.id, id), eq(pipelineItems.organizationId, orgId)),
      )
      .returning();

    return row ?? null;
  },

  async assignProofreaderWithAudit(
    ctx: ServiceContext,
    id: string,
    input: AssignPipelineRoleInput,
  ) {
    assertEditorOrProductionOrAdmin(ctx.actor.roles);
    const updated = await pipelineService.assignProofreader(
      ctx.tx,
      id,
      input,
      ctx.actor.orgId,
    );
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

  /**
   * Add a comment to a pipeline item, scoped to the caller's org.
   *
   * `pipeline_comments` has no organizationId column of its own — its RLS policy
   * reaches org through a subquery on the parent — so the predicate cannot go on
   * the INSERT. It goes on an org-scoped read of the parent instead, which makes
   * the method safe called directly. Its wrapper performs the same read; the
   * duplicate is deliberate, so that a future caller reaching for the raw method
   * does not inherit the wrapper's guarantee by accident.
   */
  async addComment(
    tx: DrizzleDb,
    pipelineItemId: string,
    input: AddPipelineCommentInput,
    authorId: string | null,
    stage: PipelineStage,
    orgId: string,
  ) {
    const parent = await pipelineService.getById(tx, pipelineItemId, orgId);
    if (!parent) throw new PipelineItemNotFoundError(pipelineItemId);

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
    assertEditorOrProductionOrAdmin(ctx.actor.roles);
    const item = await pipelineService.getById(
      ctx.tx,
      pipelineItemId,
      ctx.actor.orgId,
    );
    if (!item) throw new PipelineItemNotFoundError(pipelineItemId);

    const comment = await pipelineService.addComment(
      ctx.tx,
      pipelineItemId,
      input,
      ctx.actor.userId,
      item.stage,
      ctx.actor.orgId,
    );
    await ctx.audit({
      action: AuditActions.PIPELINE_COMMENT_ADDED,
      resource: AuditResources.PIPELINE_ITEM,
      resourceId: pipelineItemId,
      newValue: { commentId: comment.id },
    });
    return comment;
  },

  // TODO: Replace hard limit with proper pagination if usage grows beyond 1000 per item
  async listComments(tx: DrizzleDb, pipelineItemId: string, orgId: string) {
    return tx
      .select(getTableColumns(pipelineComments))
      .from(pipelineComments)
      .innerJoin(
        pipelineItems,
        eq(pipelineComments.pipelineItemId, pipelineItems.id),
      )
      .where(
        and(
          eq(pipelineComments.pipelineItemId, pipelineItemId),
          eq(pipelineItems.organizationId, orgId),
        ),
      )
      .orderBy(desc(pipelineComments.createdAt))
      .limit(1000);
  },

  // -------------------------------------------------------------------------
  // History
  // -------------------------------------------------------------------------

  // TODO: Replace hard limit with proper pagination if usage grows beyond 1000 per item
  async getHistory(tx: DrizzleDb, pipelineItemId: string, orgId: string) {
    return tx
      .select(getTableColumns(pipelineHistory))
      .from(pipelineHistory)
      .innerJoin(
        pipelineItems,
        eq(pipelineHistory.pipelineItemId, pipelineItems.id),
      )
      .where(
        and(
          eq(pipelineHistory.pipelineItemId, pipelineItemId),
          eq(pipelineItems.organizationId, orgId),
        ),
      )
      .orderBy(desc(pipelineHistory.changedAt))
      .limit(1000);
  },

  // -------------------------------------------------------------------------
  // Copyedit
  // -------------------------------------------------------------------------

  async getCopyeditContent(
    tx: DrizzleDb,
    pipelineItemId: string,
    orgId: string,
  ) {
    const item = await pipelineService.getById(tx, pipelineItemId, orgId);
    if (!item) throw new PipelineItemNotFoundError(pipelineItemId);

    // Get submission with explicit orgId filter (defense-in-depth)
    const [sub] = await tx
      .select({
        manuscriptVersionId: submissions.manuscriptVersionId,
      })
      .from(submissions)
      .innerJoin(pipelineItems, eq(submissions.id, pipelineItems.submissionId))
      .where(
        and(
          eq(pipelineItems.id, pipelineItemId),
          eq(submissions.organizationId, orgId),
        ),
      )
      .limit(1);

    if (!sub?.manuscriptVersionId) {
      return {
        content: null,
        previousContent: null,
        contentExtractionStatus: 'PENDING' as const,
        genreHint: null,
        versions: [],
      };
    }

    // The manuscript reads below carry no org predicate, and cannot: `manuscripts`
    // is owner-scoped (ownerId -> users) and `manuscript_versions` has no org
    // column at all. The manuscript library is user-owned and cross-org by design,
    // so reachability is established by the org-scoped submission read above rather
    // than by a predicate on these tables.

    // Get current version content
    const [version] = await tx
      .select({
        content: manuscriptVersions.content,
        contentExtractionStatus: manuscriptVersions.contentExtractionStatus,
        manuscriptId: manuscriptVersions.manuscriptId,
      })
      .from(manuscriptVersions)
      .where(eq(manuscriptVersions.id, sub.manuscriptVersionId))
      .limit(1);

    if (!version) {
      return {
        content: null,
        previousContent: null,
        contentExtractionStatus: 'PENDING' as const,
        genreHint: null,
        versions: [],
      };
    }

    // Get genre hint from manuscript
    const [manuscript] = await tx
      .select({ genre: manuscripts.genre })
      .from(manuscripts)
      .where(eq(manuscripts.id, version.manuscriptId))
      .limit(1);

    // Get all versions for this manuscript (for diff view)
    const versions = await tx
      .select({
        id: manuscriptVersions.id,
        versionNumber: manuscriptVersions.versionNumber,
        label: manuscriptVersions.label,
        createdAt: manuscriptVersions.createdAt,
      })
      .from(manuscriptVersions)
      .where(eq(manuscriptVersions.manuscriptId, version.manuscriptId))
      .orderBy(asc(manuscriptVersions.versionNumber));

    // Get previous version content for diff view (if > 1 version exists)
    let previousContent: unknown = null;
    if (versions.length > 1) {
      const prevVersionId = versions[versions.length - 2].id;
      const [prev] = await tx
        .select({ content: manuscriptVersions.content })
        .from(manuscriptVersions)
        .where(eq(manuscriptVersions.id, prevVersionId))
        .limit(1);
      previousContent = prev?.content ?? null;
    }

    const genreHint =
      (manuscript?.genre as { primary?: string } | null)?.primary ?? null;

    return {
      content: version.content,
      previousContent,
      contentExtractionStatus: version.contentExtractionStatus,
      genreHint,
      versions,
    };
  },

  async saveCopyedit(
    tx: DrizzleDb,
    pipelineItemId: string,
    input: SaveCopyeditInput,
    orgId: string,
  ) {
    // 1. Verify pipeline item exists + org filter
    const item = await pipelineService.getById(tx, pipelineItemId, orgId);
    if (!item) throw new PipelineItemNotFoundError(pipelineItemId);

    // 2. Verify stage allows copyediting
    if (
      item.stage !== 'COPYEDIT_IN_PROGRESS' &&
      item.stage !== 'AUTHOR_REVIEW'
    ) {
      throw new InvalidPipelineTransitionError(
        item.stage,
        'Cannot save copyedit in this stage',
      );
    }

    // 3. Get submission with explicit orgId filter
    const [sub] = await tx
      .select({
        id: submissions.id,
        manuscriptVersionId: submissions.manuscriptVersionId,
      })
      .from(submissions)
      .where(
        and(
          eq(submissions.id, item.submissionId),
          eq(submissions.organizationId, orgId),
        ),
      )
      .limit(1);

    if (!sub?.manuscriptVersionId) {
      throw new Error('Submission has no manuscript version');
    }

    // Get the manuscript ID from the current version
    const [currentVersion] = await tx
      .select({ manuscriptId: manuscriptVersions.manuscriptId })
      .from(manuscriptVersions)
      .where(eq(manuscriptVersions.id, sub.manuscriptVersionId))
      .limit(1);

    if (!currentVersion) {
      throw new Error('Current manuscript version not found');
    }

    // 4. Create new version — retry once on unique constraint violation
    let newVersion: typeof manuscriptVersions.$inferSelect;
    try {
      newVersion = await createCopyeditVersion(
        tx,
        currentVersion.manuscriptId,
        input,
      );
    } catch (err: unknown) {
      // Retry once on unique constraint violation (concurrent saves)
      if (err instanceof Error && err.message.includes('unique constraint')) {
        newVersion = await createCopyeditVersion(
          tx,
          currentVersion.manuscriptId,
          input,
        );
      } else {
        throw err;
      }
    }

    // 6. Update submission to point to new version (defense-in-depth orgId)
    await tx
      .update(submissions)
      .set({ manuscriptVersionId: newVersion.id })
      .where(
        and(eq(submissions.id, sub.id), eq(submissions.organizationId, orgId)),
      );

    return newVersion;
  },

  async saveCopyeditWithAudit(
    ctx: ServiceContext,
    pipelineItemId: string,
    input: SaveCopyeditInput,
  ) {
    assertEditorOrProductionOrAdmin(ctx.actor.roles);
    const version = await pipelineService.saveCopyedit(
      ctx.tx,
      pipelineItemId,
      input,
      ctx.actor.orgId,
    );
    await ctx.audit({
      action: AuditActions.PIPELINE_COPYEDIT_SAVED,
      resource: AuditResources.PIPELINE_ITEM,
      resourceId: pipelineItemId,
      newValue: {
        manuscriptVersionId: version.id,
        versionNumber: version.versionNumber,
      },
    });
    return version;
  },

  // -------------------------------------------------------------------------
  // Copyedit round-trip (export / import .docx)
  // -------------------------------------------------------------------------

  async exportCopyeditDocx(
    tx: DrizzleDb,
    pipelineItemId: string,
    orgId: string,
    storage: S3StorageAdapter,
  ): Promise<{ downloadUrl: string; filename: string }> {
    // 1. Get current content (defense-in-depth orgId filter already in getCopyeditContent)
    const data = await pipelineService.getCopyeditContent(
      tx,
      pipelineItemId,
      orgId,
    );
    if (data.contentExtractionStatus !== 'COMPLETE' || data.content == null) {
      throw new Error('Manuscript content is not available for export');
    }

    // 2. Get submission title for filename (defense-in-depth orgId filter)
    const [sub] = await tx
      .select({ title: submissions.title })
      .from(submissions)
      .innerJoin(pipelineItems, eq(submissions.id, pipelineItems.submissionId))
      .where(
        and(
          eq(pipelineItems.id, pipelineItemId),
          eq(submissions.organizationId, orgId),
        ),
      )
      .limit(1);

    const versionCount = data.versions.length;
    const sanitizedTitle = (sub?.title ?? 'manuscript')
      .replace(/[^a-zA-Z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .toLowerCase()
      .slice(0, 80);
    const filename = `${sanitizedTitle}-copyedit-v${versionCount}.docx`;

    // 3. Convert ProseMirror → .docx
    const buffer = await convertProseMirrorToDocx(
      data.content as ProseMirrorDoc,
    );

    // 4. Upload to S3
    const storageKey = `copyedit-exports/${orgId}/${pipelineItemId}/${Date.now()}.docx`;
    await storage.uploadToBucket(
      storage.defaultBucket,
      storageKey,
      buffer,
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    );

    // 5. Generate presigned URL (15 min)
    const downloadUrl = await storage.getSignedUrlFromBucket(
      storage.defaultBucket,
      storageKey,
      900,
    );

    return { downloadUrl, filename };
  },

  async exportCopyeditDocxWithAudit(
    ctx: ServiceContext,
    pipelineItemId: string,
    storage: S3StorageAdapter,
  ): Promise<{ downloadUrl: string; filename: string }> {
    assertEditorOrProductionOrAdmin(ctx.actor.roles);
    const result = await pipelineService.exportCopyeditDocx(
      ctx.tx,
      pipelineItemId,
      ctx.actor.orgId,
      storage,
    );
    await ctx.audit({
      action: AuditActions.PIPELINE_COPYEDIT_EXPORTED,
      resource: AuditResources.PIPELINE_ITEM,
      resourceId: pipelineItemId,
      newValue: { filename: result.filename },
    });
    return result;
  },

  async importCopyeditDocx(
    tx: DrizzleDb,
    pipelineItemId: string,
    fileBuffer: Buffer,
    filename: string,
    orgId: string,
  ): Promise<{
    versionId: string;
    versionNumber: number;
    content: ProseMirrorDoc;
  }> {
    // 1. Verify pipeline item exists + stage allows editing
    const item = await pipelineService.getById(tx, pipelineItemId, orgId);
    if (!item) throw new PipelineItemNotFoundError(pipelineItemId);

    if (
      item.stage !== 'COPYEDIT_IN_PROGRESS' &&
      item.stage !== 'AUTHOR_REVIEW'
    ) {
      throw new InvalidPipelineTransitionError(
        item.stage,
        'Cannot import copyedit in this stage',
      );
    }

    // 2. Get genre hint from manuscript
    const copyeditData = await pipelineService.getCopyeditContent(
      tx,
      pipelineItemId,
      orgId,
    );
    const genreHint =
      (copyeditData.genreHint as
        'prose' | 'poetry' | 'hybrid' | 'creative_nonfiction') ?? undefined;

    // 3. Convert .docx → ProseMirror via shared convertFile (includes size check, smart typography, metadata)
    const DOCX_MIME =
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    const result = await convertFile(
      fileBuffer,
      DOCX_MIME,
      filename,
      genreHint,
    );

    if (result.status !== 'success') {
      throw new Error(`Failed to convert ${filename}: ${result.mimeType}`);
    }

    // 4. Save as new version via existing saveCopyedit
    const version = await pipelineService.saveCopyedit(
      tx,
      pipelineItemId,
      {
        content: result.doc as { type: 'doc'; content: unknown[] },
        label: `Imported: ${filename}`,
      },
      orgId,
    );

    return {
      versionId: version.id,
      versionNumber: version.versionNumber,
      content: result.doc,
    };
  },

  async importCopyeditDocxWithAudit(
    ctx: ServiceContext,
    pipelineItemId: string,
    fileBuffer: Buffer,
    filename: string,
  ): Promise<{
    versionId: string;
    versionNumber: number;
    content: ProseMirrorDoc;
  }> {
    assertEditorOrProductionOrAdmin(ctx.actor.roles);
    const result = await pipelineService.importCopyeditDocx(
      ctx.tx,
      pipelineItemId,
      fileBuffer,
      filename,
      ctx.actor.orgId,
    );
    await ctx.audit({
      action: AuditActions.PIPELINE_COPYEDIT_IMPORTED,
      resource: AuditResources.PIPELINE_ITEM,
      resourceId: pipelineItemId,
      newValue: {
        filename,
        versionId: result.versionId,
        versionNumber: result.versionNumber,
        trackChangesAccepted: true,
      },
    });
    return result;
  },

  // -------------------------------------------------------------------------
  // Production dashboard
  // -------------------------------------------------------------------------

  async dashboard(
    tx: DrizzleDb,
    input: ProductionDashboardInput,
    orgId: string,
  ) {
    // Find the target issue
    let issueId = input.issueId;
    if (!issueId) {
      const [firstActive] = await tx
        .select({ id: issues.id })
        .from(issues)
        .where(
          and(
            eq(issues.organizationId, orgId),
            not(inArray(issues.status, ['PUBLISHED', 'ARCHIVED'])),
          ),
        )
        .orderBy(sql`${issues.publicationDate} ASC NULLS LAST`)
        .limit(1);

      if (!firstActive) return null;
      issueId = firstActive.id;
    }

    // Fetch the issue itself
    const [issue] = await tx
      .select({
        id: issues.id,
        title: issues.title,
        status: issues.status,
        publicationDate: issues.publicationDate,
      })
      .from(issues)
      .where(and(eq(issues.id, issueId), eq(issues.organizationId, orgId)))
      .limit(1);

    if (!issue) return null;

    // Fetch items with all joins via raw SQL for lateral subqueries
    const copyeditors = alias(users, 'copyeditors');
    const proofreaders = alias(users, 'proofreaders');

    const rows = await tx
      .select({
        pipelineItemId: pipelineItems.id,
        stage: pipelineItems.stage,
        submissionId: pipelineItems.submissionId,
        submissionTitle: submissions.title,
        issueSectionTitle: issueSections.title,
        sortOrder: issueItems.sortOrder,
        copyeditDueAt: pipelineItems.copyeditDueAt,
        proofreadDueAt: pipelineItems.proofreadDueAt,
        authorReviewDueAt: pipelineItems.authorReviewDueAt,
        assignedCopyeditorEmail: copyeditors.email,
        assignedProofreaderEmail: proofreaders.email,
      })
      .from(issueItems)
      .innerJoin(
        pipelineItems,
        and(
          eq(issueItems.pipelineItemId, pipelineItems.id),
          eq(pipelineItems.organizationId, orgId),
        ),
      )
      .leftJoin(
        submissions,
        and(
          eq(pipelineItems.submissionId, submissions.id),
          eq(submissions.organizationId, orgId),
        ),
      )
      .leftJoin(issueSections, eq(issueItems.issueSectionId, issueSections.id))
      .leftJoin(
        copyeditors,
        eq(pipelineItems.assignedCopyeditorId, copyeditors.id),
      )
      .leftJoin(
        proofreaders,
        eq(pipelineItems.assignedProofreaderId, proofreaders.id),
      )
      .where(eq(issueItems.issueId, issueId))
      .orderBy(asc(issueItems.sortOrder))
      .limit(200);

    // Fetch latest history entry per pipeline item (for elapsed time)
    const pipelineItemIds = rows.map((r) => r.pipelineItemId);
    const historyMap = new Map<string, Date>();
    if (pipelineItemIds.length > 0) {
      const historyRows = await tx
        .select({
          pipelineItemId: pipelineHistory.pipelineItemId,
          changedAt: pipelineHistory.changedAt,
        })
        .from(pipelineHistory)
        .where(inArray(pipelineHistory.pipelineItemId, pipelineItemIds))
        .orderBy(desc(pipelineHistory.changedAt));

      // Keep only the most recent per pipeline item
      for (const h of historyRows) {
        if (!historyMap.has(h.pipelineItemId)) {
          historyMap.set(h.pipelineItemId, h.changedAt);
        }
      }
    }

    // Fetch latest contract per pipeline item
    const contractMap = new Map<string, string>();
    if (pipelineItemIds.length > 0) {
      const contractRows = await tx
        .select({
          pipelineItemId: contracts.pipelineItemId,
          status: contracts.status,
          createdAt: contracts.createdAt,
        })
        .from(contracts)
        .where(
          and(
            inArray(contracts.pipelineItemId, pipelineItemIds),
            eq(contracts.organizationId, orgId),
          ),
        )
        .orderBy(desc(contracts.createdAt));

      // Keep only the most recent per pipeline item
      for (const c of contractRows) {
        if (!contractMap.has(c.pipelineItemId)) {
          contractMap.set(c.pipelineItemId, c.status);
        }
      }
    }

    const now = Date.now();
    const items = rows.map((row) => {
      const lastChange = historyMap.get(row.pipelineItemId) ?? new Date();
      const daysInStage = Math.floor(
        (now - lastChange.getTime()) / (1000 * 60 * 60 * 24),
      );

      return {
        pipelineItemId: row.pipelineItemId,
        stage: row.stage,
        submissionId: row.submissionId,
        submissionTitle: row.submissionTitle,
        issueId: issue.id,
        issueTitle: issue.title,
        issueSectionTitle: row.issueSectionTitle,
        sortOrder: row.sortOrder,
        publicationDate: issue.publicationDate,
        assignedCopyeditorEmail: row.assignedCopyeditorEmail,
        assignedProofreaderEmail: row.assignedProofreaderEmail,
        copyeditDueAt: row.copyeditDueAt,
        proofreadDueAt: row.proofreadDueAt,
        authorReviewDueAt: row.authorReviewDueAt,
        daysInStage,
        lastStageChangeAt: lastChange,
        contractStatus: contractMap.get(row.pipelineItemId) ?? null,
      };
    });

    // Compute summary
    let onTrack = 0;
    let atRisk = 0;
    let overdue = 0;
    let waiting = 0;

    for (const item of items) {
      if (item.stage === 'AUTHOR_REVIEW') {
        waiting++;
      }

      const dueAt = getDeadlineForStage(item);
      if (dueAt) {
        const daysUntilDue = Math.floor(
          (dueAt.getTime() - now) / (1000 * 60 * 60 * 24),
        );
        if (daysUntilDue < 0) overdue++;
        else if (daysUntilDue <= 3) atRisk++;
        else onTrack++;
      } else {
        // No deadline — use fixed thresholds
        if (item.daysInStage > 10) overdue++;
        else if (item.daysInStage >= 5) atRisk++;
        else onTrack++;
      }
    }

    return {
      issueId: issue.id,
      issueTitle: issue.title,
      issueStatus: issue.status,
      publicationDate: issue.publicationDate,
      items,
      summary: {
        total: items.length,
        onTrack,
        atRisk,
        overdue,
        waiting,
      },
    };
  },
};

/** Internal helper: create a new manuscript version with copyedited content. */
async function createCopyeditVersion(
  tx: DrizzleDb,
  manuscriptId: string,
  input: SaveCopyeditInput,
) {
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
      label: input.label ?? 'Copyedit',
      content: input.content,
      contentFormat: 'prosemirror_v1',
      contentExtractionStatus: 'COMPLETE',
    })
    .returning();

  return version;
}

/** Pick the relevant due date for the item's current pipeline stage. */
function getDeadlineForStage(item: {
  stage: string;
  copyeditDueAt: Date | null;
  proofreadDueAt: Date | null;
  authorReviewDueAt: Date | null;
}): Date | null {
  switch (item.stage) {
    case 'COPYEDIT_PENDING':
    case 'COPYEDIT_IN_PROGRESS':
      return item.copyeditDueAt;
    case 'AUTHOR_REVIEW':
      return item.authorReviewDueAt;
    case 'PROOFREAD':
      return item.proofreadDueAt;
    default:
      return null;
  }
}
