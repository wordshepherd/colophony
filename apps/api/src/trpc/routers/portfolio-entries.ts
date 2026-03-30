import { z } from 'zod';
import {
  createPortfolioEntrySchema,
  updatePortfolioEntrySchema,
  listPortfolioEntriesSchema,
} from '@colophony/types';
import { createRouter, userProcedure, requireScopes } from '../init.js';
import { toUserServiceContext } from '../../services/context.js';
import { portfolioEntryService } from '../../services/portfolio-entry.service.js';
import { mapServiceError } from '../error-mapper.js';

export const portfolioEntriesRouter = createRouter({
  list: userProcedure
    .use(requireScopes('portfolio:read'))
    .input(listPortfolioEntriesSchema)
    .query(async ({ ctx, input }) => {
      try {
        return await portfolioEntryService.list(
          ctx.dbTx,
          ctx.authContext.userId,
          input,
        );
      } catch (e) {
        mapServiceError(e);
      }
    }),

  create: userProcedure
    .use(requireScopes('portfolio:write'))
    .input(createPortfolioEntrySchema)
    .mutation(async ({ ctx, input }) => {
      try {
        return await portfolioEntryService.createWithAudit(
          toUserServiceContext(ctx),
          input,
        );
      } catch (e) {
        mapServiceError(e);
      }
    }),

  update: userProcedure
    .use(requireScopes('portfolio:write'))
    .input(updatePortfolioEntrySchema)
    .mutation(async ({ ctx, input }) => {
      try {
        return await portfolioEntryService.updateWithAudit(
          toUserServiceContext(ctx),
          input,
        );
      } catch (e) {
        mapServiceError(e);
      }
    }),

  delete: userProcedure
    .use(requireScopes('portfolio:write'))
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      try {
        await portfolioEntryService.deleteWithAudit(
          toUserServiceContext(ctx),
          input.id,
        );
        return { success: true as const };
      } catch (e) {
        mapServiceError(e);
      }
    }),
});
