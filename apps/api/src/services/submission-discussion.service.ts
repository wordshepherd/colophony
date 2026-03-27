import sanitizeHtml from 'sanitize-html';
import {
  submissionDiscussions,
  submissionReviewers,
  submissions,
  users,
  eq,
  and,
  type DrizzleDb,
} from '@colophony/db';
import { sql } from 'drizzle-orm';
import { AuditActions, AuditResources } from '@colophony/types';
import type { SubmissionDiscussion } from '@colophony/types';
import { enqueueOutboxEvent } from './outbox.js';
import type { ServiceContext } from './types.js';
import { ForbiddenError } from './errors.js';
import { SubmissionNotFoundError } from './submission.service.js';
import {
  resolveBlindMode,
  applyAuthorBlinding,
} from './blind-review.helper.js';

// ---------------------------------------------------------------------------
// Error classes
// ---------------------------------------------------------------------------

export class DiscussionCommentNotFoundError extends Error {
  constructor(commentId: string) {
    super(`Discussion comment "${commentId}" not found`);
    this.name = 'DiscussionCommentNotFoundError';
  }
}

export class DiscussionParentNotFoundError extends Error {
  constructor(parentId: string) {
    super(`Discussion parent comment "${parentId}" not found`);
    this.name = 'DiscussionParentNotFoundError';
  }
}

// ---------------------------------------------------------------------------
// HTML sanitization (same allowlist as Tiptap templates)
// ---------------------------------------------------------------------------

