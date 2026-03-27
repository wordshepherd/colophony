import { z } from 'zod';
import {
  createSubmissionSchema,
  updateSubmissionSchema,
  updateSubmissionStatusSchema,
  listSubmissionsSchema,
  listWriterSubmissionsSchema,
  resubmitSchema,
  idParamSchema,
  submissionIdParamSchema,
  submissionSchema,
  submissionListItemSchema,
  submissionDetailSchema,
  writerSubmissionSchema,
  writerSubmissionDetailSchema,
  submissionStatusChangeResponseSchema,
  submissionHistorySchema,
  successResponseSchema,
  paginatedResponseSchema,
  initiateTransferInputSchema,
  transferIdParamSchema,
  requestMigrationInputSchema,
  migrationIdParamSchema,
  migrationListQuerySchema,
  assignReviewerInputSchema,
  unassignReviewerInputSchema,
  markReviewerReadInputSchema,
  submissionReviewerSchema,
  listDiscussionCommentsSchema,
  createDiscussionCommentSchema,
  submissionDiscussionSchema,
  analyticsFilterSchema,
  timeSeriesFilterSchema,
  agingFilterSchema,
  submissionOverviewStatsSchema,
  submissionStatusBreakdownSchema,
  submissionFunnelSchema,
  submissionTimeSeriesSchema,
  responseTimeDistributionSchema,
  agingSubmissionsSchema,
  castVoteInputSchema,
  listVotesInputSchema,
  deleteVoteInputSchema,
  submissionVoteSchema,
  voteSummarySchema,
  batchStatusChangeInputSchema,
  batchStatusChangeResponseSchema,
  batchAssignReviewersInputSchema,
  batchAssignReviewersResponseSchema,
  exportSubmissionsSchema,
  submissionExportItemSchema,
  AuditActions,
  AuditResources,
} from '@colophony/types';
import {
  orgProcedure,
  adminProcedure,
  userProcedure,
  createRouter,
  requireScopes,
} from '../init.js';
import { submissionService } from '../../services/submission.service.js';
import { organizationService } from '../../services/organization.service.js';
import { writerProjectionService } from '../../services/writer-projection.service.js';
import { submissionReviewerService } from '../../services/submission-reviewer.service.js';
import { submissionDiscussionService } from '../../services/submission-discussion.service.js';
import { submissionVoteService } from '../../services/submission-vote.service.js';
import { submissionAnalyticsService } from '../../services/submission-analytics.service.js';
import { simsubService } from '../../services/simsub.service.js';
import { transferService } from '../../services/transfer.service.js';
import { migrationService } from '../../services/migration.service.js';
import { toServiceContext } from '../../services/context.js';
import { assertEditorOrAdmin } from '../../services/errors.js';
import { mapServiceError } from '../error-mapper.js';
import { validateEnv } from '../../config/env.js';

