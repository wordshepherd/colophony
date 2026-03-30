import { z } from 'zod';
import {
  createReaderFeedbackSchema,
  forwardReaderFeedbackSchema,
  listReaderFeedbackSchema,
} from '@colophony/types';
import {
  createRouter,
  userProcedure,
  orgProcedure,
  editorProcedure,
  requireScopes,
} from '../init.js';
import { toServiceContext } from '../../services/context.js';
import { readerFeedbackService } from '../../services/reader-feedback.service.js';
import { mapServiceError } from '../error-mapper.js';

export const readerFeedbackRouter = createRouter({
  list: orgProcedure
    .use(requireScopes('reader-feedback:read'))
    .input(listReaderFeedbackSchema)
    .query(async ({ ctx, input }) => {
      try {
        return await readerFeedbackService.list(
          ctx.dbTx,
          ctx.authContext.orgId,
          input,
        );
      } catch (e) {
        mapServiceError(e);
      }
    }),

  listForWriter: userProcedure
    .use(requireScopes('reader-feedback:read'))
    .input(
      z.object({
        submissionId: z.string().uuid(),
        page: z.number().int().min(1).default(1),
        limit: z.number().int().min(1).max(100).default(20),
      }),
    )
    .query(async ({ ctx, input }) => {
      try {
        return await readerFeedbackService.listForWriter(
          ctx.dbTx,
          ctx.authContext.userId,
          input.submissionId,
          input.page,
          input.limit,
        );
      } catch (e) {
        mapServiceError(e);
      }
    }),

  create: orgProcedure
    .use(requireScopes('reader-feedback:write'))
    .input(createReaderFeedbackSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        return await readerFeedbackService.createWithAudit(
          toServiceContext(ctx),
          input,
        );
      } catch (e) {
        mapServiceError(e);
      }
    }),

  forward: editorProcedure
    .use(requireScopes('reader-feedback:write'))
    .input(forwardReaderFeedbackSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        return await readerFeedbackService.forwardWithAudit(
          toServiceContext(ctx),
          input.feedbackId,
        );
      } catch (e) {
        mapServiceError(e);
      }
    }),

  delete: editorProcedure
    .use(requireScopes('reader-feedback:write'))
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      try {
        await readerFeedbackService.deleteWithAudit(
          toServiceContext(ctx),
          input.id,
        );
        return { success: true as const };
      } catch (e) {
        mapServiceError(e);
      }
    }),
});