function sanitizeContent(html: string): string {
  return sanitizeHtml(html, {
    allowedTags: [
      'p',
      'br',
      'strong',
      'b',
      'em',
      'i',
      'u',
      'a',
      'ul',
      'ol',
      'li',
      'blockquote',
      'h1',
      'h2',
      'h3',
    ],
    allowedAttributes: {
      a: ['href', 'target', 'rel'],
    },
    allowedSchemes: ['http', 'https', 'mailto'],
  });
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

/**
 * Assert the caller is an EDITOR, ADMIN, or an assigned reviewer for the
 * submission. Submitters (owners) are explicitly rejected.
 */
async function assertEditorAdminOrReviewer(
  tx: DrizzleDb,
  actorRoles: readonly string[],
  actorUserId: string,
  submissionId: string,
  submitterId: string | null,
): Promise<void> {
  // Owners must not access internal discussion
  if (submitterId && actorUserId === submitterId) {
    throw new ForbiddenError(
      'Submitters cannot access the internal discussion',
    );
  }

  if (actorRoles.includes('ADMIN') || actorRoles.includes('EDITOR')) return;

  if (actorRoles.includes('READER')) {
    const [reviewer] = await tx
      .select({ id: submissionReviewers.id })
      .from(submissionReviewers)
      .where(
        and(
          eq(submissionReviewers.submissionId, submissionId),
          eq(submissionReviewers.reviewerUserId, actorUserId),
        ),
      )
      .limit(1);

    if (reviewer) return;
  }

  throw new ForbiddenError(
    'Only editors, admins, and assigned reviewers can access the discussion',
  );
}

// ---------------------------------------------------------------------------
// Pure data methods (accept DrizzleDb tx)
// ---------------------------------------------------------------------------

async function listBySubmission(
  tx: DrizzleDb,
  submissionId: string,
): Promise<SubmissionDiscussion[]> {
  const rows = await tx
    .select({
      id: submissionDiscussions.id,
      submissionId: submissionDiscussions.submissionId,
      authorId: submissionDiscussions.authorId,
      authorEmail: users.email,
      parentId: submissionDiscussions.parentId,
      content: submissionDiscussions.content,
      createdAt: submissionDiscussions.createdAt,
      updatedAt: submissionDiscussions.updatedAt,
    })
    .from(submissionDiscussions)
    .leftJoin(users, eq(users.id, submissionDiscussions.authorId))
    .where(eq(submissionDiscussions.submissionId, submissionId))
    .orderBy(submissionDiscussions.createdAt);

  return rows;
}

async function create(
  tx: DrizzleDb,
  params: {
    organizationId: string;
    submissionId: string;
    authorId: string;
    parentId?: string | null;
    content: string;
  },
): Promise<{ id: string }> {
  const [row] = await tx
    .insert(submissionDiscussions)
    .values({
      organizationId: params.organizationId,
      submissionId: params.submissionId,
      authorId: params.authorId,
      parentId: params.parentId ?? null,
      content: params.content,
    })
    .returning({ id: submissionDiscussions.id });

  return row;
}

async function getNotificationRecipients(
  tx: DrizzleDb,
  submissionId: string,
  authorId: string,
): Promise<string[]> {
  // Union of reviewer userIds + distinct commenter authorIds, minus the author
  const rows = await tx.execute(sql`
    SELECT DISTINCT user_id FROM (
      SELECT reviewer_user_id AS user_id
      FROM submission_reviewers
      WHERE submission_id = ${submissionId}
      UNION
      SELECT author_id AS user_id
      FROM submission_discussions
      WHERE submission_id = ${submissionId} AND author_id IS NOT NULL
    ) AS combined
    WHERE user_id != ${authorId}
  `);

  return (rows.rows as Array<{ user_id: string }>).map((r) => r.user_id);
}

// ---------------------------------------------------------------------------
// Access-aware methods (accept ServiceContext)
// ---------------------------------------------------------------------------

async function listWithAccess(
  svc: ServiceContext,
  submissionId: string,
): Promise<SubmissionDiscussion[]> {
  const submission = await getSubmissionOrThrow(svc.tx, submissionId);
  await assertEditorAdminOrReviewer(
    svc.tx,
    svc.actor.roles,
    svc.actor.userId,
    submissionId,
    submission.submitterId,
  );
  const comments = await listBySubmission(svc.tx, submissionId);

  const blindMode = await resolveBlindMode(
    svc.tx,
    submission.submissionPeriodId,
  );
  return comments.map((c) =>
    applyAuthorBlinding(c, blindMode, svc.actor.roles),
  );
}

async function createWithAudit(
  svc: ServiceContext,
  params: { submissionId: string; parentId?: string; content: string },
): Promise<SubmissionDiscussion> {
  const submission = await getSubmissionOrThrow(svc.tx, params.submissionId);
  await assertEditorAdminOrReviewer(
    svc.tx,
    svc.actor.roles,
    svc.actor.userId,
    params.submissionId,
    submission.submitterId,
  );

  // Validate + collapse parentId if provided
  let resolvedParentId: string | null = null;
  if (params.parentId) {
    const [parent] = await svc.tx
      .select({
        id: submissionDiscussions.id,
        parentId: submissionDiscussions.parentId,
        submissionId: submissionDiscussions.submissionId,
      })
      .from(submissionDiscussions)
      .where(eq(submissionDiscussions.id, params.parentId))
      .limit(1);

    if (!parent || parent.submissionId !== params.submissionId) {
      throw new DiscussionParentNotFoundError(params.parentId);
    }

    // Collapse depth > 1: if parent itself has a parent, reply to the root
    resolvedParentId = parent.parentId ?? parent.id;
  }

  const sanitizedContent = sanitizeContent(params.content);

  const { id } = await create(svc.tx, {
    organizationId: svc.actor.orgId,
    submissionId: params.submissionId,
    authorId: svc.actor.userId,
    parentId: resolvedParentId,
    content: sanitizedContent,
  });

  await svc.audit({
    resource: AuditResources.SUBMISSION,
    action: AuditActions.DISCUSSION_COMMENT_ADDED,
    resourceId: params.submissionId,
    newValue: { commentId: id },
  });

  // Get notification recipients and enqueue outbox event
  const recipientUserIds = await getNotificationRecipients(
    svc.tx,
    params.submissionId,
    svc.actor.userId,
  );

  if (recipientUserIds.length > 0) {
    await enqueueOutboxEvent(svc.tx, 'hopper/discussion.comment_added', {
      orgId: svc.actor.orgId,
      submissionId: params.submissionId,
      commentId: id,
      authorId: svc.actor.userId,
      recipientUserIds,
    });
  }

  // Return the full comment with author email
  const [comment] = await svc.tx
    .select({
      id: submissionDiscussions.id,
      submissionId: submissionDiscussions.submissionId,
      authorId: submissionDiscussions.authorId,
      authorEmail: users.email,
      parentId: submissionDiscussions.parentId,
      content: submissionDiscussions.content,
      createdAt: submissionDiscussions.createdAt,
      updatedAt: submissionDiscussions.updatedAt,
    })
    .from(submissionDiscussions)
    .leftJoin(users, eq(users.id, submissionDiscussions.authorId))
    .where(eq(submissionDiscussions.id, id))
    .limit(1);

  const blindMode = await resolveBlindMode(
    svc.tx,
    submission.submissionPeriodId,
  );
  return applyAuthorBlinding(comment, blindMode, svc.actor.roles);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export const submissionDiscussionService = {
  listBySubmission,
  create,
  getNotificationRecipients,
  listWithAccess,
  createWithAudit,
};
