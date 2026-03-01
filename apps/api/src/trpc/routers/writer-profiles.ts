import { z } from 'zod';
import {
  createWriterProfileSchema,
  updateWriterProfileSchema,
} from '@colophony/types';
import { createRouter, userProcedure, requireScopes } from '../init.js';
import { toUserServiceContext } from '../../services/context.js';
import { writerProfileService } from '../../services/writer-profile.service.js';
import { mapServiceError } from '../error-mapper.js';

export const writerProfilesRouter = createRouter({
  list: userProcedure
    .use(requireScopes('writer-profiles:read'))
    .query(async ({ ctx }) => {
      try {
        return await writerProfileService.list(
          ctx.dbTx,
          ctx.authContext.userId,
        );
      } catch (e) {
        mapServiceError(e);
      }
    }),

  create: userProcedure
    .use(requireScopes('writer-profiles:write'))
    .input(createWriterProfileSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        return await writerProfileService.createWithAudit(
          toUserServiceContext(ctx),
          input,
        );
      } catch (e) {
        mapServiceError(e);
      }
    }),

  update: userProcedure
    .use(requireScopes('writer-profiles:write'))
    .input(
      z.object({
        id: z.string().uuid(),
        data: updateWriterProfileSchema,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        return await writerProfileService.updateWithAudit(
          toUserServiceContext(ctx),
          input.id,
          input.data,
        );
      } catch (e) {
        mapServiceError(e);
      }
    }),

  delete: userProcedure
    .use(requireScopes('writer-profiles:write'))
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      try {
        await writerProfileService.deleteWithAudit(
          toUserServiceContext(ctx),
          input.id,
        );
        return { success: true as const };
      } catch (e) {
        mapServiceError(e);
      }
    }),
});
