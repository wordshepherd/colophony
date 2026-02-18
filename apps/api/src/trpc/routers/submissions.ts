import { z } from 'zod';
import {
  createSubmissionSchema,
  updateSubmissionSchema,
  updateSubmissionStatusSchema,
  listSubmissionsSchema,
} from '@colophony/types';
import { orgProcedure, createRouter } from '../init.js';
import { submissionService } from '../../services/submission.service.js';
import { toServiceContext } from '../../services/context.js';
import { assertEditorOrAdmin } from '../../services/errors.js';
import { mapServiceError } from '../error-mapper.js';

export const submissionsRouter = createRouter({
  /** Submitter's own submissions (any org member). */
  mySubmissions: orgProcedure
    .input(listSubmissionsSchema)
    .query(async ({ ctx, input }) => {
      return submissionService.listBySubmitter(
        ctx.dbTx,
        ctx.authContext.userId,
        input,
      );
    }),

  /** Editor/admin view of all submissions in the org. */
  list: orgProcedure
    .input(listSubmissionsSchema)
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
    .input(createSubmissionSchema)
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
    .input(z.object({ id: z.string().uuid() }))
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
    .input(z.object({ id: z.string().uuid() }).merge(updateSubmissionSchema))
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
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      try {
        return await submissionService.submitAsOwner(
          toServiceContext(ctx),
          input.id,
        );
      } catch (e) {
        mapServiceError(e);
      }
    }),

  /** Delete a DRAFT submission — owner only. */
  delete: orgProcedure
    .input(z.object({ id: z.string().uuid() }))
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
    .input(z.object({ id: z.string().uuid() }))
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
    .input(
      z.object({ id: z.string().uuid() }).merge(updateSubmissionStatusSchema),
    )
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
    .input(z.object({ submissionId: z.string().uuid() }))
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
