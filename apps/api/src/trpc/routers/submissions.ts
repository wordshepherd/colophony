import { z } from 'zod';
import {
  createSubmissionSchema,
  updateSubmissionSchema,
  updateSubmissionStatusSchema,
  listSubmissionsSchema,
  idParamSchema,
  submissionIdParamSchema,
  submissionSchema,
  submissionListItemSchema,
  submissionDetailSchema,
  submissionStatusChangeResponseSchema,
  submissionHistorySchema,
  successResponseSchema,
  paginatedResponseSchema,
} from '@colophony/types';
import { orgProcedure, createRouter, requireScopes } from '../init.js';
import { submissionService } from '../../services/submission.service.js';
import { simsubService } from '../../services/simsub.service.js';
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
});
