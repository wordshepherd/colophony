import { z } from 'zod';
import {
  migrationListQuerySchema,
  requestMigrationInputSchema,
} from '@colophony/types';
import { authedProcedure, createRouter } from '../init.js';
import { mapServiceError } from '../error-mapper.js';
import { migrationService } from '../../services/migration.service.js';
import { validateEnv } from '../../config/env.js';

export const migrationRouter = createRouter({
  list: authedProcedure
    .input(migrationListQuerySchema)
    .query(async ({ ctx, input }) => {
      try {
        const userId = ctx.authContext.userId;
        return await migrationService.listMigrationsForUser(userId, input);
      } catch (error) {
        mapServiceError(error);
      }
    }),

  getById: authedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      try {
        const userId = ctx.authContext.userId;
        return await migrationService.getMigrationById(userId, input.id);
      } catch (error) {
        mapServiceError(error);
      }
    }),

  listPending: authedProcedure.query(async ({ ctx }) => {
    try {
      const userId = ctx.authContext.userId;
      return await migrationService.getPendingApprovalForUser(userId);
    } catch (error) {
      mapServiceError(error);
    }
  }),

  request: authedProcedure
    .input(requestMigrationInputSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        const env = validateEnv();
        const userId = ctx.authContext.userId;
        return await migrationService.requestMigration(env, {
          userId,
          organizationId: input.organizationId,
          originDomain: input.originDomain,
          originEmail: input.originEmail,
        });
      } catch (error) {
        mapServiceError(error);
      }
    }),

  approve: authedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      try {
        const env = validateEnv();
        const userId = ctx.authContext.userId;
        await migrationService.approveMigration(env, {
          userId,
          migrationId: input.id,
        });
        return { success: true };
      } catch (error) {
        mapServiceError(error);
      }
    }),

  reject: authedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      try {
        const env = validateEnv();
        const userId = ctx.authContext.userId;
        await migrationService.rejectMigration(env, {
          userId,
          migrationId: input.id,
        });
        return { success: true };
      } catch (error) {
        mapServiceError(error);
      }
    }),

  cancel: authedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      try {
        const userId = ctx.authContext.userId;
        await migrationService.cancelMigration(userId, input.id);
        return { success: true };
      } catch (error) {
        mapServiceError(error);
      }
    }),
});
