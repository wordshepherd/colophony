import {
  submissionReviewers,
  submissions,
  organizationMembers,
  users,
  eq,
  and,
  isNull,
  type DrizzleDb,
} from '@colophony/db';
import { inArray } from 'drizzle-orm';
import { AuditActions, AuditResources } from '@colophony/types';
import type { SubmissionReviewer } from '@colophony/types';
import { enqueueOutboxEvent } from './outbox.js';
import type { ServiceContext } from './types.js';
import { assertEditorOrAdmin, assertOwnerOrEditor } from './errors.js';
import { SubmissionNotFoundError } from './submission.service.js';
import {
  resolveBlindMode,
  applyReviewerBlinding,
} from './blind-review.helper.js';

// ---------------------------------------------------------------------------
// Error classes
// ---------------------------------------------------------------------------

export class ReviewerAlreadyAssignedError extends Error {
  constructor(reviewerUserId: string) {
    super(
      `Reviewer "${reviewerUserId}" is already assigned to this submission`,
    );
    this.name = 'ReviewerAlreadyAssignedError';
  }
}

export class ReviewerNotAssignedError extends Error {
  constructor(reviewerUserId: string) {
    super(`Reviewer "${reviewerUserId}" is not assigned to this submission`);
    this.name = 'ReviewerNotAssignedError';
  }
}

export class ReviewerNotOrgMemberError extends Error {
  constructor(reviewerUserId: string) {
    super(`User "${reviewerUserId}" is not a member of this organization`);
    this.name = 'ReviewerNotOrgMemberError';
  }
}

// ---------------------------------------------------------------------------
// Pure data methods (accept DrizzleDb tx)
// ---------------------------------------------------------------------------

async function assign(
  tx: DrizzleDb,
  orgId: string,
  submissionId: string,
  reviewerUserId: string,
  assignedBy: string,
) {
  try {
    const [row] = await tx
      .insert(submissionReviewers)
      .values({
        organizationId: orgId,
        submissionId,
        reviewerUserId,
        assignedBy,
      })
      .returning();
    return row;
  } catch (error: unknown) {
    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as { code: string }).code === '23505'
    ) {
      throw new ReviewerAlreadyAssignedError(reviewerUserId);
    }
    throw error;
  }
}

async function unassign(
  tx: DrizzleDb,
  submissionId: string,
  reviewerUserId: string,
): Promise<void> {
  const deleted = await tx
    .delete(submissionReviewers)
    .where(
      and(
        eq(submissionReviewers.submissionId, submissionId),
        eq(submissionReviewers.reviewerUserId, reviewerUserId),
      ),
    )
    .returning({ id: submissionReviewers.id });

  if (deleted.length === 0) {
    throw new ReviewerNotAssignedError(reviewerUserId);
  }
}

async function listBySubmission(
  tx: DrizzleDb,
  submissionId: string,
): Promise<SubmissionReviewer[]> {
  const rows = await tx
    .select({
      id: submissionReviewers.id,
      submissionId: submissionReviewers.submissionId,
      reviewerUserId: submissionReviewers.reviewerUserId,
      reviewerEmail: users.email,
      reviewerRole: organizationMembers.roles,
      assignedBy: submissionReviewers.assignedBy,
      assignedAt: submissionReviewers.assignedAt,
      readAt: submissionReviewers.readAt,
    })
    .from(submissionReviewers)
    .innerJoin(users, eq(users.id, submissionReviewers.reviewerUserId))
    .innerJoin(
      organizationMembers,
      and(
        eq(organizationMembers.userId, submissionReviewers.reviewerUserId),
        eq(
          organizationMembers.organizationId,
          submissionReviewers.organizationId,
        ),
      ),
    )
    .where(eq(submissionReviewers.submissionId, submissionId));

  // Map roles array to single reviewerRole for type compatibility
  return rows.map((r) => ({
    ...r,
    reviewerRole: r.reviewerRole[0] ?? 'READER',
  }));
}

