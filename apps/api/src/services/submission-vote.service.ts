import {
  submissionVotes,
  submissionReviewers,
  submissions,
  organizations,
  users,
  eq,
  and,
  type DrizzleDb,
} from '@colophony/db';
import { sql } from 'drizzle-orm';
import {
  AuditActions,
  AuditResources,
  votingConfigSchema,
  type SubmissionVote,
  type VoteSummary,
  type VotingConfig,
} from '@colophony/types';
import { enqueueOutboxEvent } from './outbox.js';
import type { ServiceContext } from './types.js';
import { ForbiddenError } from './errors.js';
import { assertEditorOrAdmin } from './errors.js';
import { SubmissionNotFoundError } from './submission.service.js';
import { resolveBlindMode, applyVoterBlinding } from './blind-review.helper.js';

// ---------------------------------------------------------------------------
// Error classes
// ---------------------------------------------------------------------------

export class VoteNotFoundError extends Error {
  constructor(submissionId: string) {
    super(`No vote found for this voter on submission "${submissionId}"`);
    this.name = 'VoteNotFoundError';
  }
}

export class VotingDisabledError extends Error {
  constructor() {
    super('Voting is not enabled for this organization');
    this.name = 'VotingDisabledError';
  }
}

export class VoteOnTerminalSubmissionError extends Error {
  constructor(status: string) {
    super(`Cannot vote on a submission with terminal status "${status}"`);
    this.name = 'VoteOnTerminalSubmissionError';
  }
}

export class ScoreOutOfRangeError extends Error {
  constructor(min: number, max: number) {
    super(`Score must be between ${min} and ${max}`);
    this.name = 'ScoreOutOfRangeError';
  }
}

// ---------------------------------------------------------------------------
// Terminal statuses (no votes allowed)
// ---------------------------------------------------------------------------

const TERMINAL_STATUSES = new Set(['ACCEPTED', 'REJECTED', 'WITHDRAWN']);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function getSubmissionOrThrow(tx: DrizzleDb, submissionId: string) {
  const [submission] = await tx
    .select({
      id: submissions.id,
      submitterId: submissions.submitterId,
      organizationId: submissions.organizationId,
      status: submissions.status,
      submissionPeriodId: submissions.submissionPeriodId,
    })
    .from(submissions)
    .where(eq(submissions.id, submissionId))
    .limit(1);

  if (!submission) throw new SubmissionNotFoundError(submissionId);
  return submission;
}

async function assertEditorAdminOrReviewer(
  tx: DrizzleDb,
  actorRole: string,
  actorUserId: string,
  submissionId: string,
  submitterId: string | null,
): Promise<void> {
  if (submitterId && actorUserId === submitterId) {
    throw new ForbiddenError('Submitters cannot vote on their own submissions');
  }

  if (actorRole === 'ADMIN' || actorRole === 'EDITOR') return;

  if (actorRole === 'READER') {
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
    'Only editors, admins, and assigned reviewers can vote',
  );
}

async function resolveVotingConfig(
  tx: DrizzleDb,
  orgId: string,
): Promise<VotingConfig> {
  const [org] = await tx
    .select({ settings: organizations.settings })
    .from(organizations)
    .where(eq(organizations.id, orgId))
    .limit(1);

  const settings = (org?.settings ?? {}) as Record<string, unknown>;
  return votingConfigSchema.parse(settings);
}

// ---------------------------------------------------------------------------
// Pure data methods (accept DrizzleDb tx)
// ---------------------------------------------------------------------------

