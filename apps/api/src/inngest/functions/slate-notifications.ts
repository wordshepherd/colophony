import type { InngestFunction } from 'inngest';
import {
  withRls,
  db,
  submissions,
  organizations,
  users,
  eq,
} from '@colophony/db';
import { pipelineItems } from '@colophony/db';
import { AuditActions, AuditResources } from '@colophony/types';
import { inngest } from '../client.js';
import type {
  ContractGeneratedEvent,
  CopyeditorAssignedEvent,
} from '../events.js';
import { notificationPreferenceService } from '../../services/notification-preference.service.js';
import { emailService } from '../../services/email.service.js';
import { auditService } from '../../services/audit.service.js';
import { enqueueEmail } from '../../queues/email.queue.js';
import { validateEnv } from '../../config/env.js';
import { queueInAppNotification } from '../helpers/queue-in-app-notification.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function getUserEmail(userId: string) {
  const [user] = await db
    .select({ email: users.email })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return user ?? null;
}

async function queueEmailForRecipient(params: {
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

// ---------------------------------------------------------------------------
// Inngest functions
// ---------------------------------------------------------------------------

export const contractReadyNotification: InngestFunction.Any =
  inngest.createFunction(
    {
      id: 'contract-ready-notification',
      name: 'Contract Ready Notification',
      retries: 3,
      triggers: [{ event: 'slate/contract.generated' }],
    },
    async ({ event, step }) => {
      const { orgId, pipelineItemId } =
        event.data as ContractGeneratedEvent['data'];

      const data = await step.run('resolve-data', async () => {
        return withRls({ orgId }, async (tx) => {
          // Get pipeline item → submission → submitter
          const [item] = await tx
            .select({ submissionId: pipelineItems.submissionId })
            .from(pipelineItems)
            .where(eq(pipelineItems.id, pipelineItemId))
            .limit(1);

          if (!item) return null;

          const [submission] = await tx
            .select({
              title: submissions.title,
              submitterId: submissions.submitterId,
            })
            .from(submissions)
            .where(eq(submissions.id, item.submissionId))
            .limit(1);

          const [org] = await tx
            .select({ name: organizations.name })
            .from(organizations)
            .where(eq(organizations.id, orgId))
            .limit(1);

          return {
            submissionTitle: submission?.title ?? 'Unknown',
            submitterId: submission?.submitterId,
            orgName: org?.name ?? 'Unknown Organization',
          };
        });
      });

      if (!data?.submitterId)
        return { skipped: true, reason: 'no-submitter-found' };

      const submitter = await step.run('get-submitter', async () =>
        getUserEmail(data.submitterId),
      );

      if (!submitter) return { skipped: true, reason: 'submitter-not-found' };

      await step.run('queue-email', async () => {
        await queueEmailForRecipient({
          orgId,
          userId: data.submitterId!,
          email: submitter.email,
          eventType: 'contract.ready',
          templateName: 'contract-ready',
          templateData: {
            submissionTitle: data.submissionTitle,
            signerName: submitter.email,
            orgName: data.orgName,
          },
          subject: `Contract ready for signing: ${data.submissionTitle}`,
        });
      });

      await step.run('queue-in-app', async () => {
        await queueInAppNotification({
          orgId,
          userId: data.submitterId!,
          eventType: 'contract.ready',
          title: `Contract ready for signing: ${data.submissionTitle}`,
          link: '/contracts',
        });
      });

      return { notified: 1 };
    },
  );

export const copyeditorAssignedNotification: InngestFunction.Any =
  inngest.createFunction(
    {
      id: 'copyeditor-assigned-notification',
      name: 'Copyeditor Assigned Notification',
      retries: 3,
      triggers: [{ event: 'slate/pipeline.copyeditor-assigned' }],
    },
    async ({ event, step }) => {
      const { orgId, pipelineItemId, copyeditorId } =
        event.data as CopyeditorAssignedEvent['data'];

      const data = await step.run('resolve-data', async () => {
        return withRls({ orgId }, async (tx) => {
          const [item] = await tx
            .select({ submissionId: pipelineItems.submissionId })
            .from(pipelineItems)
            .where(eq(pipelineItems.id, pipelineItemId))
            .limit(1);

          if (!item) return null;

          const [submission] = await tx
            .select({ title: submissions.title })
            .from(submissions)
            .where(eq(submissions.id, item.submissionId))
            .limit(1);

          const [org] = await tx
            .select({ name: organizations.name })
            .from(organizations)
            .where(eq(organizations.id, orgId))
            .limit(1);

          return {
            submissionTitle: submission?.title ?? 'Unknown',
            orgName: org?.name ?? 'Unknown Organization',
          };
        });
      });

      if (!data) return { skipped: true, reason: 'pipeline-item-not-found' };

      const copyeditor = await step.run('get-copyeditor', async () =>
        getUserEmail(copyeditorId),
      );

      if (!copyeditor) return { skipped: true, reason: 'copyeditor-not-found' };

      await step.run('queue-email', async () => {
        await queueEmailForRecipient({
          orgId,
          userId: copyeditorId,
          email: copyeditor.email,
          eventType: 'copyeditor.assigned',
          templateName: 'copyeditor-assigned',
          templateData: {
            submissionTitle: data.submissionTitle,
            copyeditorName: copyeditor.email,
            orgName: data.orgName,
          },
          subject: `You've been assigned as copyeditor: ${data.submissionTitle}`,
        });
      });

      await step.run('queue-in-app', async () => {
        await queueInAppNotification({
          orgId,
          userId: copyeditorId,
          eventType: 'copyeditor.assigned',
          title: `You've been assigned as copyeditor: ${data.submissionTitle}`,
          link: '/pipeline',
        });
      });

      return { notified: 1 };
    },
  );
