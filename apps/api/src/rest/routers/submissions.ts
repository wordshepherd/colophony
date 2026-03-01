import { z } from 'zod';
import {
  createSubmissionSchema,
  updateSubmissionSchema,
  updateSubmissionStatusSchema,
  listSubmissionsSchema,
  resubmitSchema,
  idParamSchema,
  submissionSchema,
  submissionHistorySchema,
  fileSchema,
  paginatedResponseSchema,
  successResponseSchema,
  submissionReviewerSchema,
  createDiscussionCommentSchema,
  submissionDiscussionSchema,
  batchStatusChangeInputSchema,
  batchStatusChangeResponseSchema,
  batchAssignReviewersInputSchema,
  batchAssignReviewersResponseSchema,
  submissionOverviewStatsSchema,
  submissionStatusBreakdownSchema,
  submissionFunnelSchema,
  submissionTimeSeriesSchema,
  responseTimeDistributionSchema,
  agingSubmissionsSchema,
  castVoteInputSchema,
  submissionVoteSchema,
  voteSummarySchema,
} from '@colophony/types';
import { restPaginationQuery } from '@colophony/api-contracts';
import { submissionService } from '../../services/submission.service.js';
import { submissionReviewerService } from '../../services/submission-reviewer.service.js';
import { submissionDiscussionService } from '../../services/submission-discussion.service.js';
import { submissionVoteService } from '../../services/submission-vote.service.js';
import { submissionAnalyticsService } from '../../services/submission-analytics.service.js';
import { simsubService } from '../../services/simsub.service.js';
import { toServiceContext } from '../../services/context.js';
import { assertEditorOrAdmin } from '../../services/errors.js';
import { mapServiceError } from '../error-mapper.js';
import { orgProcedure, requireScopes } from '../context.js';
import { validateEnv } from '../../config/env.js';

// ---------------------------------------------------------------------------
// Query schemas — override page/limit with z.coerce for REST query strings
// ---------------------------------------------------------------------------

const paginatedSubmissionsSchema = paginatedResponseSchema(submissionSchema);

const submissionWithDetailsSchema = submissionSchema.extend({
  files: z.array(fileSchema),
  submitterEmail: z.string().nullable(),
});

const statusUpdateResponseSchema = z.object({
  submission: submissionSchema,
  historyEntry: submissionHistorySchema,
});

const restListSubmissionsQuery = listSubmissionsSchema
  .omit({ page: true, limit: true })
  .merge(restPaginationQuery);

// ---------------------------------------------------------------------------
// Submission routes
// ---------------------------------------------------------------------------

const mine = orgProcedure
  .use(requireScopes('submissions:read'))
  .route({
    method: 'GET',
    path: '/submissions/mine',
    summary: 'List my submissions',
    description:
      'Returns submissions created by the authenticated user in the current organization.',
    operationId: 'listMySubmissions',
    tags: ['Submissions'],
  })
  .input(restListSubmissionsQuery)
  .output(paginatedSubmissionsSchema)
  .handler(async ({ input, context }) => {
    return submissionService.listBySubmitter(
      context.dbTx,
      context.authContext.userId,
      input,
    );
  });

const list = orgProcedure
  .use(requireScopes('submissions:read'))
  .route({
    method: 'GET',
    path: '/submissions',
    summary: 'List all submissions',
    description:
      'Returns all submissions in the organization. Requires EDITOR or ADMIN role.',
    operationId: 'listSubmissions',
    tags: ['Submissions'],
  })
  .input(restListSubmissionsQuery)
  .output(paginatedSubmissionsSchema)
  .handler(async ({ input, context }) => {
    try {
      assertEditorOrAdmin(context.authContext.role);
      return await submissionService.listAll(
        context.dbTx,
        input,
        context.authContext.role,
      );
    } catch (e) {
      mapServiceError(e);
    }
  });

const create = orgProcedure
  .use(requireScopes('submissions:write'))
  .route({
    method: 'POST',
    path: '/submissions',
    successStatus: 201,
    summary: 'Create a submission',
    description: 'Create a new submission in DRAFT status.',
    operationId: 'createSubmission',
    tags: ['Submissions'],
  })
  .input(createSubmissionSchema)
  .output(submissionSchema)
  .handler(async ({ input, context }) => {
    try {
      return await submissionService.createWithAudit(
        toServiceContext(context),
        input,
      );
    } catch (e) {
      mapServiceError(e);
    }
  });

