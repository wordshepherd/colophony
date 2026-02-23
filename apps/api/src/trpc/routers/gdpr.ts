import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { successResponseSchema } from '@colophony/types';
import { authedProcedure, createRouter } from '../init.js';
import {
  gdprService,
  UserNotDeletableError,
} from '../../services/gdpr.service.js';
import { validateEnv } from '../../config/env.js';

export const gdprRouter = createRouter({
  deleteAccount: authedProcedure
    .output(successResponseSchema.extend({ storageKeysEnqueued: z.number() }))
    .mutation(async ({ ctx }) => {
      const env = validateEnv();
      try {
        const result = await gdprService.deleteUser(
          ctx.authContext.userId,
          env,
        );
        return {
          success: true as const,
          storageKeysEnqueued: result.storageKeysEnqueued,
        };
      } catch (err) {
        if (err instanceof UserNotDeletableError) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: err.message,
          });
        }
        throw err;
      }
    }),
});
