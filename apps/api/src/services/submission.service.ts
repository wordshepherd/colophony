import {
  db,
  submissions,
  files,
  manuscriptVersions,
  manuscripts,
  submissionHistory,
  submissionPeriods,
  formDefinitions,
  users,
  eq,
  and,
  inArray,
  sql,
  type DrizzleDb,
} from '@colophony/db';
import { desc, asc, ilike, count } from 'drizzle-orm';
import type {
  CreateSubmissionInput,
  UpdateSubmissionInput,
  ListSubmissionsInput,
  SubmissionStatus,
  BatchStatusChangeInput,
  BatchStatusChangeResponse,
  BatchAssignReviewersInput,
  BatchAssignReviewersResponse,
  ExportSubmissionsInput,
} from '@colophony/types';
import {
  isValidStatusTransition,
  isEditorAllowedTransition,
  AuditActions,
  AuditResources,
} from '@colophony/types';
import { enqueueOutboxEvent } from './outbox.js';
import type { ServiceContext } from './types.js';
import {
  ForbiddenError,
  NotFoundError,
  assertOwnerOrEditor,
  assertEditorOrAdmin,
} from './errors.js';
import {
  resolveBlindMode,
  applySubmitterBlinding,
} from './blind-review.helper.js';
import {
  formService,
  FormNotFoundError,
  FormNotPublishedError,
  InvalidFormDataError,
} from './form.service.js';
import { MigrationInvalidStateError } from './migration.service.js';
import { submissionReviewerService } from './submission-reviewer.service.js';
import { ReviewerAlreadyAssignedError } from './submission-reviewer.service.js';

// ---------------------------------------------------------------------------
// Error classes
// ---------------------------------------------------------------------------

export class SubmissionNotFoundError extends Error {
  constructor(id: string) {
    super(`Submission "${id}" not found`);
    this.name = 'SubmissionNotFoundError';
  }
}

export class InvalidStatusTransitionError extends Error {
  constructor(from: string, to: string) {
    super(`Invalid status transition from "${from}" to "${to}"`);
    this.name = 'InvalidStatusTransitionError';
  }
}

export class NotDraftError extends Error {
  constructor() {
    super('Submission must be in DRAFT status for this operation');
    this.name = 'NotDraftError';
  }
}

export class FormDefinitionMismatchError extends Error {
  constructor(formId: string, periodFormId: string) {
    super(
      `formDefinitionId "${formId}" does not match the submission period's form "${periodFormId}"`,
    );
    this.name = 'FormDefinitionMismatchError';
  }
}

export class UnscannedFilesError extends Error {
  constructor() {
    super(
      'Cannot submit: one or more files are still pending or being scanned',
    );
    this.name = 'UnscannedFilesError';
  }
}

export class InfectedFilesError extends Error {
  constructor() {
    super('Cannot submit: one or more files have been flagged as infected');
    this.name = 'InfectedFilesError';
  }
}

export class MissingRevisionNotesError extends Error {
  constructor() {
    super('Revision notes are required when requesting revisions');
    this.name = 'MissingRevisionNotesError';
  }
}

export class NotReviseAndResubmitError extends Error {
  constructor() {
    super(
      'Submission must be in REVISE_AND_RESUBMIT status to resubmit a new version',
    );
    this.name = 'NotReviseAndResubmitError';
  }
}

// ---------------------------------------------------------------------------
// Migration guard
// ---------------------------------------------------------------------------

/**
 * Reject submissions from migrated users.
 * Superuser `db` for a single-column lookup — minimal query, same pattern
 * used elsewhere in submission service for user checks.
 */