async function markRead(
  tx: DrizzleDb,
  submissionId: string,
  userId: string,
): Promise<boolean> {
  const updated = await tx
    .update(submissionReviewers)
    .set({ readAt: new Date() })
    .where(
      and(
        eq(submissionReviewers.submissionId, submissionId),
        eq(submissionReviewers.reviewerUserId, userId),
        isNull(submissionReviewers.readAt),
      ),
    )
    .returning({ id: submissionReviewers.id });

  return updated.length > 0;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function getSubmissionOrThrow(tx: DrizzleDb, submissionId: string) {
  const [submission] = await tx
    .select({
      id: submissions.id,
      submitterId: submissions.submitterId,
      organizationId: submissions.organizationId,
      submissionPeriodId: submissions.submissionPeriodId,
    })
    .from(submissions)
    .where(eq(submissions.id, submissionId))
    .limit(1);

  if (!submission) throw new SubmissionNotFoundError(submissionId);
  return submission;
}

async function validateOrgMembership(
  tx: DrizzleDb,
  orgId: string,
  userIds: string[],
): Promise<void> {
  const members = await tx
    .select({ userId: organizationMembers.userId })
    .from(organizationMembers)
    .where(
      and(
        eq(organizationMembers.organizationId, orgId),
        inArray(organizationMembers.userId, userIds),
      ),
    );

  const memberSet = new Set(members.map((m) => m.userId));
  for (const userId of userIds) {
    if (!memberSet.has(userId)) {
      throw new ReviewerNotOrgMemberError(userId);
    }
  }
}

// ---------------------------------------------------------------------------
// Access-aware methods (accept ServiceContext)
// ---------------------------------------------------------------------------

async function assignWithAudit(
  svc: ServiceContext,
  submissionId: string,
  reviewerUserIds: string[],
): Promise<SubmissionReviewer[]> {
  assertEditorOrAdmin(svc.actor.roles);

  await getSubmissionOrThrow(svc.tx, submissionId);
  await validateOrgMembership(svc.tx, svc.actor.orgId, reviewerUserIds);

  const results: SubmissionReviewer[] = [];
  for (const reviewerUserId of reviewerUserIds) {
    const row = await assign(
      svc.tx,
      svc.actor.orgId,
      submissionId,
      reviewerUserId,
      svc.actor.userId,
    );

    await svc.audit({
      resource: AuditResources.SUBMISSION,
      action: AuditActions.REVIEWER_ASSIGNED,
      resourceId: submissionId,
      newValue: { reviewerUserId },
    });

    await enqueueOutboxEvent(svc.tx, 'hopper/reviewer.assigned', {
      orgId: svc.actor.orgId,
      submissionId,
      reviewerUserId,
      assignedBy: svc.actor.userId,
    });

    // Build the full result with email/role via a re-read
    results.push({
      ...row,
      submissionId: row.submissionId,
      reviewerUserId: row.reviewerUserId,
      reviewerEmail: '', // will be filled below
      reviewerRole: 'READER' as const,
      assignedBy: row.assignedBy,
      assignedAt: row.assignedAt,
      readAt: row.readAt,
    });
  }

  // Re-read full list with JOINs for complete data
  return listBySubmission(svc.tx, submissionId);
}

async function unassignWithAudit(
  svc: ServiceContext,
  submissionId: string,
  reviewerUserId: string,
): Promise<void> {
  assertEditorOrAdmin(svc.actor.roles);
  await getSubmissionOrThrow(svc.tx, submissionId);
  await unassign(svc.tx, submissionId, reviewerUserId);

  await svc.audit({
    resource: AuditResources.SUBMISSION,
    action: AuditActions.REVIEWER_UNASSIGNED,
    resourceId: submissionId,
    newValue: { reviewerUserId },
  });
}

async function listBySubmissionWithAccess(
  svc: ServiceContext,
  submissionId: string,
): Promise<SubmissionReviewer[]> {
  const submission = await getSubmissionOrThrow(svc.tx, submissionId);
  assertOwnerOrEditor(
    svc.actor.userId,
    svc.actor.roles,
    submission.submitterId,
  );
  const reviewers = await listBySubmission(svc.tx, submissionId);

  const blindMode = await resolveBlindMode(
    svc.tx,
    submission.submissionPeriodId,
  );
  return reviewers.map((r) =>
    applyReviewerBlinding(r, blindMode, svc.actor.roles),
  );
}

async function markReadWithAudit(
  svc: ServiceContext,
  submissionId: string,
): Promise<{ success: true }> {
  const updated = await markRead(svc.tx, submissionId, svc.actor.userId);

  if (updated) {
    await svc.audit({
      resource: AuditResources.SUBMISSION,
      action: AuditActions.REVIEWER_READ,
      resourceId: submissionId,
    });
  }

  return { success: true };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export const submissionReviewerService = {
  assign,
  unassign,
  listBySubmission,
  markRead,
  validateOrgMembership,
  assignWithAudit,
  unassignWithAudit,
  listBySubmissionWithAccess,
  markReadWithAudit,
};
