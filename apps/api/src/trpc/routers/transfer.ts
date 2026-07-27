import { z } from 'zod';
import { transferListQuerySchema } from '@colophony/types';
import { internalAdminProcedure, createRouter } from '../init.js';
import { mapServiceError } from '../error-mapper.js';
import { transferService } from '../../services/transfer.service.js';

export const transferRouter = createRouter({
  list: internalAdminProcedure
    .input(transferListQuerySchema)
    .query(async ({ ctx, input }) => {
      try {
        const orgId = ctx.authContext.orgId;
        return await transferService.listTransfersForOrg(orgId, input);
      } catch (error) {
        mapServiceError(error);
      }
    }),

  getById: internalAdminProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      try {
        const orgId = ctx.authContext.orgId;
        return await transferService.getTransferById(orgId, input.id);
      } catch (error) {
        mapServiceError(error);
      }
    }),

  cancel: internalAdminProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      try {
        const orgId = ctx.authContext.orgId;
        const userId = ctx.authContext.userId;
        await transferService.cancelTransfer(orgId, userId, input.id);
        return { success: true };
      } catch (error) {
        mapServiceError(error);
      }
    }),
});
