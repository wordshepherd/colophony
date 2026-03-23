import type { InngestFunction } from 'inngest';
import {
  withRls,
  db,
  submissions,
  organizations,
  users,
  eq,
} from '@colophony/db';
import { inngest } from '../client.js';
import type { HopperReviewerAssignedEvent } from '../events.js';
import { notificationPreferenceService } from '../../services/notification-preference.service.js';
import { emailService } from '../../services/email.service.js';
import { auditService } from '../../services/audit.service.js';
import { enqueueEmail } from '../../queues/email.queue.js';
import { validateEnv } from '../../config/env.js';
import { AuditActions, AuditResources } from '@colophony/types';
import { queueInAppNotification } from '../helpers/queue-in-app-notification.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function getSubmissionAndOrg(orgId: string, submissionId: string) {
  return withRls({ orgId }, async (tx) => {
    const [submission] = await tx
      .select({ id: submissions.id, title: submissions.title })
      .from(submissions)
      .where(eq(submissions.id, submissionId))
      .limit(1);

    const [org] = await tx
      .select({ name: organizations.name })
      .from(organizations)
      .where(eq(organizations.id, orgId))
      .limit(1);

    return { submission, orgName: org?.name ?? 'Unknown Organization' };
  });
}

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
// Inngest function
// ---------------------------------------------------------------------------

export const reviewerAssignedNotification: InngestFunction.Any =
  inngest.createFunction(
    {
      id: 'reviewer-assigned-notification',
      name: 'Reviewer Assigned Notification',
      retries: 3,
      triggers: [{ event: 'hopper/reviewer.assigned' }],
    },
    async ({ event, step }) => {
      const { orgId, submissionId, reviewerUserId, assignedBy } =
        event.data as HopperReviewerAssignedEvent['data'];

      const { submission, orgName } = await step.run('resolve-data', async () =>
        getSubmissionAndOrg(orgId, submissionId),
      );

      if (!submission) return { skipped: true, reason: 'submission-not-found' };

      const reviewer = await step.run('get-reviewer', async () =>
        getUserEmail(reviewerUserId),
      );

      if (!reviewer) return { skipped: true, reason: 'reviewer-not-found' };

      const assigner = await step.run('get-assigner', async () =>
        getUserEmail(assignedBy),
      );

      await step.run('queue-email', async () => {
        await queueEmailForRecipient({
          orgId,
          userId: reviewerUserId,
          email: reviewer.email,
          eventType: 'reviewer.assigned',
          templateName: 'reviewer-assigned',
          templateData: {
            submissionTitle: submission.title,
            orgName,
            assignedByName: assigner?.email ?? 'An editor',
          },
          subject: `You've been assigned to review: ${submission.title}`,
        });
      });

      await step.run('queue-in-app', async () => {
        await queueInAppNotification({
          orgId,
          userId: reviewerUserId,
          eventType: 'reviewer.assigned',
          title: `You've been assigned to review: ${submission.title}`,
          link: `/submissions/${submissionId}`,
        });
      });

      return { notified: 1 };
    },
  );