async function upsert(
  tx: DrizzleDb,
  params: {
    organizationId: string;
    submissionId: string;
    voterUserId: string;
    decision: string;
    score: string | null;
  },
): Promise<{ id: string; isNew: boolean }> {
  // Check for existing vote to determine audit action (CAST vs UPDATED)
  const [existing] = await tx
    .select({ id: submissionVotes.id })
    .from(submissionVotes)
    .where(
      and(
        eq(submissionVotes.submissionId, params.submissionId),
        eq(submissionVotes.voterUserId, params.voterUserId),
      ),
    )
    .limit(1);

  // Atomic upsert via ON CONFLICT
  const [row] = await tx
    .insert(submissionVotes)
    .values({
      organizationId: params.organizationId,
      submissionId: params.submissionId,
      voterUserId: params.voterUserId,
      decision: params.decision as 'ACCEPT' | 'REJECT' | 'MAYBE',
      score: params.score,
    })
    .onConflictDoUpdate({
      target: [submissionVotes.submissionId, submissionVotes.voterUserId],
      set: {
        decision: params.decision as 'ACCEPT' | 'REJECT' | 'MAYBE',
        score: params.score,
        updatedAt: new Date(),
      },
    })
    .returning({ id: submissionVotes.id });

  return { id: row.id, isNew: !existing };
}

async function listBySubmission(
  tx: DrizzleDb,
  submissionId: string,
): Promise<SubmissionVote[]> {
  const rows = await tx
    .select({
      id: submissionVotes.id,
      submissionId: submissionVotes.submissionId,
      voterUserId: submissionVotes.voterUserId,
      voterEmail: users.email,
      decision: submissionVotes.decision,
      score: submissionVotes.score,
      createdAt: submissionVotes.createdAt,
      updatedAt: submissionVotes.updatedAt,
    })
    .from(submissionVotes)
    .leftJoin(users, eq(users.id, submissionVotes.voterUserId))
    .where(eq(submissionVotes.submissionId, submissionId))
    .orderBy(submissionVotes.createdAt);

  return rows.map((r) => ({
    ...r,
    score: r.score != null ? Number(r.score) : null,
  }));
}

async function getSummary(
  tx: DrizzleDb,
  submissionId: string,
): Promise<VoteSummary> {
  const [result] = await tx
    .select({
      acceptCount:
        sql<number>`COUNT(*) FILTER (WHERE ${submissionVotes.decision} = 'ACCEPT')`.mapWith(
          Number,
        ),
      rejectCount:
        sql<number>`COUNT(*) FILTER (WHERE ${submissionVotes.decision} = 'REJECT')`.mapWith(
          Number,
        ),
      maybeCount:
        sql<number>`COUNT(*) FILTER (WHERE ${submissionVotes.decision} = 'MAYBE')`.mapWith(
          Number,
        ),
      totalVotes: sql<number>`COUNT(*)`.mapWith(Number),
      averageScore: sql<number | null>`AVG(${submissionVotes.score})`,
    })
    .from(submissionVotes)
    .where(eq(submissionVotes.submissionId, submissionId));

  return {
    acceptCount: result.acceptCount,
    rejectCount: result.rejectCount,
    maybeCount: result.maybeCount,
    totalVotes: result.totalVotes,
    averageScore:
      result.averageScore != null ? Number(result.averageScore) : null,
  };
}

async function deleteByVoter(
  tx: DrizzleDb,
  submissionId: string,
  voterUserId: string,
): Promise<void> {
  const deleted = await tx
    .delete(submissionVotes)
    .where(
      and(
        eq(submissionVotes.submissionId, submissionId),
        eq(submissionVotes.voterUserId, voterUserId),
      ),
    )
    .returning({ id: submissionVotes.id });

  if (deleted.length === 0) {
    throw new VoteNotFoundError(submissionId);
  }
}

// ---------------------------------------------------------------------------
// Access-aware methods (accept ServiceContext)
// ---------------------------------------------------------------------------

