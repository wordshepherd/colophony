import { z } from 'zod';
import {
  queuePresetSchema,
  presetFiltersSchema,
  createQueuePresetSchema,
  updateQueuePresetSchema,
  deleteQueuePresetSchema,
  type QueuePreset,
} from '@colophony/types';
import { orgProcedure, createRouter, requireScopes } from '../init.js';
import { queuePresetService } from '../../services/queue-preset.service.js';
import { mapServiceError } from '../error-mapper.js';

/** Parse JSONB `filters` from Drizzle row into typed object. */
function toPreset(
  row: { filters: unknown } & Record<string, unknown>,
): QueuePreset {
  return {
    ...row,
    filters: presetFiltersSchema.parse(row.filters),
  } as QueuePreset;
}

export const queuePresetsRouter = createRouter({
  list: orgProcedure
    .use(requireScopes('submissions:read'))
    .output(z.array(queuePresetSchema))
    .query(async ({ ctx }) => {
      try {
        const rows = await queuePresetService.list(
          ctx.dbTx,
          ctx.authContext.userId,
          ctx.authContext.orgId,
        );
        return rows.map(toPreset);
      } catch (e) {
        mapServiceError(e);
      }
    }),

  create: orgProcedure
    .use(requireScopes('submissions:read'))
    .input(createQueuePresetSchema)
    .output(queuePresetSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        const row = await queuePresetService.create(
          ctx.dbTx,
          ctx.authContext.userId,
          ctx.authContext.orgId,
          input,
        );
        return toPreset(row);
      } catch (e) {
        mapServiceError(e);
      }
    }),

  update: orgProcedure
    .use(requireScopes('submissions:read'))
    .input(updateQueuePresetSchema)
    .output(queuePresetSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        const row = await queuePresetService.update(
          ctx.dbTx,
          ctx.authContext.userId,
          ctx.authContext.orgId,
          input,
        );
        return toPreset(row);
      } catch (e) {
        mapServiceError(e);
      }
    }),

  delete: orgProcedure
    .use(requireScopes('submissions:read'))
    .input(deleteQueuePresetSchema)
    .output(z.object({ deleted: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      try {
        return await queuePresetService.delete(
          ctx.dbTx,
          ctx.authContext.userId,
          ctx.authContext.orgId,
          input.id,
        );
      } catch (e) {
        mapServiceError(e);
      }
    }),
});
