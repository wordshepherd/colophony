import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import {
  createSubmissionSchema,
  updateSubmissionSchema,
  updateSubmissionStatusSchema,
  listSubmissionsSchema,
  AuditActions,
  AuditResources,
} from '@colophony/types';
import { orgProcedure, createRouter } from '../init.js';
import {
  submissionService,
  SubmissionNotFoundError,
  InvalidStatusTransitionError,
  NotDraftError,
  UnscannedFilesError,
  InfectedFilesError,
} from '../../services/submission.service.js';

function assertEditorOrAdmin(role: string): void {
  if (role !== 'ADMIN' && role !== 'EDITOR') {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'Editor or admin role required',
    });
  }
}

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
      assertEditorOrAdmin(ctx.authContext.role);
      return submissionService.listAll(ctx.dbTx, input);
    }),

  /** Create a new DRAFT submission. */
  create: orgProcedure
    .input(createSubmissionSchema)
    .mutation(async ({ ctx, input }) => {
      const submission = await submissionService.create(
        ctx.dbTx,
        input,
        ctx.authContext.orgId,
        ctx.authContext.userId,
      );
      await ctx.audit({
        action: AuditActions.SUBMISSION_CREATED,
        resource: AuditResources.SUBMISSION,
        resourceId: submission.id,
        newValue: { title: input.title },
      });
      return submission;
    }),

  /** Get submission by ID — owner or editor/admin. */
  getById: orgProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const submission = await submissionService.getById(ctx.dbTx, input.id);
      if (!submission) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Submission not found',
        });
      }
      // Owner or editor/admin can view
      if (
        submission.submitterId !== ctx.authContext.userId &&
        ctx.authContext.role !== 'ADMIN' &&
        ctx.authContext.role !== 'EDITOR'
      ) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'You do not have access to this submission',
        });
      }
      return submission;
    }),

  /** Update a DRAFT submission — owner only. */
  update: orgProcedure
    .input(z.object({ id: z.string().uuid() }).merge(updateSubmissionSchema))
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      const existing = await submissionService.getById(ctx.dbTx, id);
      if (!existing) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Submission not found',
        });
      }
      if (existing.submitterId !== ctx.authContext.userId) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Only the submitter can update this submission',
        });
      }
      try {
        const updated = await submissionService.update(ctx.dbTx, id, data);
        if (!updated) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Submission not found',
          });
        }
        await ctx.audit({
          action: AuditActions.SUBMISSION_UPDATED,
          resource: AuditResources.SUBMISSION,
          resourceId: id,
          newValue: data,
        });
        return updated;
      } catch (e) {
        if (e instanceof NotDraftError) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: e.message });
        }
        throw e;
      }
    }),

  /** Submit a DRAFT submission (DRAFT→SUBMITTED) — owner only. */
  submit: orgProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const existing = await submissionService.getById(ctx.dbTx, input.id);
      if (!existing) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Submission not found',
        });
      }
      if (existing.submitterId !== ctx.authContext.userId) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Only the submitter can submit this submission',
        });
      }
      try {
        const result = await submissionService.updateStatus(
          ctx.dbTx,
          input.id,
          'SUBMITTED',
          ctx.authContext.userId,
          undefined,
          'submitter',
        );
        await ctx.audit({
          action: AuditActions.SUBMISSION_SUBMITTED,
          resource: AuditResources.SUBMISSION,
          resourceId: input.id,
        });
        return result;
      } catch (e) {
        if (e instanceof SubmissionNotFoundError) {
          throw new TRPCError({ code: 'NOT_FOUND', message: e.message });
        }
        if (e instanceof InvalidStatusTransitionError) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: e.message });
        }
        if (e instanceof UnscannedFilesError) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: e.message });
        }
        if (e instanceof InfectedFilesError) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: e.message });
        }
        throw e;
      }
    }),

  /** Delete a DRAFT submission — owner only. */
  delete: orgProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const existing = await submissionService.getById(ctx.dbTx, input.id);
      if (!existing) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Submission not found',
        });
      }
      if (existing.submitterId !== ctx.authContext.userId) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Only the submitter can delete this submission',
        });
      }
      try {
        const deleted = await submissionService.delete(ctx.dbTx, input.id);
        if (!deleted) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Submission not found',
          });
        }
        await ctx.audit({
          action: AuditActions.SUBMISSION_DELETED,
          resource: AuditResources.SUBMISSION,
          resourceId: input.id,
        });
        return { success: true };
      } catch (e) {
        if (e instanceof NotDraftError) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: e.message });
        }
        throw e;
      }
    }),

  /** Withdraw a submission — owner only. */
  withdraw: orgProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const existing = await submissionService.getById(ctx.dbTx, input.id);
      if (!existing) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Submission not found',
        });
      }
      if (existing.submitterId !== ctx.authContext.userId) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Only the submitter can withdraw this submission',
        });
      }
      try {
        const result = await submissionService.updateStatus(
          ctx.dbTx,
          input.id,
          'WITHDRAWN',
          ctx.authContext.userId,
          undefined,
          'submitter',
        );
        await ctx.audit({
          action: AuditActions.SUBMISSION_WITHDRAWN,
          resource: AuditResources.SUBMISSION,
          resourceId: input.id,
        });
        return result;
      } catch (e) {
        if (e instanceof SubmissionNotFoundError) {
          throw new TRPCError({ code: 'NOT_FOUND', message: e.message });
        }
        if (e instanceof InvalidStatusTransitionError) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: e.message });
        }
        throw e;
      }
    }),

  /** Editor/admin status transition. */
  updateStatus: orgProcedure
    .input(
      z.object({ id: z.string().uuid() }).merge(updateSubmissionStatusSchema),
    )
    .mutation(async ({ ctx, input }) => {
      assertEditorOrAdmin(ctx.authContext.role);
      const { id, status, comment } = input;
      try {
        const result = await submissionService.updateStatus(
          ctx.dbTx,
          id,
          status,
          ctx.authContext.userId,
          comment,
          'editor',
        );
        await ctx.audit({
          action: AuditActions.SUBMISSION_STATUS_CHANGED,
          resource: AuditResources.SUBMISSION,
          resourceId: id,
          newValue: { status, comment },
        });
        return result;
      } catch (e) {
        if (e instanceof SubmissionNotFoundError) {
          throw new TRPCError({ code: 'NOT_FOUND', message: e.message });
        }
        if (e instanceof InvalidStatusTransitionError) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: e.message });
        }
        throw e;
      }
    }),

  /** Get submission history — owner or editor/admin. */
  getHistory: orgProcedure
    .input(z.object({ submissionId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const submission = await submissionService.getById(
        ctx.dbTx,
        input.submissionId,
      );
      if (!submission) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Submission not found',
        });
      }
      if (
        submission.submitterId !== ctx.authContext.userId &&
        ctx.authContext.role !== 'ADMIN' &&
        ctx.authContext.role !== 'EDITOR'
      ) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'You do not have access to this submission',
        });
      }
      return submissionService.getHistory(ctx.dbTx, input.submissionId);
    }),
});
