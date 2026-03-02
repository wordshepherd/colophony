import { z } from 'zod';
import { transferListQuerySchema } from '@colophony/types';
import { adminProcedure, createRouter } from '../init.js';
import { mapServiceError } from '../error-mapper.js';
import { transferService } from '../../services/transfer.service.js';

export const transferRouter = createRouter({
  list: adminProcedure
    .input(transferListQuerySchema)
    .query(async ({ ctx, input }) => {
      try {
        const orgId = ctx.authContext.orgId;
        return await transferService.listTransfersForOrg(orgId, input);
      } catch (error) {
        mapServiceError(error);
      }
    }),

  getById: adminProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      try {
        const orgId = ctx.authContext.orgId;
        return await transferService.getTransferById(orgId, input.id);
      } catch (error) {
        mapServiceError(error);
      }
    }),

  cancel: adminProcedure
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