async function castVoteWithAudit(
  svc: ServiceContext,
  params: { submissionId: string; decision: string; score?: number },
): Promise<SubmissionVote> {
  const submission = await getSubmissionOrThrow(svc.tx, params.submissionId);

  // Access check
  await assertEditorAdminOrReviewer(
    svc.tx,
    svc.actor.role,
    svc.actor.userId,
    params.submissionId,
    submission.submitterId,
  );

  // Terminal status check
  if (TERMINAL_STATUSES.has(submission.status)) {
    throw new VoteOnTerminalSubmissionError(submission.status);
  }

  // Config check
  const config = await resolveVotingConfig(svc.tx, svc.actor.orgId);
  if (!config.votingEnabled) {
    throw new VotingDisabledError();
  }

  // Score handling
  let scoreValue: string | null = null;
  if (config.scoringEnabled && params.score != null) {
    if (params.score < config.scoreMin || params.score > config.scoreMax) {
      throw new ScoreOutOfRangeError(config.scoreMin, config.scoreMax);
    }
    scoreValue = params.score.toString();
  }

  const { id, isNew } = await upsert(svc.tx, {
    organizationId: svc.actor.orgId,
    submissionId: params.submissionId,
    voterUserId: svc.actor.userId,
    decision: params.decision,
    score: scoreValue,
  });

  await svc.audit({
    resource: AuditResources.SUBMISSION,
    action: isNew
      ? AuditActions.SUBMISSION_VOTE_CAST
      : AuditActions.SUBMISSION_VOTE_UPDATED,
    resourceId: params.submissionId,
    newValue: { voteId: id, decision: params.decision, score: params.score },
  });

  await enqueueOutboxEvent(svc.tx, 'hopper/vote.cast', {
    orgId: svc.actor.orgId,
    submissionId: params.submissionId,
    voteId: id,
    voterUserId: svc.actor.userId,
    decision: params.decision,
    isUpdate: !isNew,
  });

  // Return the full vote with voter email
  const [vote] = await svc.tx
    .select({
      id: submissionVotes.id,
      submissionId: submissionVotes.submissionId,
      voterUserId: submissionVotes.voterUserId,
      voterEmail: users.email,
      decision: submissionVotes.decision,
      score: submissionVotes.score,
      createdAt: submissionVotes.createdAt,
      updatedAt: submissionVotes.updatedAt,
    })
    .from(submissionVotes)
    .leftJoin(users, eq(users.id, submissionVotes.voterUserId))
    .where(eq(submissionVotes.id, id))
    .limit(1);

  const castResult: SubmissionVote = {
    ...vote,
    score: vote.score ? Number(vote.score) : null,
  };

  const blindMode = await resolveBlindMode(
    svc.tx,
    submission.submissionPeriodId,
  );
  return applyVoterBlinding(castResult, blindMode, svc.actor.role);
}

async function listVotesWithAccess(
  svc: ServiceContext,
  submissionId: string,
): Promise<SubmissionVote[]> {
  const submission = await getSubmissionOrThrow(svc.tx, submissionId);
  await assertEditorAdminOrReviewer(
    svc.tx,
    svc.actor.role,
    svc.actor.userId,
    submissionId,
    submission.submitterId,
  );
  const votes = await listBySubmission(svc.tx, submissionId);

  const blindMode = await resolveBlindMode(
    svc.tx,
    submission.submissionPeriodId,
  );
  return votes.map((v) => applyVoterBlinding(v, blindMode, svc.actor.role));
}

async function getVoteSummaryWithAccess(
  svc: ServiceContext,
  submissionId: string,
): Promise<VoteSummary> {
  assertEditorOrAdmin(svc.actor.role);
  await getSubmissionOrThrow(svc.tx, submissionId);
  return getSummary(svc.tx, submissionId);
}

async function deleteVoteWithAudit(
  svc: ServiceContext,
  submissionId: string,
): Promise<{ success: true }> {
  const submission = await getSubmissionOrThrow(svc.tx, submissionId);

  // Terminal status check — can't modify votes on terminal submissions
  if (TERMINAL_STATUSES.has(submission.status)) {
    throw new VoteOnTerminalSubmissionError(submission.status);
  }

  await deleteByVoter(svc.tx, submissionId, svc.actor.userId);

  await svc.audit({
    resource: AuditResources.SUBMISSION,
    action: AuditActions.SUBMISSION_VOTE_DELETED,
    resourceId: submissionId,
  });

  return { success: true };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export const submissionVoteService = {
  upsert,
  listBySubmission,
  getSummary,
  deleteByVoter,
  castVoteWithAudit,
  listVotesWithAccess,
  getVoteSummaryWithAccess,
  deleteVoteWithAudit,
};
