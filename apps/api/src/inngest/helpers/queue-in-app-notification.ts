import { withRls } from '@colophony/db';
import { AuditActions, AuditResources } from '@colophony/types';
import { notificationPreferenceService } from '../../services/notification-preference.service.js';
import { notificationService } from '../../services/notification.service.js';
import { auditService } from '../../services/audit.service.js';
import { publishNotification } from '../../sse/redis-pubsub.js';
import { validateEnv } from '../../config/env.js';

export async function queueInAppNotification(params: {
  orgId: string;
  userId: string;
  eventType: string;
  title: string;
  body?: string;
  link?: string;
}): Promise<{ created: boolean; id?: string }> {
  const enabled = await withRls({ orgId: params.orgId }, async (tx) => {
    return notificationPreferenceService.isInAppEnabled(
      tx,
      params.orgId,
      params.userId,
      params.eventType,
    );
  });

  if (!enabled) return { created: false };

  const row = await withRls({ orgId: params.orgId }, async (tx) => {
    const result = await notificationService.create(tx, {
      organizationId: params.orgId,
      userId: params.userId,
      eventType: params.eventType,
      title: params.title,
      body: params.body,
      link: params.link,
    });
    await auditService.log(tx, {
      resource: AuditResources.NOTIFICATION_INBOX,
      action: AuditActions.IN_APP_NOTIFICATION_CREATED,
      resourceId: result.id,
      organizationId: params.orgId,
      newValue: {
        eventType: params.eventType,
        title: params.title,
        userId: params.userId,
      },
    });
    return result;
  });

  // Publish to Redis outside RLS transaction
  const env = validateEnv();
  await publishNotification(env, params.orgId, params.userId, {
    id: row.id,
    eventType: params.eventType,
    title: params.title,
    body: params.body ?? null,
    link: params.link ?? null,
    createdAt: new Date().toISOString(),
  });

  return { created: true, id: row.id };
}
