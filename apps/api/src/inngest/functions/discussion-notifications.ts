import {
  withRls,
  db,
  submissions,
  organizations,
  users,
  eq,
} from '@colophony/db';
import { inngest } from '../client.js';
import type { HopperDiscussionCommentEvent } from '../events.js';
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

export const discussionCommentNotification = inngest.createFunction(
  {
    id: 'discussion-comment-notification',
    name: 'Discussion Comment Notification',
    retries: 3,
  },
  { event: 'hopper/discussion.comment_added' },
  async ({ event, step }) => {
    const { orgId, submissionId, authorId, recipientUserIds } =
      event.data as HopperDiscussionCommentEvent['data'];

    const { submission, orgName } = await step.run('resolve-data', async () =>
      getSubmissionAndOrg(orgId, submissionId),
    );

    if (!submission) return { skipped: true, reason: 'submission-not-found' };

    const author = await step.run('get-author', async () =>
      getUserEmail(authorId),
    );

    const authorName = author?.email ?? 'A team member';

    let notified = 0;

    for (const recipientId of recipientUserIds) {
      const recipient = await step.run(
        `get-recipient-${recipientId}`,
        async () => getUserEmail(recipientId),
      );

      if (!recipient) continue;

      await step.run(`queue-email-${recipientId}`, async () => {
        await queueEmailForRecipient({
          orgId,
          userId: recipientId,
          email: recipient.email,
          eventType: 'discussion.comment_added',
          templateName: 'discussion-comment',
          templateData: {
            submissionTitle: submission.title,
            orgName,
            authorName,
          },
          subject: `New discussion comment on: ${submission.title}`,
        });
      });

      await step.run(`queue-in-app-${recipientId}`, async () => {
        await queueInAppNotification({
          orgId,
          userId: recipientId,
          eventType: 'discussion.comment_added',
          title: `${authorName} commented on the discussion for: ${submission.title}`,
          link: `/submissions/${submissionId}`,
        });
      });

      notified++;
    }

    return { notified };
  },
);
