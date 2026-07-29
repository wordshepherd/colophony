import { z } from 'zod';
import {
  AuditActions,
  AuditResources,
  idParamSchema,
  paginatedResponseSchema,
  notificationResponseSchema,
  unreadCountResponseSchema,
  upsertNotificationPreferenceSchema,
  bulkUpsertNotificationPreferencesSchema,
  notificationPreferenceResponseSchema,
} from '@colophony/types';
import { restListNotificationsQuery } from '@colophony/api-contracts';
import { notificationService } from '../../services/notification.service.js';
import { notificationPreferenceService } from '../../services/notification-preference.service.js';
import { orgProcedure, requireScopes } from '../context.js';

// ---------------------------------------------------------------------------
// Output schemas
// ---------------------------------------------------------------------------

const paginatedNotificationsSchema = paginatedResponseSchema(
  notificationResponseSchema,
);

const markReadResponseSchema = z.object({
  success: z
    .boolean()
    .describe(
      'False when no unread notification matched — either it does not exist, belongs to another user or organization, or was already read.',
    ),
});

const markAllReadResponseSchema = z.object({
  count: z
    .number()
    .int()
    .min(0)
    .describe('Number of notifications marked read'),
});

/**
 * Whose inbox this is.
 *
 * The inbox is per-user, and an API key acts as the user who created it, so a
 * key reads exactly one person's notifications. Integrators reliably assume the
 * opposite — that a credential scoped to an organization returns that
 * organization's activity — so both read routes say so outright rather than
 * leaving it to be inferred from a 200 with surprising contents.
 */
const INBOX_SCOPE_NOTE =
  ' Returns the inbox of the user this credential acts as. An API key acts as ' +
  'the user who created it, so this is that person’s notifications, not an ' +
  'organization-wide feed. To receive organization-level events, register a ' +
  'webhook endpoint instead.';

// ---------------------------------------------------------------------------
// Notification routes
// ---------------------------------------------------------------------------

const list = orgProcedure
  .use(requireScopes('notifications:read'))
  .route({
    method: 'GET',
    path: '/notifications',
    summary: 'List notifications',
    description:
      'Returns a paginated list of in-app notifications, newest first.' +
      INBOX_SCOPE_NOTE,
    operationId: 'listNotifications',
    tags: ['Notifications'],
  })
  .input(restListNotificationsQuery)
  .output(paginatedNotificationsSchema)
  .handler(async ({ input, context }) => {
    return notificationService.list(
      context.dbTx,
      {
        userId: context.authContext.userId,
        unreadOnly: input.unreadOnly,
        page: input.page,
        limit: input.limit,
      },
      context.authContext.orgId,
    );
  });

const unreadCount = orgProcedure
  .use(requireScopes('notifications:read'))
  .route({
    method: 'GET',
    path: '/notifications/unread-count',
    summary: 'Get unread notification count',
    description:
      'Returns the number of unread in-app notifications.' + INBOX_SCOPE_NOTE,
    operationId: 'getUnreadNotificationCount',
    tags: ['Notifications'],
  })
  .output(unreadCountResponseSchema)
  .handler(async ({ context }) => {
    const count = await notificationService.unreadCount(
      context.dbTx,
      context.authContext.userId,
      context.authContext.orgId,
    );
    return { count };
  });

const markRead = orgProcedure
  .use(requireScopes('notifications:write'))
  .route({
    method: 'POST',
    path: '/notifications/{id}/read',
    summary: 'Mark a notification as read',
    description:
      'Marks a single unread notification as read. Returns `success: false` ' +
      'rather than an error when nothing matched, so re-sending is safe.',
    operationId: 'markNotificationRead',
    tags: ['Notifications'],
  })
  .input(idParamSchema)
  .output(markReadResponseSchema)
  .handler(async ({ input, context }) => {
    const success = await notificationService.markRead(
      context.dbTx,
      input.id,
      context.authContext.userId,
      context.authContext.orgId,
    );
    // Audit only a real state change, matching the tRPC twin — a no-op retry
    // should not accumulate audit rows.
    if (success) {
      await context.audit({
        action: AuditActions.IN_APP_NOTIFICATION_READ,
        resource: AuditResources.NOTIFICATION_INBOX,
        resourceId: input.id,
      });
    }
    return { success };
  });