async function assertNotMigrated(submitterId: string): Promise<void> {
  const [user] = await db
    .select({ migratedAt: users.migratedAt })
    .from(users)
    .where(eq(users.id, submitterId))
    .limit(1);
  if (user?.migratedAt) {
    throw new MigrationInvalidStateError(
      'User has migrated and cannot create new submissions',
    );
  }
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export const submissionService = {
  /**
   * List submissions for a specific submitter (their own view).
   * RLS handles org filtering; we add submitterId filter.
   */
  async listBySubmitter(
    tx: DrizzleDb,
    submitterId: string,
    input: ListSubmissionsInput,
  ) {
    const { status, submissionPeriodId, search, page, limit } = input;
    const offset = (page - 1) * limit;

    const conditions = [eq(submissions.submitterId, submitterId)];
    if (status) conditions.push(eq(submissions.status, status));
    if (submissionPeriodId)
      conditions.push(eq(submissions.submissionPeriodId, submissionPeriodId));
    if (search) {
      if (search.length >= 3) {
        conditions.push(
          sql`${submissions.searchVector} @@ plainto_tsquery('english', ${search})`,
        );
      } else {
        conditions.push(ilike(submissions.title, `%${search}%`));
      }
    }

    const where = and(...conditions);

    const [items, countResult] = await Promise.all([
      tx
        .select()
        .from(submissions)
        .where(where)
        .orderBy(desc(submissions.createdAt))
        .limit(limit)
        .offset(offset),
      tx.select({ count: count() }).from(submissions).where(where),
    ]);

    const total = countResult[0]?.count ?? 0;
    return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
  },

  /**
   * List all submissions in the org (editor view).
   * RLS handles org filtering.
   */
  async listAll(
    tx: DrizzleDb,
    input: ListSubmissionsInput,
    callerRole?: import('@colophony/types').Role,
  ) {
    const { status, submissionPeriodId, search, page, limit } = input;
    const offset = (page - 1) * limit;

    const conditions = [];
    if (status) conditions.push(eq(submissions.status, status));
    if (submissionPeriodId)
      conditions.push(eq(submissions.submissionPeriodId, submissionPeriodId));
    if (search) {
      if (search.length >= 3) {
        conditions.push(
          sql`${submissions.searchVector} @@ plainto_tsquery('english', ${search})`,
        );
      } else {
        conditions.push(ilike(submissions.title, `%${search}%`));
      }
    }

    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const sortColumnMap = {
      title: submissions.title,
      submitterEmail: users.email,
      submittedAt: submissions.submittedAt,
      status: submissions.status,
      createdAt: submissions.createdAt,
    } as const;
    const sortColumn = sortColumnMap[input.sortBy ?? 'createdAt'];
    const orderFn = input.sortOrder === 'asc' ? asc : desc;

    const [items, countResult] = await Promise.all([
      tx
        .select({
          id: submissions.id,
          organizationId: submissions.organizationId,
          submitterId: submissions.submitterId,
          submissionPeriodId: submissions.submissionPeriodId,
          title: submissions.title,
          content: submissions.content,
          coverLetter: submissions.coverLetter,
          formDefinitionId: submissions.formDefinitionId,
          formData: submissions.formData,
          manuscriptVersionId: submissions.manuscriptVersionId,
          status: submissions.status,
          simSubOverride: submissions.simSubOverride,
          simSubCheckResult: submissions.simSubCheckResult,
          simSubCheckedAt: submissions.simSubCheckedAt,
          submittedAt: submissions.submittedAt,
          createdAt: submissions.createdAt,
          updatedAt: submissions.updatedAt,
          searchVector: submissions.searchVector,
          statusTokenHash: submissions.statusTokenHash,
          transferredFromDomain: submissions.transferredFromDomain,
          transferredFromTransferId: submissions.transferredFromTransferId,
          submitterEmail: users.email,
        })
        .from(submissions)
        .leftJoin(users, eq(users.id, submissions.submitterId))
        .where(where)
        .orderBy(orderFn(sortColumn))
        .limit(limit)
        .offset(offset),
      tx.select({ count: count() }).from(submissions).where(where),
    ]);

    // Apply blind review: batch-fetch blind modes for all distinct periods
    let blindedItems = items;
    if (callerRole && callerRole !== 'ADMIN') {
      const periodIds = [
        ...new Set(
          items
            .map((i) => i.submissionPeriodId)
            .filter((id): id is string => id != null),
        ),
      ];

      if (periodIds.length > 0) {
        const rows = await tx
          .select({
            id: submissionPeriods.id,
            blindReviewMode: submissionPeriods.blindReviewMode,
          })
          .from(submissionPeriods)
          .where(inArray(submissionPeriods.id, periodIds));
        const blindModes = new Map<
          string,
          import('@colophony/types').BlindReviewMode
        >();
        for (const row of rows) {
          blindModes.set(row.id, row.blindReviewMode);
        }
        blindedItems = items.map((item) => {
          const mode = item.submissionPeriodId
            ? (blindModes.get(item.submissionPeriodId) ?? 'none')
            : 'none';
          return applySubmitterBlinding(item, mode, callerRole);
        });
      }
    }

    const total = countResult[0]?.count ?? 0;
    return {
      items: blindedItems,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  },

  /**
   * Export all matching submissions (no pagination) for data export.
   * Safety cap of 10,000 rows.
   */
  async exportAll(
    tx: DrizzleDb,
    input: ExportSubmissionsInput,
    callerRole?: import('@colophony/types').Role,
  ) {
    const MAX_EXPORT_ROWS = 10000;

    const conditions = [];
    if (input.status) conditions.push(eq(submissions.status, input.status));
    if (input.submissionPeriodId)
      conditions.push(
        eq(submissions.submissionPeriodId, input.submissionPeriodId),
      );
    if (input.search) {
      if (input.search.length >= 3) {
        conditions.push(
          sql`${submissions.searchVector} @@ plainto_tsquery('english', ${input.search})`,
        );
      } else {
        conditions.push(ilike(submissions.title, `%${input.search}%`));
      }
    }

    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const items = await tx
      .select({
        id: submissions.id,
        organizationId: submissions.organizationId,
        submitterId: submissions.submitterId,
        submissionPeriodId: submissions.submissionPeriodId,
        title: submissions.title,
        content: submissions.content,
        coverLetter: submissions.coverLetter,
        formDefinitionId: submissions.formDefinitionId,
        formData: submissions.formData,
        manuscriptVersionId: submissions.manuscriptVersionId,
        status: submissions.status,
        submittedAt: submissions.submittedAt,
        createdAt: submissions.createdAt,
        updatedAt: submissions.updatedAt,
        submitterEmail: users.email,
        periodName: submissionPeriods.name,
      })
      .from(submissions)
      .leftJoin(users, eq(users.id, submissions.submitterId))
      .leftJoin(
        submissionPeriods,
        eq(submissionPeriods.id, submissions.submissionPeriodId),
      )
      .where(where)
      .orderBy(desc(submissions.createdAt))
      .limit(MAX_EXPORT_ROWS);

    // Apply blind review
    if (callerRole && callerRole !== 'ADMIN') {
      const periodIds = [
        ...new Set(
          items
            .map((i) => i.submissionPeriodId)
            .filter((id): id is string => id != null),
        ),
      ];

      if (periodIds.length > 0) {
        const rows = await tx
          .select({
            id: submissionPeriods.id,
            blindReviewMode: submissionPeriods.blindReviewMode,
          })
          .from(submissionPeriods)
          .where(inArray(submissionPeriods.id, periodIds));
        const blindModes = new Map<
          string,
          import('@colophony/types').BlindReviewMode
        >();
        for (const row of rows) {
          blindModes.set(row.id, row.blindReviewMode);
        }
        return items.map((item) => {
          const mode = item.submissionPeriodId
            ? (blindModes.get(item.submissionPeriodId) ?? 'none')
            : 'none';
          return applySubmitterBlinding(item, mode, callerRole);
        });
      }
    }

    return items;
  },

  /**
   * Create a new submission in DRAFT status with initial history record.
   */
  async create(
    tx: DrizzleDb,
    input: CreateSubmissionInput,
    orgId: string,
    submitterId: string,
  ) {
    await assertNotMigrated(submitterId);

    let resolvedFormDefinitionId = input.formDefinitionId ?? null;

    // Validate submission period exists under RLS (prevents cross-tenant refs)
    if (input.submissionPeriodId) {
      const [period] = await tx
        .select()
        .from(submissionPeriods)
        .where(eq(submissionPeriods.id, input.submissionPeriodId))
        .limit(1);

      if (!period) {
        throw new NotFoundError(
          `Submission period "${input.submissionPeriodId}" not found`,
        );
      }

      // Inherit formDefinitionId from period if not explicitly provided
      if (!resolvedFormDefinitionId && period.formDefinitionId) {
        resolvedFormDefinitionId = period.formDefinitionId;
      }

      // Enforce match when both are provided and period has a form
      if (
        resolvedFormDefinitionId &&
        period.formDefinitionId &&
        resolvedFormDefinitionId !== period.formDefinitionId
      ) {
        throw new FormDefinitionMismatchError(
          resolvedFormDefinitionId,
          period.formDefinitionId,
        );
      }
    }

    // Validate form reference exists and is PUBLISHED
    if (resolvedFormDefinitionId) {
      const [form] = await tx
        .select()
        .from(formDefinitions)
        .where(eq(formDefinitions.id, resolvedFormDefinitionId))
        .limit(1);

      if (!form) throw new FormNotFoundError(resolvedFormDefinitionId);
      if (form.status !== 'PUBLISHED') throw new FormNotPublishedError();
    }

    // Validate manuscript version ownership if provided
    if (input.manuscriptVersionId) {
      const [version] = await tx
        .select({
          id: manuscriptVersions.id,
          ownerId: manuscripts.ownerId,
        })
        .from(manuscriptVersions)
        .innerJoin(
          manuscripts,
          eq(manuscriptVersions.manuscriptId, manuscripts.id),
        )
        .where(eq(manuscriptVersions.id, input.manuscriptVersionId))
        .limit(1);

      if (!version) {
        throw new SubmissionNotFoundError(input.manuscriptVersionId);
      }
      if (version.ownerId !== submitterId) {
        throw new ForbiddenError(
          'Manuscript version does not belong to the submitter',
        );
      }
    }

    const [submission] = await tx
      .insert(submissions)
      .values({
        organizationId: orgId,
        submitterId,
        title: input.title,
        content: input.content ?? null,
        coverLetter: input.coverLetter ?? null,
        submissionPeriodId: input.submissionPeriodId ?? null,
        formDefinitionId: resolvedFormDefinitionId,
        formData: input.formData ?? null,
        manuscriptVersionId: input.manuscriptVersionId ?? null,
        status: 'DRAFT',
      })
      .returning();

    await tx.insert(submissionHistory).values({
      submissionId: submission.id,
      fromStatus: null,
      toStatus: 'DRAFT',
      changedBy: submitterId,
    });

    return submission;
  },

  /**
   * Get submission by ID with files and submitter email.
   */
  async getById(tx: DrizzleDb, id: string) {
    const [submission] = await tx
      .select()
      .from(submissions)
      .where(eq(submissions.id, id))
      .limit(1);

    if (!submission) return null;

    // Get files via manuscript version (if attached) + manuscript info
    const [versionFiles, [submitter], manuscriptInfo] = await Promise.all([
      submission.manuscriptVersionId
        ? tx
            .select()
            .from(files)
            .where(
              eq(files.manuscriptVersionId, submission.manuscriptVersionId),
            )
            .orderBy(asc(files.uploadedAt))
        : Promise.resolve([]),
      submission.submitterId
        ? tx
            .select({ email: users.email })
            .from(users)
            .where(eq(users.id, submission.submitterId))
            .limit(1)
        : Promise.resolve([]),
      submission.manuscriptVersionId
        ? tx
            .select({
              manuscriptId: manuscripts.id,
              manuscriptTitle: manuscripts.title,
              versionNumber: manuscriptVersions.versionNumber,
            })
            .from(manuscriptVersions)
            .innerJoin(
              manuscripts,
              eq(manuscriptVersions.manuscriptId, manuscripts.id),
            )
            .where(eq(manuscriptVersions.id, submission.manuscriptVersionId))
            .limit(1)
            .then((rows) => rows[0] ?? null)
        : Promise.resolve(null),
    ]);

    return {
      ...submission,
      files: versionFiles,
      submitterEmail: submitter?.email ?? null,
      manuscript: manuscriptInfo,
    };
  },

  /**
   * Update a submission (DRAFT only). Uses FOR UPDATE lock.
   */
  async update(tx: DrizzleDb, id: string, input: UpdateSubmissionInput) {
    const rows = await tx.execute<{
      id: string;
      status: string;
    }>(sql`SELECT id, status FROM submissions WHERE id = ${id} FOR UPDATE`);

    const existing = rows.rows[0];
    if (!existing) return null;
    if (existing.status !== 'DRAFT') throw new NotDraftError();

    const [updated] = await tx
      .update(submissions)
      .set({
        ...(input.title !== undefined ? { title: input.title } : {}),
        ...(input.content !== undefined ? { content: input.content } : {}),
        ...(input.coverLetter !== undefined
          ? { coverLetter: input.coverLetter }
          : {}),
        ...(input.formData !== undefined ? { formData: input.formData } : {}),
        updatedAt: new Date(),
      })
      .where(eq(submissions.id, id))
      .returning();

    return updated ?? null;
  },

  /**
   * Transition submission status with validation and history tracking.
   */
  async updateStatus(
    tx: DrizzleDb,
    id: string,
    newStatus: SubmissionStatus,
    changedBy: string,
    comment: string | undefined,
    callerRole: 'submitter' | 'editor',
  ) {
    const rows = await tx.execute<{
      id: string;
      status: SubmissionStatus;
      form_definition_id: string | null;
      form_data: Record<string, unknown> | null;
      manuscript_version_id: string | null;
    }>(
      sql`SELECT id, status, form_definition_id, form_data, manuscript_version_id FROM submissions WHERE id = ${id} FOR UPDATE`,
    );

    const existing = rows.rows[0];
    if (!existing) throw new SubmissionNotFoundError(id);

    const fromStatus = existing.status;

    // Validate transition based on caller role
    if (callerRole === 'submitter') {
      if (!isValidStatusTransition(fromStatus, newStatus)) {
        throw new InvalidStatusTransitionError(fromStatus, newStatus);
      }
    } else {
      if (!isEditorAllowedTransition(fromStatus, newStatus)) {
        throw new InvalidStatusTransitionError(fromStatus, newStatus);
      }
    }

    // On DRAFT→SUBMITTED, verify file scan statuses via manuscript version
    if (fromStatus === 'DRAFT' && newStatus === 'SUBMITTED') {
      if (existing.manuscript_version_id) {
        const versionFiles = await tx
          .select({ scanStatus: files.scanStatus })
          .from(files)
          .where(eq(files.manuscriptVersionId, existing.manuscript_version_id));

        const hasUnscanned = versionFiles.some(
          (f) => f.scanStatus === 'PENDING' || f.scanStatus === 'SCANNING',
        );
        if (hasUnscanned) throw new UnscannedFilesError();

        const hasInfected = versionFiles.some(
          (f) => f.scanStatus === 'INFECTED',
        );
        if (hasInfected) throw new InfectedFilesError();
      }

      // Validate form data against the form definition
      if (existing.form_definition_id) {
        const errors = await formService.validateFormData(
          tx,
          existing.form_definition_id,
          (existing.form_data as Record<string, unknown>) ?? {},
        );
        if (errors.length > 0) throw new InvalidFormDataError(errors);
      }
    }

    const updateData: Record<string, unknown> = {
      status: newStatus,
      updatedAt: new Date(),
    };
    if (newStatus === 'SUBMITTED') {
      updateData.submittedAt = new Date();
    }

    const [submission] = await tx
      .update(submissions)
      .set(updateData)
      .where(eq(submissions.id, id))
      .returning();

    const [historyEntry] = await tx
      .insert(submissionHistory)
      .values({
        submissionId: id,
        fromStatus,
        toStatus: newStatus,
        changedBy,
        comment: comment ?? null,
      })
      .returning();

    return { submission, historyEntry };
  },

  /**
   * Delete a submission (DRAFT only). Uses FOR UPDATE lock.
   * CASCADE handles children (files, history).
   */
  async delete(tx: DrizzleDb, id: string) {
    const rows = await tx.execute<{
      id: string;
      status: string;
    }>(sql`SELECT id, status FROM submissions WHERE id = ${id} FOR UPDATE`);

    const existing = rows.rows[0];
    if (!existing) return null;
    if (existing.status !== 'DRAFT') throw new NotDraftError();

    const [deleted] = await tx
      .delete(submissions)
      .where(eq(submissions.id, id))
      .returning();

    return deleted ?? null;
  },

  /**
   * Get submission history ordered by changedAt ASC.
   */
  async getHistory(tx: DrizzleDb, submissionId: string) {
    return tx
      .select()
      .from(submissionHistory)
      .where(eq(submissionHistory.submissionId, submissionId))
      .orderBy(asc(submissionHistory.changedAt));
  },

  // ---------------------------------------------------------------------------
  // Access-aware methods (PR 2) — bundle access control + audit
  // ---------------------------------------------------------------------------

  /**
   * Get submission by ID with owner-or-editor access check.
   */
  async getByIdWithAccess(svc: ServiceContext, id: string) {
    const submission = await submissionService.getById(svc.tx, id);
    if (!submission) throw new SubmissionNotFoundError(id);
    assertOwnerOrEditor(
      svc.actor.userId,
      svc.actor.role,
      submission.submitterId,
    );

    // Apply blind review if caller is not the submitter
    if (submission.submitterId !== svc.actor.userId) {
      const blindMode = await resolveBlindMode(
        svc.tx,
        submission.submissionPeriodId,
      );
      return applySubmitterBlinding(submission, blindMode, svc.actor.role);
    }

    return submission;
  },

  /**
   * Create a new submission with audit logging.
   */
  async createWithAudit(svc: ServiceContext, input: CreateSubmissionInput) {
    const submission = await submissionService.create(
      svc.tx,
      input,
      svc.actor.orgId,
      svc.actor.userId,
    );
    await svc.audit({
      action: AuditActions.SUBMISSION_CREATED,
      resource: AuditResources.SUBMISSION,
      resourceId: submission.id,
      newValue: { title: input.title },
    });
    return submission;
  },

  /**
   * Update a DRAFT submission — owner only, with audit.
   */
  async updateAsOwner(
    svc: ServiceContext,
    id: string,
    data: UpdateSubmissionInput,
  ) {
    const existing = await submissionService.getById(svc.tx, id);
    if (!existing) throw new SubmissionNotFoundError(id);
    if (existing.submitterId !== svc.actor.userId) {
      throw new ForbiddenError('Only the submitter can update this submission');
    }
    const updated = await submissionService.update(svc.tx, id, data);
    if (!updated) throw new SubmissionNotFoundError(id);
    await svc.audit({
      action: AuditActions.SUBMISSION_UPDATED,
      resource: AuditResources.SUBMISSION,
      resourceId: id,
      newValue: data,
    });
    return updated;
  },

  /**
   * Submit a DRAFT submission (DRAFT→SUBMITTED) — owner only, with audit.
   */
  async submitAsOwner(svc: ServiceContext, id: string) {
    await assertNotMigrated(svc.actor.userId);

    const existing = await submissionService.getById(svc.tx, id);
    if (!existing) throw new SubmissionNotFoundError(id);
    if (existing.submitterId !== svc.actor.userId) {
      throw new ForbiddenError('Only the submitter can submit this submission');
    }
    const result = await submissionService.updateStatus(
      svc.tx,
      id,
      'SUBMITTED',
      svc.actor.userId,
      undefined,
      'submitter',
    );
    await svc.audit({
      action: AuditActions.SUBMISSION_SUBMITTED,
      resource: AuditResources.SUBMISSION,
      resourceId: id,
    });
    await enqueueOutboxEvent(svc.tx, 'hopper/submission.submitted', {
      orgId: svc.actor.orgId,
      submissionId: id,
      submitterId: svc.actor.userId,
    });
    return result;
  },

  /**
   * Delete a DRAFT submission — owner only, with audit.
   */
  async deleteAsOwner(svc: ServiceContext, id: string) {
    const existing = await submissionService.getById(svc.tx, id);
    if (!existing) throw new SubmissionNotFoundError(id);
    if (existing.submitterId !== svc.actor.userId) {
      throw new ForbiddenError('Only the submitter can delete this submission');
    }
    const deleted = await submissionService.delete(svc.tx, id);
    if (!deleted) throw new SubmissionNotFoundError(id);
    await svc.audit({
      action: AuditActions.SUBMISSION_DELETED,
      resource: AuditResources.SUBMISSION,
      resourceId: id,
    });
    return { success: true as const };
  },

  /**
   * Withdraw a submission — owner only, with audit.
   */
  async withdrawAsOwner(svc: ServiceContext, id: string) {
    const existing = await submissionService.getById(svc.tx, id);
    if (!existing) throw new SubmissionNotFoundError(id);
    if (existing.submitterId !== svc.actor.userId) {
      throw new ForbiddenError(
        'Only the submitter can withdraw this submission',
      );
    }
    const result = await submissionService.updateStatus(
      svc.tx,
      id,
      'WITHDRAWN',
      svc.actor.userId,
      undefined,
      'submitter',
    );
    await svc.audit({
      action: AuditActions.SUBMISSION_WITHDRAWN,
      resource: AuditResources.SUBMISSION,
      resourceId: id,
    });
    await enqueueOutboxEvent(svc.tx, 'hopper/submission.withdrawn', {
      orgId: svc.actor.orgId,
      submissionId: id,
      submitterId: existing.submitterId,
    });
    return result;
  },

  /**
   * Editor/admin status transition with audit.
   */
  async updateStatusAsEditor(
    svc: ServiceContext,
    id: string,
    status: SubmissionStatus,
    comment: string | undefined,
  ) {
    assertEditorOrAdmin(svc.actor.role);

    // R&R requires revision notes
    if (status === 'REVISE_AND_RESUBMIT' && !comment?.trim()) {
      throw new MissingRevisionNotesError();
    }

    // Fetch submitterId before the update for notification routing
    const existing = await submissionService.getById(svc.tx, id);
    if (!existing) throw new SubmissionNotFoundError(id);

    const result = await submissionService.updateStatus(
      svc.tx,
      id,
      status,
      svc.actor.userId,
      comment,
      'editor',
    );
    await svc.audit({
      action: AuditActions.SUBMISSION_STATUS_CHANGED,
      resource: AuditResources.SUBMISSION,
      resourceId: id,
      newValue: { status, comment },
    });

    // Enqueue notification events for acceptance/rejection
    if (status === 'ACCEPTED') {
      await enqueueOutboxEvent(svc.tx, 'hopper/submission.accepted', {
        orgId: svc.actor.orgId,
        submissionId: id,
        submitterId: existing.submitterId,
        comment,
      });
    } else if (status === 'REJECTED') {
      await enqueueOutboxEvent(svc.tx, 'hopper/submission.rejected', {
        orgId: svc.actor.orgId,
        submissionId: id,
        submitterId: existing.submitterId,
        comment,
      });
    } else if (status === 'REVISE_AND_RESUBMIT') {
      await enqueueOutboxEvent(
        svc.tx,
        'hopper/submission.revise_and_resubmit',
        {
          orgId: svc.actor.orgId,
          submissionId: id,
          submitterId: existing.submitterId,
          comment: comment!,
        },
      );
    }

    return result;
  },

  /**
   * Resubmit with a new manuscript version from REVISE_AND_RESUBMIT — owner only.
   */
  async resubmitAsOwner(
    svc: ServiceContext,
    id: string,
    manuscriptVersionId: string,
  ) {
    const existing = await submissionService.getById(svc.tx, id);
    if (!existing) throw new SubmissionNotFoundError(id);
    if (existing.submitterId !== svc.actor.userId) {
      throw new ForbiddenError(
        'Only the submitter can resubmit this submission',
      );
    }
    if (existing.status !== 'REVISE_AND_RESUBMIT') {
      throw new NotReviseAndResubmitError();
    }

    // Verify ownership of new manuscript version
    const [version] = await svc.tx
      .select({
        id: manuscriptVersions.id,
        ownerId: manuscripts.ownerId,
      })
      .from(manuscriptVersions)
      .innerJoin(
        manuscripts,
        eq(manuscriptVersions.manuscriptId, manuscripts.id),
      )
      .where(eq(manuscriptVersions.id, manuscriptVersionId))
      .limit(1);

    if (!version) {
      throw new SubmissionNotFoundError(manuscriptVersionId);
    }
    if (version.ownerId !== svc.actor.userId) {
      throw new ForbiddenError(
        'Manuscript version does not belong to the submitter',
      );
    }

    // Validate scan status on new version's files
    const versionFiles = await svc.tx
      .select({ scanStatus: files.scanStatus })
      .from(files)
      .where(eq(files.manuscriptVersionId, manuscriptVersionId));

    const hasUnscanned = versionFiles.some(
      (f) => f.scanStatus === 'PENDING' || f.scanStatus === 'SCANNING',
    );
    if (hasUnscanned) throw new UnscannedFilesError();

    const hasInfected = versionFiles.some((f) => f.scanStatus === 'INFECTED');
    if (hasInfected) throw new InfectedFilesError();

    // Update manuscript version on submission
    await svc.tx
      .update(submissions)
      .set({ manuscriptVersionId, updatedAt: new Date() })
      .where(eq(submissions.id, id));

    // Transition to SUBMITTED
    const result = await submissionService.updateStatus(
      svc.tx,
      id,
      'SUBMITTED',
      svc.actor.userId,
      undefined,
      'submitter',
    );

    await svc.audit({
      action: AuditActions.SUBMISSION_SUBMITTED,
      resource: AuditResources.SUBMISSION,
      resourceId: id,
      newValue: { manuscriptVersionId, resubmit: true },
    });

    await enqueueOutboxEvent(svc.tx, 'hopper/submission.submitted', {
      orgId: svc.actor.orgId,
      submissionId: id,
      submitterId: svc.actor.userId,
    });

    return result;
  },

  /**
   * Get submission history — owner or editor/admin access check.
   */
  async getHistoryWithAccess(svc: ServiceContext, submissionId: string) {
    const submission = await submissionService.getById(svc.tx, submissionId);
    if (!submission) throw new SubmissionNotFoundError(submissionId);
    assertOwnerOrEditor(
      svc.actor.userId,
      svc.actor.role,
      submission.submitterId,
    );
    return submissionService.getHistory(svc.tx, submissionId);
  },

  // ---------------------------------------------------------------------------
  // Batch operations (editor/admin only)
  // ---------------------------------------------------------------------------

  /**
   * Batch status change with partial success support.
   * Pass 1: SELECT FOR UPDATE + validate transitions.
   * Pass 2: apply updates + history + audit + outbox for valid submissions.
   */
  async batchUpdateStatusAsEditor(
    svc: ServiceContext,
    input: BatchStatusChangeInput,
  ): Promise<BatchStatusChangeResponse> {
    assertEditorOrAdmin(svc.actor.role);

    const { submissionIds, status, comment } = input;

    // R&R requires revision notes
    if (status === 'REVISE_AND_RESUBMIT' && !comment?.trim()) {
      throw new MissingRevisionNotesError();
    }

    // Pass 1: Lock and fetch all submissions via Drizzle (goes through RLS)
    const rows = await svc.tx
      .select({
        id: submissions.id,
        status: submissions.status,
        submitterId: submissions.submitterId,
      })
      .from(submissions)
      .where(inArray(submissions.id, submissionIds))
      .for('update');

    const foundMap = new Map(
      rows.map((r) => [
        r.id,
        {
          id: r.id,
          status: r.status,
          submitterId: r.submitterId,
        },
      ]),
    );

    const succeeded: BatchStatusChangeResponse['succeeded'] = [];
    const failed: BatchStatusChangeResponse['failed'] = [];

    // Partition: missing IDs and invalid transitions
    for (const id of submissionIds) {
      const row = foundMap.get(id);
      if (!row) {
        failed.push({ submissionId: id, error: 'Submission not found' });
        continue;
      }
      if (!isEditorAllowedTransition(row.status, status)) {
        failed.push({
          submissionId: id,
          error: `Invalid transition from "${row.status}" to "${status}"`,
        });
        continue;
      }

      // Pass 2: Apply update
      await svc.tx
        .update(submissions)
        .set({ status, updatedAt: new Date() })
        .where(eq(submissions.id, id));

      await svc.tx.insert(submissionHistory).values({
        submissionId: id,
        fromStatus: row.status,
        toStatus: status,
        changedBy: svc.actor.userId,
        comment: comment ?? null,
      });

      await svc.audit({
        action: AuditActions.SUBMISSION_STATUS_CHANGED,
        resource: AuditResources.SUBMISSION,
        resourceId: id,
        newValue: { status, comment },
      });

      // Enqueue outbox events for terminal/notification statuses
      if (status === 'ACCEPTED') {
        await enqueueOutboxEvent(svc.tx, 'hopper/submission.accepted', {
          orgId: svc.actor.orgId,
          submissionId: id,
          submitterId: row.submitterId,
          comment,
        });
      } else if (status === 'REJECTED') {
        await enqueueOutboxEvent(svc.tx, 'hopper/submission.rejected', {
          orgId: svc.actor.orgId,
          submissionId: id,
          submitterId: row.submitterId,
          comment,
        });
      } else if (status === 'REVISE_AND_RESUBMIT') {
        // comment! is safe: R&R without comment is rejected at the top of this method
        await enqueueOutboxEvent(
          svc.tx,
          'hopper/submission.revise_and_resubmit',
          {
            orgId: svc.actor.orgId,
            submissionId: id,
            submitterId: row.submitterId,
            comment: comment!,
          },
        );
      }

      succeeded.push({
        submissionId: id,
        previousStatus: row.status,
        status,
      });
    }

    return { succeeded, failed };
  },

  /**
   * Batch assign reviewers with partial success support.
   * Validates reviewer org membership first (fails fast), then assigns
   * to each submission individually.
   */
  async batchAssignReviewersAsEditor(
    svc: ServiceContext,
    input: BatchAssignReviewersInput,
  ): Promise<BatchAssignReviewersResponse> {
    assertEditorOrAdmin(svc.actor.role);

    const { submissionIds, reviewerUserIds } = input;

    // Fail fast: validate all reviewers are org members
    await submissionReviewerService.validateOrgMembership(
      svc.tx,
      svc.actor.orgId,
      reviewerUserIds,
    );

    // Fetch existing submissions
    const rows = await svc.tx
      .select({ id: submissions.id })
      .from(submissions)
      .where(inArray(submissions.id, submissionIds));

    const foundIds = new Set(rows.map((r) => r.id));

    const succeeded: BatchAssignReviewersResponse['succeeded'] = [];
    const failed: BatchAssignReviewersResponse['failed'] = [];

    for (const id of submissionIds) {
      if (!foundIds.has(id)) {
        failed.push({ submissionId: id, error: 'Submission not found' });
        continue;
      }

      // Individual inserts: intentional for per-reviewer error handling
      // (e.g., skip already-assigned). Worst case: reviewerUserIds.length * submissionIds.length inserts.
      let assignedCount = 0;
      for (const reviewerUserId of reviewerUserIds) {
        try {
          await submissionReviewerService.assign(
            svc.tx,
            svc.actor.orgId,
            id,
            reviewerUserId,
            svc.actor.userId,
          );
          assignedCount++;

          await svc.audit({
            resource: AuditResources.SUBMISSION,
            action: AuditActions.REVIEWER_ASSIGNED,
            resourceId: id,
            newValue: { reviewerUserId },
          });
        } catch (err) {
          // Skip already-assigned reviewers
          if (err instanceof ReviewerAlreadyAssignedError) {
            continue;
          }
          throw err;
        }
      }

      succeeded.push({ submissionId: id, assignedCount });
    }

    return { succeeded, failed };
  },
};
