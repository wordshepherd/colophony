import { z } from 'zod';
import {
  listNotificationsSchema,
  notificationResponseSchema,
  markNotificationReadSchema,
  unreadCountResponseSchema,
  AuditActions,
  AuditResources,
} from '@colophony/types';
import { orgProcedure, createRouter } from '../init.js';
import { notificationService } from '../../services/notification.service.js';

export const notificationsRouter = createRouter({
  list: orgProcedure
    .input(listNotificationsSchema)
    .output(
      z.object({
        items: z.array(notificationResponseSchema),
        total: z.number(),
      }),
    )
    .query(async ({ ctx, input }) => {
      return notificationService.list(ctx.dbTx, {
        userId: ctx.authContext.userId,
        unreadOnly: input.unreadOnly,
        page: input.page,
        limit: input.limit,
      });
    }),

  unreadCount: orgProcedure
    .output(unreadCountResponseSchema)
    .query(async ({ ctx }) => {
      const count = await notificationService.unreadCount(
        ctx.dbTx,
        ctx.authContext.userId,
      );
      return { count };
    }),

  markRead: orgProcedure
    .input(markNotificationReadSchema)
    .output(z.object({ success: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      const success = await notificationService.markRead(
        ctx.dbTx,
        input.id,
        ctx.authContext.userId,
      );
      if (success) {
        await ctx.audit({
          action: AuditActions.IN_APP_NOTIFICATION_READ,
          resource: AuditResources.NOTIFICATION_INBOX,
          resourceId: input.id,
        });
      }
      return { success };
    }),

  markAllRead: orgProcedure
    .output(z.object({ count: z.number() }))
    .mutation(async ({ ctx }) => {
      const count = await notificationService.markAllRead(
        ctx.dbTx,
        ctx.authContext.userId,
      );
      if (count > 0) {
        await ctx.audit({
          action: AuditActions.IN_APP_NOTIFICATION_ALL_READ,
          resource: AuditResources.NOTIFICATION_INBOX,
          newValue: { count },
        });
      }
      return { count };
    }),
});