export const submissionsRouter = createRouter({
  /** Submitter's own submissions — writer-projected statuses. */
  mySubmissions: orgProcedure
    .use(requireScopes('submissions:read'))
    .input(listWriterSubmissionsSchema)
    .output(paginatedResponseSchema(writerSubmissionSchema))
    .query(async ({ ctx, input }) => {
      const result = await submissionService.listBySubmitter(
        ctx.dbTx,
        ctx.authContext.userId,
        ctx.authContext.orgId,
        input,
      );
      const org = await organizationService.getById(
        ctx.dbTx,
        ctx.authContext.orgId,
      );
      const orgSettings = (org.settings ?? {}) as Record<string, unknown>;
      return {
        ...result,
        items: result.items.map((item) => {
          const { status, ...rest } = item;
          const projected = writerProjectionService.project(
            status,
            orgSettings,
          );
          return { ...rest, ...projected };
        }),
      };
    }),

  /** Writer-facing submission detail — projected status. */
  mySubmissionDetail: orgProcedure
    .use(requireScopes('submissions:read'))
    .input(idParamSchema)
    .output(writerSubmissionDetailSchema)
    .query(async ({ ctx, input }) => {
      try {
        const sub = await submissionService.getByIdAsOwner(
          ctx.dbTx,
          input.id,
          ctx.authContext.userId,
        );
        const org = await organizationService.getById(
          ctx.dbTx,
          ctx.authContext.orgId,
        );
        const orgSettings = (org.settings ?? {}) as Record<string, unknown>;
        const projected = writerProjectionService.project(
          sub.status,
          orgSettings,
        );
        // eslint-disable-next-line @typescript-eslint/no-unused-vars -- destructure to omit status from response
        const { status, ...rest } = sub;
        return { ...rest, ...projected };
      } catch (e) {
        mapServiceError(e);
      }
    }),

  /** Editor/admin view of all submissions in the org. */
  list: orgProcedure
    .use(requireScopes('submissions:read'))
    .input(listSubmissionsSchema)
    .output(paginatedResponseSchema(submissionListItemSchema))
    .query(async ({ ctx, input }) => {
      try {
        assertEditorOrAdmin(ctx.authContext.role);
        return await submissionService.listAll(
          ctx.dbTx,
          input,
          ctx.authContext.role,
        );
      } catch (e) {
        mapServiceError(e);
      }
    }),

  /** Export submissions (admin only) — no pagination, safety-capped at 10k rows. */
  export: adminProcedure
    .use(requireScopes('submissions:read'))
    .input(exportSubmissionsSchema)
    .output(z.array(submissionExportItemSchema))
    .query(async ({ ctx, input }) => {
      try {
        const result = await submissionService.exportAll(
          ctx.dbTx,
          input,
          ctx.authContext.role,
        );
        await ctx.audit({
          action: AuditActions.SUBMISSION_EXPORTED,
          resource: AuditResources.SUBMISSION,
          newValue: {
            format: input.format,
            filters: {
              status: input.status,
              submissionPeriodId: input.submissionPeriodId,
              search: input.search,
            },
          },
        });
        return result;
      } catch (e) {
        mapServiceError(e);
      }
    }),

  /** Create a new DRAFT submission. */
  create: orgProcedure
    .use(requireScopes('submissions:write'))
    .input(createSubmissionSchema)
    .output(submissionSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        return await submissionService.createWithAudit(
          toServiceContext(ctx),
          input,
        );
      } catch (e) {
        mapServiceError(e);
      }
    }),

  /** Get submission by ID — owner or editor/admin. */
  getById: orgProcedure
    .use(requireScopes('submissions:read'))
    .input(idParamSchema)
    .output(submissionDetailSchema)
    .query(async ({ ctx, input }) => {
      try {
        return await submissionService.getByIdWithAccess(
          toServiceContext(ctx),
          input.id,
        );
      } catch (e) {
        mapServiceError(e);
      }
    }),

  /** Update a DRAFT submission — owner only. */
  update: orgProcedure
    .use(requireScopes('submissions:write'))
    .input(idParamSchema.merge(updateSubmissionSchema))
    .output(submissionSchema)
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      try {
        return await submissionService.updateAsOwner(
          toServiceContext(ctx),
          id,
          data,
        );
      } catch (e) {
        mapServiceError(e);
      }
    }),

  /** Submit a DRAFT submission (DRAFT→SUBMITTED) — owner only. */
  submit: orgProcedure
    .use(requireScopes('submissions:write'))
    .input(idParamSchema)
    .output(submissionStatusChangeResponseSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        const env = validateEnv();
        const svc = toServiceContext(ctx);
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
    }),

  /** Delete a DRAFT submission — owner only. */
  delete: orgProcedure
    .use(requireScopes('submissions:write'))
    .input(idParamSchema)
    .output(successResponseSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        return await submissionService.deleteAsOwner(
          toServiceContext(ctx),
          input.id,
        );
      } catch (e) {
        mapServiceError(e);
      }
    }),

  /** Withdraw a submission — owner only. */
  withdraw: orgProcedure
    .use(requireScopes('submissions:write'))
    .input(idParamSchema)
    .output(submissionStatusChangeResponseSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        return await submissionService.withdrawAsOwner(
          toServiceContext(ctx),
          input.id,
        );
      } catch (e) {
        mapServiceError(e);
      }
    }),

  /** Resubmit with a new manuscript version from REVISE_AND_RESUBMIT — owner only. */
  resubmit: orgProcedure
    .use(requireScopes('submissions:write'))
    .input(resubmitSchema)
    .output(submissionStatusChangeResponseSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        return await submissionService.resubmitAsOwner(
          toServiceContext(ctx),
          input.id,
          input.manuscriptVersionId,
        );
      } catch (e) {
        mapServiceError(e);
      }
    }),

  /** Editor/admin status transition. */
  updateStatus: orgProcedure
    .use(requireScopes('submissions:write'))
    .input(idParamSchema.merge(updateSubmissionStatusSchema))
    .output(submissionStatusChangeResponseSchema)
    .mutation(async ({ ctx, input }) => {
      const { id, status, comment } = input;
      try {
        return await submissionService.updateStatusAsEditor(
          toServiceContext(ctx),
          id,
          status,
          comment,
        );
      } catch (e) {
        mapServiceError(e);
      }
    }),

  /** Batch status change — editor/admin only. */
  batchUpdateStatus: orgProcedure
    .use(requireScopes('submissions:write'))
    .input(batchStatusChangeInputSchema)
    .output(batchStatusChangeResponseSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        return await submissionService.batchUpdateStatusAsEditor(
          toServiceContext(ctx),
          input,
        );
      } catch (e) {
        mapServiceError(e);
      }
    }),

  /** Batch assign reviewers — editor/admin only. */
  batchAssignReviewers: orgProcedure
    .use(requireScopes('submissions:write'))
    .input(batchAssignReviewersInputSchema)
    .output(batchAssignReviewersResponseSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        return await submissionService.batchAssignReviewersAsEditor(
          toServiceContext(ctx),
          input,
        );
      } catch (e) {
        mapServiceError(e);
      }
    }),

  /** Get submission history — owner or editor/admin. */
  getHistory: orgProcedure
    .use(requireScopes('submissions:read'))
    .input(submissionIdParamSchema)
    .output(z.array(submissionHistorySchema))
    .query(async ({ ctx, input }) => {
      try {
        return await submissionService.getHistoryWithAccess(
          toServiceContext(ctx),
          input.submissionId,
        );
      } catch (e) {
        mapServiceError(e);
      }
    }),

  /** Initiate a piece transfer to a remote instance. */
  initiateTransfer: orgProcedure
    .use(requireScopes('submissions:write'))
    .input(initiateTransferInputSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        const env = validateEnv();
        return await transferService.initiateTransfer(env, {
          orgId: ctx.authContext.orgId,
          userId: ctx.authContext.userId,
          submissionId: input.submissionId,
          targetDomain: input.targetDomain,
        });
      } catch (e) {
        mapServiceError(e);
      }
    }),

  /** List transfers for a submission. */
  getTransfers: orgProcedure
    .use(requireScopes('submissions:read'))
    .input(z.object({ submissionId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      try {
        return await transferService.getTransfersBySubmission(
          ctx.authContext.orgId,
          input.submissionId,
        );
      } catch (e) {
        mapServiceError(e);
      }
    }),

  /** Cancel a pending transfer. */
  cancelTransfer: orgProcedure
    .use(requireScopes('submissions:write'))
    .input(transferIdParamSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        await transferService.cancelTransfer(
          ctx.authContext.orgId,
          ctx.authContext.userId,
          input.transferId,
        );
        return { success: true };
      } catch (e) {
        mapServiceError(e);
      }
    }),

  // ─── Reviewer assignment procedures ───

  /** Assign reviewers to a submission — editor/admin only. */
  assignReviewers: orgProcedure
    .use(requireScopes('submissions:write'))
    .input(assignReviewerInputSchema)
    .output(z.array(submissionReviewerSchema))
    .mutation(async ({ ctx, input }) => {
      try {
        return await submissionReviewerService.assignWithAudit(
          toServiceContext(ctx),
          input.submissionId,
          input.reviewerUserIds,
        );
      } catch (e) {
        mapServiceError(e);
      }
    }),

  /** Unassign a reviewer from a submission — editor/admin only. */
  unassignReviewer: orgProcedure
    .use(requireScopes('submissions:write'))
    .input(unassignReviewerInputSchema)
    .output(successResponseSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        await submissionReviewerService.unassignWithAudit(
          toServiceContext(ctx),
          input.submissionId,
          input.reviewerUserId,
        );
        return { success: true as const };
      } catch (e) {
        mapServiceError(e);
      }
    }),

  /** List reviewers for a submission — owner or editor/admin. */
  listReviewers: orgProcedure
    .use(requireScopes('submissions:read'))
    .input(submissionIdParamSchema)
    .output(z.array(submissionReviewerSchema))
    .query(async ({ ctx, input }) => {
      try {
        return await submissionReviewerService.listBySubmissionWithAccess(
          toServiceContext(ctx),
          input.submissionId,
        );
      } catch (e) {
        mapServiceError(e);
      }
    }),

  /** Mark a submission as read by the current user (reviewer). */
  markReviewerRead: orgProcedure
    .use(requireScopes('submissions:read'))
    .input(markReviewerReadInputSchema)
    .output(successResponseSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        return await submissionReviewerService.markReadWithAudit(
          toServiceContext(ctx),
          input.submissionId,
        );
      } catch (e) {
        mapServiceError(e);
      }
    }),

  // ─── Identity migration procedures ───

  /** Request a migration from destination side (needs org context for trust lookup). */
  requestMigration: orgProcedure
    .use(requireScopes('submissions:write'))
    .input(requestMigrationInputSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        const env = validateEnv();
        return await migrationService.requestMigration(env, {
          userId: ctx.authContext.userId,
          organizationId: ctx.authContext.orgId,
          originDomain: input.originDomain,
          originEmail: input.originEmail,
        });
      } catch (e) {
        mapServiceError(e);
      }
    }),

  /** Approve an outbound migration (user-level, no org context needed). */
  approveMigration: userProcedure
    .use(requireScopes('submissions:write'))
    .input(migrationIdParamSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        const env = validateEnv();
        await migrationService.approveMigration(env, {
          userId: ctx.authContext.userId,
          migrationId: input.migrationId,
        });
        return { success: true };
      } catch (e) {
        mapServiceError(e);
      }
    }),

  /** Reject an outbound migration (user-level, no org context needed). */
  rejectMigration: userProcedure
    .use(requireScopes('submissions:write'))
    .input(migrationIdParamSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        const env = validateEnv();
        await migrationService.rejectMigration(env, {
          userId: ctx.authContext.userId,
          migrationId: input.migrationId,
        });
        return { success: true };
      } catch (e) {
        mapServiceError(e);
      }
    }),

  /** List user's migrations (user-level, no org context needed). */
  getMigrations: userProcedure
    .use(requireScopes('submissions:read'))
    .input(migrationListQuerySchema)
    .query(async ({ ctx, input }) => {
      try {
        return await migrationService.listMigrationsForUser(
          ctx.authContext.userId,
          input,
        );
      } catch (e) {
        mapServiceError(e);
      }
    }),

  /** List internal discussion comments on a submission. */
  listDiscussionComments: orgProcedure
    .use(requireScopes('submissions:read'))
    .input(listDiscussionCommentsSchema)
    .output(z.array(submissionDiscussionSchema))
    .query(async ({ ctx, input }) => {
      try {
        return await submissionDiscussionService.listWithAccess(
          toServiceContext(ctx),
          input.submissionId,
        );
      } catch (e) {
        mapServiceError(e);
      }
    }),

  /** Add a comment to the internal discussion on a submission. */
  addDiscussionComment: orgProcedure
    .use(requireScopes('submissions:write'))
    .input(createDiscussionCommentSchema)
    .output(submissionDiscussionSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        return await submissionDiscussionService.createWithAudit(
          toServiceContext(ctx),
          input,
        );
      } catch (e) {
        mapServiceError(e);
      }
    }),

  // ─── Voting procedures ───

  /** Cast or update a vote on a submission. */
  castVote: orgProcedure
    .use(requireScopes('submissions:write'))
    .input(castVoteInputSchema)
    .output(submissionVoteSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        return await submissionVoteService.castVoteWithAudit(
          toServiceContext(ctx),
          input,
        );
      } catch (e) {
        mapServiceError(e);
      }
    }),

  /** List all votes on a submission. */
  listVotes: orgProcedure
    .use(requireScopes('submissions:read'))
    .input(listVotesInputSchema)
    .output(z.array(submissionVoteSchema))
    .query(async ({ ctx, input }) => {
      try {
        return await submissionVoteService.listVotesWithAccess(
          toServiceContext(ctx),
          input.submissionId,
        );
      } catch (e) {
        mapServiceError(e);
      }
    }),

  /** Get vote summary (tallies + average score) — editor/admin only. */
  getVoteSummary: orgProcedure
    .use(requireScopes('submissions:read'))
    .input(z.object({ submissionId: z.string().uuid() }))
    .output(voteSummarySchema)
    .query(async ({ ctx, input }) => {
      try {
        return await submissionVoteService.getVoteSummaryWithAccess(
          toServiceContext(ctx),
          input.submissionId,
        );
      } catch (e) {
        mapServiceError(e);
      }
    }),

  /** Delete the current user's vote on a submission. */
  deleteVote: orgProcedure
    .use(requireScopes('submissions:write'))
    .input(deleteVoteInputSchema)
    .output(successResponseSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        return await submissionVoteService.deleteVoteWithAudit(
          toServiceContext(ctx),
          input.submissionId,
        );
      } catch (e) {
        mapServiceError(e);
      }
    }),

  // ─── Analytics procedures ───

  /** Overview stats: totals, acceptance rate, avg response time. */
  analyticsOverview: orgProcedure
    .use(requireScopes('submissions:read'))
    .input(analyticsFilterSchema)
    .output(submissionOverviewStatsSchema)
    .query(async ({ ctx, input }) => {
      try {
        assertEditorOrAdmin(ctx.authContext.role);
        return await submissionAnalyticsService.getOverviewStats(
          ctx.dbTx,
          input,
        );
      } catch (e) {
        mapServiceError(e);
      }
    }),

  /** Status breakdown: count per status. */
  analyticsStatusBreakdown: orgProcedure
    .use(requireScopes('submissions:read'))
    .input(analyticsFilterSchema)
    .output(submissionStatusBreakdownSchema)
    .query(async ({ ctx, input }) => {
      try {
        assertEditorOrAdmin(ctx.authContext.role);
        return await submissionAnalyticsService.getStatusBreakdown(
          ctx.dbTx,
          input,
        );
      } catch (e) {
        mapServiceError(e);
      }
    }),

  /** Funnel: submission workflow progression. */
  analyticsFunnel: orgProcedure
    .use(requireScopes('submissions:read'))
    .input(analyticsFilterSchema)
    .output(submissionFunnelSchema)
    .query(async ({ ctx, input }) => {
      try {
        assertEditorOrAdmin(ctx.authContext.role);
        return await submissionAnalyticsService.getFunnel(ctx.dbTx, input);
      } catch (e) {
        mapServiceError(e);
      }
    }),

  /** Time series: submissions over time by granularity. */
  analyticsTimeSeries: orgProcedure
    .use(requireScopes('submissions:read'))
    .input(timeSeriesFilterSchema)
    .output(submissionTimeSeriesSchema)
    .query(async ({ ctx, input }) => {
      try {
        assertEditorOrAdmin(ctx.authContext.role);
        return await submissionAnalyticsService.getTimeSeries(ctx.dbTx, input);
      } catch (e) {
        mapServiceError(e);
      }
    }),

  /** Response time distribution: histogram buckets + median. */
  analyticsResponseTime: orgProcedure
    .use(requireScopes('submissions:read'))
    .input(analyticsFilterSchema)
    .output(responseTimeDistributionSchema)
    .query(async ({ ctx, input }) => {
      try {
        assertEditorOrAdmin(ctx.authContext.role);
        return await submissionAnalyticsService.getResponseTimeDistribution(
          ctx.dbTx,
          input,
        );
      } catch (e) {
        mapServiceError(e);
      }
    }),

  /** Aging submissions: non-terminal submissions older than threshold. */
  analyticsAging: orgProcedure
    .use(requireScopes('submissions:read'))
    .input(agingFilterSchema)
    .output(agingSubmissionsSchema)
    .query(async ({ ctx, input }) => {
      try {
        assertEditorOrAdmin(ctx.authContext.role);
        return await submissionAnalyticsService.getAgingSubmissions(
          ctx.dbTx,
          input,
        );
      } catch (e) {
        mapServiceError(e);
      }
    }),
});