const get = orgProcedure
  .use(requireScopes('submissions:read'))
  .route({
    method: 'GET',
    path: '/submissions/{id}',
    summary: 'Get a submission',
    description:
      'Retrieve a single submission by ID, including attached files and submitter email.',
    operationId: 'getSubmission',
    tags: ['Submissions'],
  })
  .input(idParamSchema)
  .output(submissionWithDetailsSchema)
  .handler(async ({ input, context }) => {
    try {
      return await submissionService.getByIdWithAccess(
        toServiceContext(context),
        input.id,
      );
    } catch (e) {
      mapServiceError(e);
    }
  });

const update = orgProcedure
  .use(requireScopes('submissions:write'))
  .route({
    method: 'PATCH',
    path: '/submissions/{id}',
    summary: 'Update a submission',
    description:
      "Update a submission's title, content, or cover letter. Only allowed while in DRAFT status.",
    operationId: 'updateSubmission',
    tags: ['Submissions'],
  })
  .input(idParamSchema.merge(updateSubmissionSchema))
  .output(submissionSchema)
  .handler(async ({ input, context }) => {
    const { id, ...data } = input;
    try {
      return await submissionService.updateAsOwner(
        toServiceContext(context),
        id,
        data,
      );
    } catch (e) {
      mapServiceError(e);
    }
  });

const submit = orgProcedure
  .use(requireScopes('submissions:write'))
  .route({
    method: 'POST',
    path: '/submissions/{id}/submit',
    summary: 'Submit a submission',
    description:
      'Transition a DRAFT submission to SUBMITTED status. Validates that all files have passed virus scanning.',
    operationId: 'submitSubmission',
    tags: ['Submissions'],
  })
  .input(idParamSchema)
  .output(statusUpdateResponseSchema)
  .handler(async ({ input, context }) => {
    try {
      const env = validateEnv();
      const svc = toServiceContext(context);
      await simsubService.preSubmitCheck(
        env,
        svc.tx,
        input.id,
        svc.actor.userId,
        svc.actor.orgId,
      );
      return await submissionService.submitAsOwner(svc, input.id);
    } catch (e) {
      mapServiceError(e);
    }
  });

const del = orgProcedure
  .use(requireScopes('submissions:write'))
  .route({
    method: 'DELETE',
    path: '/submissions/{id}',
    summary: 'Delete a submission',
    description:
      'Permanently delete a DRAFT submission and its attached files.',
    operationId: 'deleteSubmission',
    tags: ['Submissions'],
  })
  .input(idParamSchema)
  .output(successResponseSchema)
  .handler(async ({ input, context }) => {
    try {
      return await submissionService.deleteAsOwner(
        toServiceContext(context),
        input.id,
      );
    } catch (e) {
      mapServiceError(e);
    }
  });

const resubmit = orgProcedure
  .use(requireScopes('submissions:write'))
  .route({
    method: 'POST',
    path: '/submissions/{id}/resubmit',
    summary: 'Resubmit with a new manuscript version',
    description:
      'Resubmit a submission that is in REVISE_AND_RESUBMIT status with a new manuscript version. Only the submitter can resubmit.',
    operationId: 'resubmitSubmission',
    tags: ['Submissions'],
  })
  .input(resubmitSchema)
  .output(statusUpdateResponseSchema)
  .handler(async ({ input, context }) => {
    try {
      return await submissionService.resubmitAsOwner(
        toServiceContext(context),
        input.id,
        input.manuscriptVersionId,
      );
    } catch (e) {
      mapServiceError(e);
    }
  });

const withdraw = orgProcedure
  .use(requireScopes('submissions:write'))
  .route({
    method: 'POST',
    path: '/submissions/{id}/withdraw',
    summary: 'Withdraw a submission',
    description:
      'Withdraw a submission from consideration. Allowed from DRAFT, SUBMITTED, UNDER_REVIEW, or HOLD status.',
    operationId: 'withdrawSubmission',
    tags: ['Submissions'],
  })
  .input(idParamSchema)
  .output(statusUpdateResponseSchema)
  .handler(async ({ input, context }) => {
    try {
      return await submissionService.withdrawAsOwner(
        toServiceContext(context),
        input.id,
      );
    } catch (e) {
      mapServiceError(e);
    }
  });

