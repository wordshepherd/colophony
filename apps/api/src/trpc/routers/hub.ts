import { z } from 'zod';
import { hubInstanceListQuerySchema } from '@colophony/types';
import { adminProcedure, createRouter } from '../init.js';
import { mapServiceError } from '../error-mapper.js';
import { hubService } from '../../services/hub.service.js';
import { validateEnv } from '../../config/env.js';

export const hubRouter = createRouter({
  listInstances: adminProcedure
    .input(hubInstanceListQuerySchema.optional())
    .query(async ({ input }) => {
      try {
        const env = validateEnv();
        await hubService.assertHubMode(env);
        return await hubService.listInstances(input ?? undefined);
      } catch (error) {
        mapServiceError(error);
      }
    }),

  getInstanceById: adminProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ input }) => {
      try {
        const env = validateEnv();
        await hubService.assertHubMode(env);
        return await hubService.getInstanceById(input.id);
      } catch (error) {
        mapServiceError(error);
      }
    }),

  suspendInstance: adminProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      try {
        const env = validateEnv();
        await hubService.assertHubMode(env);
        const actorId = ctx.authContext.userId;
        await hubService.suspendInstance(input.id, actorId);
        return { success: true };
      } catch (error) {
        mapServiceError(error);
      }
    }),

  revokeInstance: adminProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      try {
        const env = validateEnv();
        await hubService.assertHubMode(env);
        const actorId = ctx.authContext.userId;
        await hubService.revokeInstance(input.id, actorId);
        return { success: true };
      } catch (error) {
        mapServiceError(error);
      }
    }),
});
