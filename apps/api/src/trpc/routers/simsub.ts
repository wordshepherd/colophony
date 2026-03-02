import { z } from 'zod';
import { withRls, simSubChecks, eq } from '@colophony/db';
import { desc } from 'drizzle-orm';
import { adminProcedure, createRouter } from '../init.js';
import { mapServiceError } from '../error-mapper.js';
import { simsubService } from '../../services/simsub.service.js';

export const simsubRouter = createRouter({
  listChecks: adminProcedure
    .input(z.object({ submissionId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      try {
        const orgId = ctx.authContext.orgId;
        return await withRls({ orgId }, async (tx) => {
          return tx
            .select()
            .from(simSubChecks)
            .where(eq(simSubChecks.submissionId, input.submissionId))
            .orderBy(desc(simSubChecks.createdAt));
        });
      } catch (error) {
        mapServiceError(error);
      }
    }),

  grantOverride: adminProcedure
    .input(z.object({ submissionId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      try {
        const orgId = ctx.authContext.orgId;
        const userId = ctx.authContext.userId;
        await simsubService.grantOverride(orgId, input.submissionId, userId);
        return { success: true };
      } catch (error) {
        mapServiceError(error);
      }
    }),
});