const updateStatus = orgProcedure
  .use(requireScopes('submissions:write'))
  .route({
    method: 'PATCH',
    path: '/submissions/{id}/status',
    summary: 'Update submission status',
    description:
      'Transition a submission to a new status. Requires EDITOR or ADMIN role. Valid transitions depend on current status.',
    operationId: 'updateSubmissionStatus',
    tags: ['Submissions'],
  })
  .input(idParamSchema.merge(updateSubmissionStatusSchema))
  .output(statusUpdateResponseSchema)
  .handler(async ({ input, context }) => {
    const { id, status, comment } = input;
    try {
      return await submissionService.updateStatusAsEditor(
        toServiceContext(context),
        id,
        status,
        comment,
      );
    } catch (e) {
      mapServiceError(e);
    }
  });

const history = orgProcedure
  .use(requireScopes('submissions:read'))
  .route({
    method: 'GET',
    path: '/submissions/{id}/history',
    summary: 'Get submission history',
    description: 'Returns the status change history for a submission.',
    operationId: 'getSubmissionHistory',
    tags: ['Submissions'],
  })
  .input(idParamSchema)
  .output(z.array(submissionHistorySchema))
  .handler(async ({ input, context }) => {
    try {
      return await submissionService.getHistoryWithAccess(
        toServiceContext(context),
        input.id,
      );
    } catch (e) {
      mapServiceError(e);
    }
  });

// ---------------------------------------------------------------------------
// Reviewer routes
// ---------------------------------------------------------------------------

const listReviewers = orgProcedure
  .use(requireScopes('submissions:read'))
  .route({
    method: 'GET',
    path: '/submissions/{id}/reviewers',
    summary: 'List submission reviewers',
    description:
      'Returns reviewers assigned to a submission. Visible to the submitter and editors/admins.',
    operationId: 'listSubmissionReviewers',
    tags: ['Submissions'],
  })
  .input(idParamSchema)
  .output(z.array(submissionReviewerSchema))
  .handler(async ({ input, context }) => {
    try {
      return await submissionReviewerService.listBySubmissionWithAccess(
        toServiceContext(context),
        input.id,
      );
    } catch (e) {
      mapServiceError(e);
    }
  });

const assignReviewers = orgProcedure
  .use(requireScopes('submissions:write'))
  .route({
    method: 'POST',
    path: '/submissions/{id}/reviewers',
    successStatus: 201,
    summary: 'Assign reviewers',
    description:
      'Assign one or more org members as reviewers on a submission. Requires EDITOR or ADMIN role.',
    operationId: 'assignSubmissionReviewers',
    tags: ['Submissions'],
  })
  .input(
    idParamSchema.merge(
      z.object({
        reviewerUserIds: z.array(z.string().uuid()).min(1).max(20),
      }),
    ),
  )
  .output(z.array(submissionReviewerSchema))
  .handler(async ({ input, context }) => {
    try {
      return await submissionReviewerService.assignWithAudit(
        toServiceContext(context),
        input.id,
        input.reviewerUserIds,
      );
    } catch (e) {
      mapServiceError(e);
    }
  });

const unassignReviewer = orgProcedure
  .use(requireScopes('submissions:write'))
  .route({
    method: 'DELETE',
    path: '/submissions/{id}/reviewers/{reviewerUserId}',
    summary: 'Unassign a reviewer',
    description:
      'Remove a reviewer from a submission. Requires EDITOR or ADMIN role.',
    operationId: 'unassignSubmissionReviewer',
    tags: ['Submissions'],
  })
  .input(
    z.object({
      id: z.string().uuid(),
      reviewerUserId: z.string().uuid(),
    }),
  )
  .output(successResponseSchema)
  .handler(async ({ input, context }) => {
    try {
      await submissionReviewerService.unassignWithAudit(
        toServiceContext(context),
        input.id,
        input.reviewerUserId,
      );
      return { success: true as const };
    } catch (e) {
      mapServiceError(e);
    }
  });

