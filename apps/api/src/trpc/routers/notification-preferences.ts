import {
  upsertNotificationPreferenceSchema,
  bulkUpsertNotificationPreferencesSchema,
  notificationPreferenceResponseSchema,
  AuditActions,
  AuditResources,
} from '@colophony/types';
import { z } from 'zod';
import { orgProcedure, createRouter } from '../init.js';
import { notificationPreferenceService } from '../../services/notification-preference.service.js';

export const notificationPreferencesRouter = createRouter({
  list: orgProcedure
    .output(z.array(notificationPreferenceResponseSchema))
    .query(async ({ ctx }) => {
      return notificationPreferenceService.listForUser(
        ctx.dbTx,
        ctx.authContext.userId,
      );
    }),

  upsert: orgProcedure
    .input(upsertNotificationPreferenceSchema)
    .output(notificationPreferenceResponseSchema)
    .mutation(async ({ ctx, input }) => {
      const result = await notificationPreferenceService.upsert(ctx.dbTx, {
        organizationId: ctx.authContext.orgId,
        userId: ctx.authContext.userId,
        channel: input.channel,
        eventType: input.eventType,
        enabled: input.enabled,
      });
      await ctx.audit({
        action: AuditActions.NOTIFICATION_PREFERENCE_UPDATED,
        resource: AuditResources.NOTIFICATION_PREFERENCE,
        resourceId: result.id,
        newValue: input,
      });
      return result;
    }),

  bulkUpsert: orgProcedure
    .input(bulkUpsertNotificationPreferencesSchema)
    .output(z.array(notificationPreferenceResponseSchema))
    .mutation(async ({ ctx, input }) => {
      const results = await notificationPreferenceService.bulkUpsert(
        ctx.dbTx,
        ctx.authContext.orgId,
        ctx.authContext.userId,
        input.preferences,
      );
      await ctx.audit({
        action: AuditActions.NOTIFICATION_PREFERENCE_UPDATED,
        resource: AuditResources.NOTIFICATION_PREFERENCE,
        newValue: { count: input.preferences.length },
      });
      return results;
    }),
});