const markAllRead = orgProcedure
  .use(requireScopes('notifications:write'))
  .route({
    method: 'POST',
    path: '/notifications/read-all',
    summary: 'Mark all notifications as read',
    description:
      'Marks every unread notification as read and returns how many changed.' +
      INBOX_SCOPE_NOTE,
    operationId: 'markAllNotificationsRead',
    tags: ['Notifications'],
  })
  .output(markAllReadResponseSchema)
  .handler(async ({ context }) => {
    const count = await notificationService.markAllRead(
      context.dbTx,
      context.authContext.userId,
      context.authContext.orgId,
    );
    if (count > 0) {
      await context.audit({
        action: AuditActions.IN_APP_NOTIFICATION_ALL_READ,
        resource: AuditResources.NOTIFICATION_INBOX,
        newValue: { count },
      });
    }
    return { count };
  });

// ---------------------------------------------------------------------------
// Notification preference routes
// ---------------------------------------------------------------------------

const listPreferences = orgProcedure
  .use(requireScopes('notifications:read'))
  .route({
    method: 'GET',
    path: '/notification-preferences',
    summary: 'List notification preferences',
    description:
      'Returns the per-channel, per-event notification preferences for the ' +
      'current user in this organization. Unpaginated: the set is bounded by ' +
      'the number of event types and channels. An event type with no stored ' +
      'row is enabled by default.',
    operationId: 'listNotificationPreferences',
    tags: ['Notifications'],
  })
  .output(z.array(notificationPreferenceResponseSchema))
  .handler(async ({ context }) => {
    return notificationPreferenceService.listForUser(
      context.dbTx,
      context.authContext.orgId,
      context.authContext.userId,
    );
  });

const upsertPreference = orgProcedure
  .use(requireScopes('notifications:write'))
  .route({
    method: 'PUT',
    path: '/notification-preferences',
    summary: 'Set a notification preference',
    description:
      'Creates or updates one preference. Identity is the ' +
      '(channel, eventType) pair carried in the body, so this is idempotent — ' +
      'repeating a call with the same pair overwrites rather than duplicating.',
    operationId: 'upsertNotificationPreference',
    tags: ['Notifications'],
  })
  .input(upsertNotificationPreferenceSchema)
  .output(notificationPreferenceResponseSchema)
  .handler(async ({ input, context }) => {
    const result = await notificationPreferenceService.upsert(context.dbTx, {
      organizationId: context.authContext.orgId,
      userId: context.authContext.userId,
      channel: input.channel,
      eventType: input.eventType,
      enabled: input.enabled,
    });
    await context.audit({
      action: AuditActions.NOTIFICATION_PREFERENCE_UPDATED,
      resource: AuditResources.NOTIFICATION_PREFERENCE,
      resourceId: result.id,
      newValue: input,
    });
    return result;
  });

const bulkUpsertPreferences = orgProcedure
  .use(requireScopes('notifications:write'))
  .route({
    method: 'PUT',
    path: '/notification-preferences/batch',
    summary: 'Set notification preferences in bulk',
    description:
      'Creates or updates up to 50 preferences in one request. Applied inside ' +
      'a single transaction, so the batch either lands whole or not at all.',
    operationId: 'bulkUpsertNotificationPreferences',
    tags: ['Notifications'],
  })
  .input(bulkUpsertNotificationPreferencesSchema)
  .output(z.array(notificationPreferenceResponseSchema))
  .handler(async ({ input, context }) => {
    const results = await notificationPreferenceService.bulkUpsert(
      context.dbTx,
      context.authContext.orgId,
      context.authContext.userId,
      input.preferences,
    );
    await context.audit({
      action: AuditActions.NOTIFICATION_PREFERENCE_UPDATED,
      resource: AuditResources.NOTIFICATION_PREFERENCE,
      newValue: { count: input.preferences.length },
    });
    return results;
  });

// ---------------------------------------------------------------------------
// Assembled router
// ---------------------------------------------------------------------------

export const notificationsRouter = {
  list,
  unreadCount,
  markRead,
  markAllRead,
  listPreferences,
  upsertPreference,
  bulkUpsertPreferences,
};
