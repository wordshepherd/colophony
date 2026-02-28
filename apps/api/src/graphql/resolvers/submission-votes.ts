import { builder } from '../builder.js';
import { requireOrgContext, requireScopes } from '../guards.js';
import { submissionVoteService } from '../../services/submission-vote.service.js';
import { toServiceContext } from '../../services/context.js';
import { mapServiceError } from '../error-mapper.js';
import {
  SubmissionVoteType,
  VoteSummaryType,
  VoteDecisionEnum,
} from '../types/index.js';

// ---------------------------------------------------------------------------
// Query fields
// ---------------------------------------------------------------------------

builder.queryFields((t) => ({
  submissionVotes: t.field({
    type: [SubmissionVoteType],
    description:
      'List all votes on a submission. Accessible to editors, admins, and assigned reviewers.',
    args: {
      submissionId: t.arg.string({ required: true }),
    },
    resolve: async (_root, args, ctx) => {
      try {
        const orgCtx = requireOrgContext(ctx);
        await requireScopes(ctx, 'submissions:read');
        return await submissionVoteService.listVotesWithAccess(
          toServiceContext(orgCtx),
          args.submissionId,
        );
      } catch (e) {
        mapServiceError(e);
      }
    },
  }),

  submissionVoteSummary: t.field({
    type: VoteSummaryType,
    description:
      'Get aggregated vote tallies and average score. Editor/admin only.',
    args: {
      submissionId: t.arg.string({ required: true }),
    },
    resolve: async (_root, args, ctx) => {
      try {
        const orgCtx = requireOrgContext(ctx);
        await requireScopes(ctx, 'submissions:read');
        return await submissionVoteService.getVoteSummaryWithAccess(
          toServiceContext(orgCtx),
          args.submissionId,
        );
      } catch (e) {
        mapServiceError(e);
      }
    },
  }),
}));

// ---------------------------------------------------------------------------
// Mutation fields
// ---------------------------------------------------------------------------

builder.mutationFields((t) => ({
  castVote: t.field({
    type: SubmissionVoteType,
    description: 'Cast or update a vote on a submission.',
    args: {
      submissionId: t.arg.string({ required: true }),
      decision: t.arg({ type: VoteDecisionEnum, required: true }),
      score: t.arg.float({ required: false }),
    },
    resolve: async (_root, args, ctx) => {
      try {
        const orgCtx = requireOrgContext(ctx);
        await requireScopes(ctx, 'submissions:write');
        return await submissionVoteService.castVoteWithAudit(
          toServiceContext(orgCtx),
          {
            submissionId: args.submissionId,
            decision: args.decision,
            score: args.score ?? undefined,
          },
        );
      } catch (e) {
        mapServiceError(e);
      }
    },
  }),

  deleteVote: t.field({
    type: 'Boolean',
    description: "Remove the current user's vote on a submission.",
    args: {
      submissionId: t.arg.string({ required: true }),
    },
    resolve: async (_root, args, ctx) => {
      try {
        const orgCtx = requireOrgContext(ctx);
        await requireScopes(ctx, 'submissions:write');
        await submissionVoteService.deleteVoteWithAudit(
          toServiceContext(orgCtx),
          args.submissionId,
        );
        return true;
      } catch (e) {
        mapServiceError(e);
      }
    },
  }),
}));
