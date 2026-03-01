import { withRls } from '@colophony/db';
import { AuditActions, AuditResources } from '@colophony/types';
import { notificationPreferenceService } from '../../services/notification-preference.service.js';
import { emailService } from '../../services/email.service.js';
import { auditService } from '../../services/audit.service.js';
import { enqueueEmail } from '../../queues/email.queue.js';
import { validateEnv } from '../../config/env.js';

export async function queueEmailForRecipient(params: {
  orgId: string;
  userId: string;
  email: string;
  eventType: string;
  templateName: string;
  templateData: Record<string, unknown>;
  subject: string;
}) {
  const env = validateEnv();
  if (env.EMAIL_PROVIDER === 'none') return;

  const enabled = await withRls({ orgId: params.orgId }, async (tx) => {
    return notificationPreferenceService.isEmailEnabled(
      tx,
      params.orgId,
      params.userId,
      params.eventType,
    );
  });

  if (!enabled) return;

  const emailSend = await withRls({ orgId: params.orgId }, async (tx) => {
    const row = await emailService.create(tx, {
      organizationId: params.orgId,
      recipientUserId: params.userId,
      recipientEmail: params.email,
      templateName: params.templateName,
      eventType: params.eventType,
      subject: params.subject,
    });
    await auditService.log(tx, {
      resource: AuditResources.EMAIL,
      action: AuditActions.EMAIL_QUEUED,
      resourceId: row.id,
      organizationId: params.orgId,
      newValue: {
        to: params.email,
        templateName: params.templateName,
        eventType: params.eventType,
      },
    });
    return row;
  });

  await enqueueEmail(env, {
    emailSendId: emailSend.id,
    orgId: params.orgId,
    to: params.email,
    from: env.SMTP_FROM ?? env.SENDGRID_FROM ?? 'noreply@colophony.dev',
    templateName: params.templateName,
    templateData: params.templateData,
  });
}