const markReviewerRead = orgProcedure
  .use(requireScopes('submissions:read'))
  .route({
    method: 'POST',
    path: '/submissions/{id}/reviewers/mark-read',
    summary: 'Mark submission as read',
    description:
      'Mark the current user as having read the submission. Idempotent — no-op if not a reviewer or already read.',
    operationId: 'markSubmissionReviewerRead',
    tags: ['Submissions'],
  })
  .input(idParamSchema)
  .output(successResponseSchema)
  .handler(async ({ input, context }) => {
    try {
      return await submissionReviewerService.markReadWithAudit(
        toServiceContext(context),
        input.id,
      );
    } catch (e) {
      mapServiceError(e);
    }
  });

const listDiscussions = orgProcedure
  .use(requireScopes('submissions:read'))
  .route({
    method: 'GET',
    path: '/submissions/{id}/discussions',
    summary: 'List internal discussion comments',
    description:
      'List all internal discussion comments on a submission. Only accessible to editors, admins, and assigned reviewers.',
    operationId: 'listSubmissionDiscussions',
    tags: ['Submissions'],
  })
  .input(idParamSchema)
  .output(z.array(submissionDiscussionSchema))
  .handler(async ({ input, context }) => {
    try {
      return await submissionDiscussionService.listWithAccess(
        toServiceContext(context),
        input.id,
      );
    } catch (e) {
      mapServiceError(e);
    }
  });

const addDiscussion = orgProcedure
  .use(requireScopes('submissions:write'))
  .route({
    method: 'POST',
    path: '/submissions/{id}/discussions',
    summary: 'Add a discussion comment',
    description:
      'Add an internal discussion comment on a submission. Only accessible to editors, admins, and assigned reviewers.',
    operationId: 'addSubmissionDiscussion',
    tags: ['Submissions'],
  })
  .input(
    idParamSchema.merge(
      createDiscussionCommentSchema.pick({ parentId: true, content: true }),
    ),
  )
  .output(submissionDiscussionSchema)
  .handler(async ({ input, context }) => {
    try {
      return await submissionDiscussionService.createWithAudit(
        toServiceContext(context),
        {
          submissionId: input.id,
          parentId: input.parentId,
          content: input.content,
        },
      );
    } catch (e) {
      mapServiceError(e);
    }
  });

// ---------------------------------------------------------------------------
// Vote routes
// ---------------------------------------------------------------------------

const castVote = orgProcedure
  .use(requireScopes('submissions:write'))
  .route({
    method: 'POST',
    path: '/submissions/{id}/votes',
    successStatus: 201,
    summary: 'Cast or update a vote',
    description:
      'Cast or update a vote on a submission. One vote per user per submission (upsert).',
    operationId: 'castSubmissionVote',
    tags: ['Submission Votes'],
  })
  .input(
    idParamSchema.merge(
      castVoteInputSchema.pick({ decision: true, score: true }),
    ),
  )
  .output(submissionVoteSchema)
  .handler(async ({ input, context }) => {
    try {
      return await submissionVoteService.castVoteWithAudit(
        toServiceContext(context),
        {
          submissionId: input.id,
          decision: input.decision,
          score: input.score,
        },
      );
    } catch (e) {
      mapServiceError(e);
    }
  });

const listVotes = orgProcedure
  .use(requireScopes('submissions:read'))
  .route({
    method: 'GET',
    path: '/submissions/{id}/votes',
    summary: 'List submission votes',
    description:
      'List all votes on a submission. Accessible to editors, admins, and assigned reviewers.',
    operationId: 'listSubmissionVotes',
    tags: ['Submission Votes'],
  })
  .input(idParamSchema)
  .output(z.array(submissionVoteSchema))
  .handler(async ({ input, context }) => {
    try {
      return await submissionVoteService.listVotesWithAccess(
        toServiceContext(context),
        input.id,
      );
    } catch (e) {
      mapServiceError(e);
    }
  });

const voteSummary = orgProcedure
  .use(requireScopes('submissions:read'))
  .route({
    method: 'GET',
    path: '/submissions/{id}/votes/summary',
    summary: 'Get vote summary',
    description:
      'Get aggregated vote tallies and average score for a submission. Editor/admin only.',
    operationId: 'getSubmissionVoteSummary',
    tags: ['Submission Votes'],
  })
  .input(idParamSchema)
  .output(voteSummarySchema)
  .handler(async ({ input, context }) => {
    try {
      return await submissionVoteService.getVoteSummaryWithAccess(
        toServiceContext(context),
        input.id,
      );
    } catch (e) {
      mapServiceError(e);
    }
  });

