import { z } from 'zod';
import {
  createSubmissionSchema,
  updateSubmissionSchema,
  updateSubmissionStatusSchema,
  listSubmissionsSchema,
  resubmitSchema,
  idParamSchema,
  submissionIdParamSchema,
  submissionSchema,
  submissionListItemSchema,
  submissionDetailSchema,
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
} from '@colophony/types';
import {
  orgProcedure,
  userProcedure,
  createRouter,
  requireScopes,
} from '../init.js';
import { submissionService } from '../../services/submission.service.js';
import { submissionReviewerService } from '../../services/submission-reviewer.service.js';
import { simsubService } from '../../services/simsub.service.js';
import { transferService } from '../../services/transfer.service.js';
import { migrationService } from '../../services/migration.service.js';
import { toServiceContext } from '../../services/context.js';
import { assertEditorOrAdmin } from '../../services/errors.js';
import { mapServiceError } from '../error-mapper.js';
import { validateEnv } from '../../config/env.js';

export const submissionsRouter = createRouter({
  /** Submitter's own submissions (any org member). */
  mySubmissions: orgProcedure
    .use(requireScopes('submissions:read'))
    .input(listSubmissionsSchema)
    .output(paginatedResponseSchema(submissionSchema))
    .query(async ({ ctx, input }) => {
      return submissionService.listBySubmitter(
        ctx.dbTx,
        ctx.authContext.userId,
        input,
      );
    }),

  /** Editor/admin view of all submissions in the org. */
  list: orgProcedure
    .use(requireScopes('submissions:read'))
    .input(listSubmissionsSchema)
    .output(paginatedResponseSchema(submissionListItemSchema))
    .query(async ({ ctx, input }) => {
      try {
        assertEditorOrAdmin(ctx.authContext.role);
        return await submissionService.listAll(ctx.dbTx, input);
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
});
