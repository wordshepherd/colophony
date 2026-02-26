import {
  withRls,
  db,
  submissions,
  organizations,
  organizationMembers,
  users,
  eq,
  and,
  inArray,
} from '@colophony/db';
import { inngest } from '../client.js';
import type {
  HopperSubmissionSubmittedEvent,
  HopperSubmissionAcceptedEvent,
  HopperSubmissionRejectedEvent,
  HopperSubmissionWithdrawnEvent,
} from '../events.js';
import { notificationPreferenceService } from '../../services/notification-preference.service.js';
import { emailService } from '../../services/email.service.js';
import { enqueueEmail } from '../../queues/email.queue.js';
import { validateEnv } from '../../config/env.js';

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

async function getOrgEditors(orgId: string) {
  return withRls({ orgId }, async (tx) => {
    const members = await tx
      .select({
        userId: organizationMembers.userId,
        email: users.email,
      })
      .from(organizationMembers)
      .innerJoin(users, eq(users.id, organizationMembers.userId))
      .where(
        and(
          eq(organizationMembers.organizationId, orgId),
          inArray(organizationMembers.role, ['ADMIN', 'EDITOR']),
        ),
      );
    return members;
  });
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
    return emailService.create(tx, {
      organizationId: params.orgId,
      recipientUserId: params.userId,
      recipientEmail: params.email,
      templateName: params.templateName,
      eventType: params.eventType,
      subject: params.subject,
    });
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

export const submissionReceivedNotification = inngest.createFunction(
  {
    id: 'submission-received-notification',
    name: 'Submission Received Notification',
    retries: 3,
  },
  { event: 'hopper/submission.submitted' },
  async ({ event, step }) => {
    const { orgId, submissionId, submitterId } =
      event.data as HopperSubmissionSubmittedEvent['data'];

    const { submission, orgName } = await step.run('resolve-data', async () =>
      getSubmissionAndOrg(orgId, submissionId),
    );

    if (!submission) return { skipped: true, reason: 'submission-not-found' };

    const submitter = await step.run('get-submitter', async () =>
      getUserEmail(submitterId),
    );

    const editors = await step.run('get-editors', async () =>
      getOrgEditors(orgId),
    );

    await step.run('queue-emails', async () => {
      for (const editor of editors) {
        await queueEmailForRecipient({
          orgId,
          userId: editor.userId,
          email: editor.email,
          eventType: 'submission.received',
          templateName: 'submission-received',
          templateData: {
            submissionTitle: submission.title,
            submitterName: submitter?.email ?? 'Unknown',
            submitterEmail: submitter?.email ?? 'unknown',
            orgName,
          },
          subject: `New submission: ${submission.title}`,
        });
      }
    });

    return { notified: editors.length };
  },
);

export const submissionAcceptedNotification = inngest.createFunction(
  {
    id: 'submission-accepted-notification',
    name: 'Submission Accepted Notification',
    retries: 3,
  },
  { event: 'hopper/submission.accepted' },
  async ({ event, step }) => {
    const { orgId, submissionId, submitterId } =
      event.data as HopperSubmissionAcceptedEvent['data'];

    const { submission, orgName } = await step.run('resolve-data', async () =>
      getSubmissionAndOrg(orgId, submissionId),
    );

    if (!submission) return { skipped: true, reason: 'submission-not-found' };

    const submitter = await step.run('get-submitter', async () =>
      getUserEmail(submitterId),
    );

    if (!submitter) return { skipped: true, reason: 'submitter-not-found' };

    await step.run('queue-email', async () => {
      await queueEmailForRecipient({
        orgId,
        userId: submitterId,
        email: submitter.email,
        eventType: 'submission.accepted',
        templateName: 'submission-accepted',
        templateData: {
          submissionTitle: submission.title,
          submitterName: submitter.email,
          submitterEmail: submitter.email,
          orgName,
        },
        subject: `Your submission has been accepted: ${submission.title}`,
      });
    });

    return { notified: 1 };
  },
);

export const submissionRejectedNotification = inngest.createFunction(
  {
    id: 'submission-rejected-notification',
    name: 'Submission Rejected Notification',
    retries: 3,
  },
  { event: 'hopper/submission.rejected' },
  async ({ event, step }) => {
    const { orgId, submissionId, submitterId } =
      event.data as HopperSubmissionRejectedEvent['data'];

    const { submission, orgName } = await step.run('resolve-data', async () =>
      getSubmissionAndOrg(orgId, submissionId),
    );

    if (!submission) return { skipped: true, reason: 'submission-not-found' };

    const submitter = await step.run('get-submitter', async () =>
      getUserEmail(submitterId),
    );

    if (!submitter) return { skipped: true, reason: 'submitter-not-found' };

    await step.run('queue-email', async () => {
      await queueEmailForRecipient({
        orgId,
        userId: submitterId,
        email: submitter.email,
        eventType: 'submission.rejected',
        templateName: 'submission-rejected',
        templateData: {
          submissionTitle: submission.title,
          submitterName: submitter.email,
          submitterEmail: submitter.email,
          orgName,
        },
        subject: `Update on your submission: ${submission.title}`,
      });
    });

    return { notified: 1 };
  },
);

export const submissionWithdrawnNotification = inngest.createFunction(
  {
    id: 'submission-withdrawn-notification',
    name: 'Submission Withdrawn Notification',
    retries: 3,
  },
  { event: 'hopper/submission.withdrawn' },
  async ({ event, step }) => {
    const { orgId, submissionId, submitterId } =
      event.data as HopperSubmissionWithdrawnEvent['data'];

    const { submission, orgName } = await step.run('resolve-data', async () =>
      getSubmissionAndOrg(orgId, submissionId),
    );

    if (!submission) return { skipped: true, reason: 'submission-not-found' };

    const submitter = await step.run('get-submitter', async () =>
      getUserEmail(submitterId),
    );

    const editors = await step.run('get-editors', async () =>
      getOrgEditors(orgId),
    );

    await step.run('queue-emails', async () => {
      for (const editor of editors) {
        await queueEmailForRecipient({
          orgId,
          userId: editor.userId,
          email: editor.email,
          eventType: 'submission.withdrawn',
          templateName: 'submission-withdrawn',
          templateData: {
            submissionTitle: submission.title,
            submitterName: submitter?.email ?? 'Unknown',
            submitterEmail: submitter?.email ?? 'unknown',
            orgName,
          },
          subject: `Submission withdrawn: ${submission.title}`,
        });
      }
    });

    return { notified: editors.length };
  },
);