const deleteVote = orgProcedure
  .use(requireScopes('submissions:write'))
  .route({
    method: 'DELETE',
    path: '/submissions/{id}/votes',
    summary: 'Delete your vote',
    description: "Remove the current user's vote on a submission.",
    operationId: 'deleteSubmissionVote',
    tags: ['Submission Votes'],
  })
  .input(idParamSchema)
  .output(successResponseSchema)
  .handler(async ({ input, context }) => {
    try {
      return await submissionVoteService.deleteVoteWithAudit(
        toServiceContext(context),
        input.id,
      );
    } catch (e) {
      mapServiceError(e);
    }
  });

// ---------------------------------------------------------------------------
// Analytics routes
// ---------------------------------------------------------------------------

const restAnalyticsFilterSchema = z.object({
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
  submissionPeriodId: z.string().uuid().optional(),
});

const restTimeSeriesFilterSchema = restAnalyticsFilterSchema.extend({
  granularity: z.enum(['daily', 'weekly', 'monthly']).default('monthly'),
});

const restAgingFilterSchema = restAnalyticsFilterSchema.extend({
  thresholdDays: z.coerce.number().int().min(1).default(14),
  maxPerBracket: z.coerce.number().int().min(1).max(100).default(25),
});

const analyticsOverview = orgProcedure
  .use(requireScopes('submissions:read'))
  .route({
    method: 'GET',
    path: '/submissions/analytics/overview',
    summary: 'Submission analytics overview',
    description:
      'Returns key submission statistics: totals, acceptance rate, avg response time, and month-over-month counts.',
    operationId: 'getSubmissionAnalyticsOverview',
    tags: ['Submission Analytics'],
  })
  .input(restAnalyticsFilterSchema)
  .output(submissionOverviewStatsSchema)
  .handler(async ({ input, context }) => {
    try {
      assertEditorOrAdmin(context.authContext.role);
      return await submissionAnalyticsService.getOverviewStats(
        context.dbTx,
        input,
      );
    } catch (e) {
      mapServiceError(e);
    }
  });

const analyticsStatusBreakdown = orgProcedure
  .use(requireScopes('submissions:read'))
  .route({
    method: 'GET',
    path: '/submissions/analytics/status-breakdown',
    summary: 'Submission status breakdown',
    description: 'Returns the count of submissions grouped by status.',
    operationId: 'getSubmissionAnalyticsStatusBreakdown',
    tags: ['Submission Analytics'],
  })
  .input(restAnalyticsFilterSchema)
  .output(submissionStatusBreakdownSchema)
  .handler(async ({ input, context }) => {
    try {
      assertEditorOrAdmin(context.authContext.role);
      return await submissionAnalyticsService.getStatusBreakdown(
        context.dbTx,
        input,
      );
    } catch (e) {
      mapServiceError(e);
    }
  });

const analyticsFunnel = orgProcedure
  .use(requireScopes('submissions:read'))
  .route({
    method: 'GET',
    path: '/submissions/analytics/funnel',
    summary: 'Submission funnel',
    description:
      'Returns distinct submission counts at each workflow stage for funnel visualization.',
    operationId: 'getSubmissionAnalyticsFunnel',
    tags: ['Submission Analytics'],
  })
  .input(restAnalyticsFilterSchema)
  .output(submissionFunnelSchema)
  .handler(async ({ input, context }) => {
    try {
      assertEditorOrAdmin(context.authContext.role);
      return await submissionAnalyticsService.getFunnel(context.dbTx, input);
    } catch (e) {
      mapServiceError(e);
    }
  });

