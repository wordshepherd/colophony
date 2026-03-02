import { z } from 'zod';
import {
  createExternalSubmissionSchema,
  updateExternalSubmissionSchema,
  listExternalSubmissionsSchema,
  duplicateCheckInputSchema,
  duplicateCheckResultSchema,
} from '@colophony/types';
import { createRouter, userProcedure, requireScopes } from '../init.js';
import { toUserServiceContext } from '../../services/context.js';
import {
  externalSubmissionService,
  ExternalSubmissionNotFoundError,
} from '../../services/external-submission.service.js';
import { mapServiceError } from '../error-mapper.js';

export const externalSubmissionsRouter = createRouter({
  list: userProcedure
    .use(requireScopes('external-submissions:read'))
    .input(listExternalSubmissionsSchema)
    .query(async ({ ctx, input }) => {
      try {
        return await externalSubmissionService.list(
          ctx.dbTx,
          ctx.authContext.userId,
          input,
        );
      } catch (e) {
        mapServiceError(e);
      }
    }),

  getById: userProcedure
    .use(requireScopes('external-submissions:read'))
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      try {
        const row = await externalSubmissionService.getById(ctx.dbTx, input.id);
        if (!row) throw new ExternalSubmissionNotFoundError(input.id);
        return row;
      } catch (e) {
        mapServiceError(e);
      }
    }),

  checkDuplicates: userProcedure
    .use(requireScopes('external-submissions:read'))
    .input(duplicateCheckInputSchema)
    .output(duplicateCheckResultSchema)
    .query(async ({ ctx, input }) => {
      try {
        return await externalSubmissionService.checkDuplicates(
          ctx.dbTx,
          ctx.authContext.userId,
          input.candidates,
        );
      } catch (e) {
        mapServiceError(e);
      }
    }),

  create: userProcedure
    .use(requireScopes('external-submissions:write'))
    .input(createExternalSubmissionSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        return await externalSubmissionService.createWithAudit(
          toUserServiceContext(ctx),
          input,
        );
      } catch (e) {
        mapServiceError(e);
      }
    }),

  update: userProcedure
    .use(requireScopes('external-submissions:write'))
    .input(
      z.object({
        id: z.string().uuid(),
        data: updateExternalSubmissionSchema,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        return await externalSubmissionService.updateWithAudit(
          toUserServiceContext(ctx),
          input.id,
          input.data,
        );
      } catch (e) {
        mapServiceError(e);
      }
    }),

  delete: userProcedure
    .use(requireScopes('external-submissions:write'))
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      try {
        await externalSubmissionService.deleteWithAudit(
          toUserServiceContext(ctx),
          input.id,
        );
        return { success: true as const };
      } catch (e) {
        mapServiceError(e);
      }
    }),
});
