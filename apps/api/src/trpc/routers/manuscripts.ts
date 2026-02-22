import { z } from 'zod';
import {
  createManuscriptSchema,
  updateManuscriptSchema,
  listManuscriptsSchema,
  createManuscriptVersionSchema,
} from '@colophony/types';
import { createRouter, userProcedure, requireScopes } from '../init.js';
import { toUserServiceContext } from '../../services/context.js';
import {
  manuscriptService,
  ManuscriptNotFoundError,
} from '../../services/manuscript.service.js';
import { mapServiceError } from '../error-mapper.js';

export const manuscriptsRouter = createRouter({
  list: userProcedure
    .use(requireScopes('manuscripts:read'))
    .input(listManuscriptsSchema)
    .query(async ({ ctx, input }) => {
      try {
        return await manuscriptService.list(
          ctx.dbTx,
          ctx.authContext.userId,
          input,
        );
      } catch (e) {
        mapServiceError(e);
      }
    }),

  getById: userProcedure
    .use(requireScopes('manuscripts:read'))
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      try {
        const manuscript = await manuscriptService.getById(ctx.dbTx, input.id);
        if (!manuscript) throw new ManuscriptNotFoundError(input.id);
        return manuscript;
      } catch (e) {
        mapServiceError(e);
      }
    }),

  getDetail: userProcedure
    .use(requireScopes('manuscripts:read'))
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      try {
        const detail = await manuscriptService.getDetail(ctx.dbTx, input.id);
        if (!detail) throw new ManuscriptNotFoundError(input.id);
        return detail;
      } catch (e) {
        mapServiceError(e);
      }
    }),

  create: userProcedure
    .use(requireScopes('manuscripts:write'))
    .input(createManuscriptSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        return await manuscriptService.createWithAudit(
          toUserServiceContext(ctx),
          input,
        );
      } catch (e) {
        mapServiceError(e);
      }
    }),

  update: userProcedure
    .use(requireScopes('manuscripts:write'))
    .input(
      z.object({
        id: z.string().uuid(),
        data: updateManuscriptSchema,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        return await manuscriptService.updateWithAudit(
          toUserServiceContext(ctx),
          input.id,
          input.data,
        );
      } catch (e) {
        mapServiceError(e);
      }
    }),

  delete: userProcedure
    .use(requireScopes('manuscripts:write'))
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      try {
        await manuscriptService.deleteWithAudit(
          toUserServiceContext(ctx),
          input.id,
        );
        return { success: true as const };
      } catch (e) {
        mapServiceError(e);
      }
    }),

  createVersion: userProcedure
    .use(requireScopes('manuscripts:write'))
    .input(createManuscriptVersionSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        return await manuscriptService.createVersionWithAudit(
          toUserServiceContext(ctx),
          input.manuscriptId,
          input.label,
        );
      } catch (e) {
        mapServiceError(e);
      }
    }),

  listVersions: userProcedure
    .use(requireScopes('manuscripts:read'))
    .input(z.object({ manuscriptId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      try {
        const manuscript = await manuscriptService.getById(
          ctx.dbTx,
          input.manuscriptId,
        );
        if (!manuscript) throw new ManuscriptNotFoundError(input.manuscriptId);
        return await manuscriptService.listVersions(
          ctx.dbTx,
          input.manuscriptId,
        );
      } catch (e) {
        mapServiceError(e);
      }
    }),

  getRelatedSubmissions: userProcedure
    .use(requireScopes('manuscripts:read'))
    .input(z.object({ manuscriptId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      try {
        const manuscript = await manuscriptService.getById(
          ctx.dbTx,
          input.manuscriptId,
        );
        if (!manuscript) throw new ManuscriptNotFoundError(input.manuscriptId);
        return await manuscriptService.getRelatedSubmissions(
          ctx.dbTx,
          input.manuscriptId,
        );
      } catch (e) {
        mapServiceError(e);
      }
    }),
});