const analyticsTimeSeries = orgProcedure
  .use(requireScopes('submissions:read'))
  .route({
    method: 'GET',
    path: '/submissions/analytics/time-series',
    summary: 'Submission time series',
    description:
      'Returns submission counts over time, grouped by the specified granularity.',
    operationId: 'getSubmissionAnalyticsTimeSeries',
    tags: ['Submission Analytics'],
  })
  .input(restTimeSeriesFilterSchema)
  .output(submissionTimeSeriesSchema)
  .handler(async ({ input, context }) => {
    try {
      assertEditorOrAdmin(context.authContext.role);
      return await submissionAnalyticsService.getTimeSeries(
        context.dbTx,
        input,
      );
    } catch (e) {
      mapServiceError(e);
    }
  });

const analyticsResponseTime = orgProcedure
  .use(requireScopes('submissions:read'))
  .route({
    method: 'GET',
    path: '/submissions/analytics/response-time',
    summary: 'Response time distribution',
    description:
      'Returns a histogram of response times (days to first ACCEPTED/REJECTED) and the median.',
    operationId: 'getSubmissionAnalyticsResponseTime',
    tags: ['Submission Analytics'],
  })
  .input(restAnalyticsFilterSchema)
  .output(responseTimeDistributionSchema)
  .handler(async ({ input, context }) => {
    try {
      assertEditorOrAdmin(context.authContext.role);
      return await submissionAnalyticsService.getResponseTimeDistribution(
        context.dbTx,
        input,
      );
    } catch (e) {
      mapServiceError(e);
    }
  });

const analyticsAging = orgProcedure
  .use(requireScopes('submissions:read'))
  .route({
    method: 'GET',
    path: '/submissions/analytics/aging',
    summary: 'Aging submissions',
    description:
      'Returns non-terminal submissions older than the threshold, grouped by age bracket.',
    operationId: 'getSubmissionAnalyticsAging',
    tags: ['Submission Analytics'],
  })
  .input(restAgingFilterSchema)
  .output(agingSubmissionsSchema)
  .handler(async ({ input, context }) => {
    try {
      assertEditorOrAdmin(context.authContext.role);
      return await submissionAnalyticsService.getAgingSubmissions(
        context.dbTx,
        input,
      );
    } catch (e) {
      mapServiceError(e);
    }
  });

// ---------------------------------------------------------------------------
// Batch operation routes
// ---------------------------------------------------------------------------

const batchUpdateStatus = orgProcedure
  .use(requireScopes('submissions:write'))
  .route({
    method: 'POST',
    path: '/submissions/batch/status',
    summary: 'Batch update submission status',
    description:
      'Transition multiple submissions to a new status in one request. Requires EDITOR or ADMIN role.',
    operationId: 'batchUpdateSubmissionStatus',
    tags: ['Submissions'],
  })
  .input(batchStatusChangeInputSchema)
  .output(batchStatusChangeResponseSchema)
  .handler(async ({ input, context }) => {
    try {
      return await submissionService.batchUpdateStatusAsEditor(
        toServiceContext(context),
        input,
      );
    } catch (e) {
      mapServiceError(e);
    }
  });

const batchAssignReviewers = orgProcedure
  .use(requireScopes('submissions:write'))
  .route({
    method: 'POST',
    path: '/submissions/batch/assign-reviewers',
    summary: 'Batch assign reviewers',
    description:
      'Assign reviewers to multiple submissions in one request. Requires EDITOR or ADMIN role.',
    operationId: 'batchAssignReviewers',
    tags: ['Submissions'],
  })
  .input(batchAssignReviewersInputSchema)
  .output(batchAssignReviewersResponseSchema)
  .handler(async ({ input, context }) => {
    try {
      return await submissionService.batchAssignReviewersAsEditor(
        toServiceContext(context),
        input,
      );
    } catch (e) {
      mapServiceError(e);
    }
  });

// ---------------------------------------------------------------------------
// Assembled router
// ---------------------------------------------------------------------------

export const submissionsRouter = {
  mine,
  list,
  create,
  get,
  update,
  submit,
  resubmit,
  delete: del,
  withdraw,
  updateStatus,
  history,
  listReviewers,
  assignReviewers,
  unassignReviewer,
  markReviewerRead,
  listDiscussions,
  addDiscussion,
  castVote,
  listVotes,
  voteSummary,
  deleteVote,
  analyticsOverview,
  analyticsStatusBreakdown,
  analyticsFunnel,
  analyticsTimeSeries,
  analyticsResponseTime,
  analyticsAging,
  batchUpdateStatus,
  batchAssignReviewers,
};
