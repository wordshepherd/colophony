import type { InngestFunction } from 'inngest';
import {
  withRls,
  db,
  submissions,
  organizations,
  organizationMembers,
  users,
  eq,
  and,
  sql,
} from '@colophony/db';
import { inngest } from '../client.js';
import type {
  HopperSubmissionSubmittedEvent,
  HopperSubmissionAcceptedEvent,
  HopperSubmissionRejectedEvent,
  HopperSubmissionWithdrawnEvent,
  HopperSubmissionReviseAndResubmitEvent,
} from '../events.js';
import { orgSettingsSchema } from '@colophony/types';
import { correspondenceService } from '../../services/correspondence.service.js';
import { readerFeedbackService } from '../../services/reader-feedback.service.js';
import { queueInAppNotification } from '../helpers/queue-in-app-notification.js';
import { queueEmailForRecipient } from '../helpers/queue-email-for-recipient.js';

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
          sql`${organizationMembers.roles} && ARRAY['ADMIN', 'EDITOR']::"Role"[]`,
        ),
      );
    return members;
  });
}

// ---------------------------------------------------------------------------
// Inngest functions
// ---------------------------------------------------------------------------

export const submissionReceivedNotification: InngestFunction.Any =
  inngest.createFunction(
    {
      id: 'submission-received-notification',
      name: 'Submission Received Notification',
      retries: 3,
      triggers: [{ event: 'hopper/submission.submitted' }],
    },
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

      await step.run('queue-in-app-notifications', async () => {
        for (const editor of editors) {
          await queueInAppNotification({
            orgId,
            userId: editor.userId,
            eventType: 'submission.received',
            title: `New submission: ${submission.title}`,
            link: `/submissions/${submissionId}`,
          });
        }
      });

      return { notified: editors.length };
    },
  );

export const submissionAcceptedNotification: InngestFunction.Any =
  inngest.createFunction(
    {
      id: 'submission-accepted-notification',
      name: 'Submission Accepted Notification',
      retries: 3,
      triggers: [{ event: 'hopper/submission.accepted' }],
    },
    async ({ event, step }) => {
      const { orgId, submissionId, submitterId, comment } =
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
            editorComment: comment,
          },
          subject: `Your submission has been accepted: ${submission.title}`,
        });
      });

      await step.run('queue-in-app', async () => {
        await queueInAppNotification({
          orgId,
          userId: submitterId,
          eventType: 'submission.accepted',
          title: `Your submission has been accepted: ${submission.title}`,
          link: `/submissions/${submissionId}`,
        });
      });

      await step.run('capture-correspondence', async () => {
        try {
          await withRls({ orgId }, async (tx) => {
            await correspondenceService.create(tx, {
              userId: submitterId,
              submissionId,
              direction: 'outbound',
              channel: 'email',
              sentAt: new Date(),
              subject: `Your submission has been accepted: ${submission.title}`,
              body: comment
                ? `Congratulations! Your submission has been accepted.\n\nNote from the editors:\n${comment}`
                : 'Congratulations! Your submission has been accepted.',
              senderName: null,
              senderEmail: null,
              isPersonalized: !!comment,
              source: 'colophony',
            });
          });
        } catch {
          // Non-fatal: correspondence capture should not block notifications
        }
      });

      return { notified: 1 };
    },
  );

export const submissionRejectedNotification: InngestFunction.Any =
  inngest.createFunction(
    {
      id: 'submission-rejected-notification',
      name: 'Submission Rejected Notification',
      retries: 3,
      triggers: [{ event: 'hopper/submission.rejected' }],
    },
    async ({ event, step }) => {
      const { orgId, submissionId, submitterId, comment, includeFeedback } =
        event.data as HopperSubmissionRejectedEvent['data'];

      const { submission, orgName } = await step.run('resolve-data', async () =>
        getSubmissionAndOrg(orgId, submissionId),
      );

      if (!submission) return { skipped: true, reason: 'submission-not-found' };

      const submitter = await step.run('get-submitter', async () =>
        getUserEmail(submitterId),
      );

      if (!submitter) return { skipped: true, reason: 'submitter-not-found' };

      // Fetch forwarded feedback if requested (defense-in-depth: verify org setting)
      const feedbackItems = includeFeedback
        ? await step.run('fetch-feedback', async () => {
            const org = await withRls({ orgId }, async (tx) => {
              const [row] = await tx
                .select({ settings: organizations.settings })
                .from(organizations)
                .where(eq(organizations.id, orgId))
                .limit(1);
              return row;
            });

            const settings = orgSettingsSchema.safeParse(org?.settings ?? {});
            if (
              !settings.success ||
              !settings.data.feedbackOnRejectionEnabled
            ) {
              return [];
            }

            return withRls({ orgId }, async (tx) =>
              readerFeedbackService.listForwardedForSubmission(
                tx,
                orgId,
                submissionId,
              ),
            );
          })
        : [];

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
            editorComment: comment,
            readerFeedback:
              feedbackItems.length > 0 ? feedbackItems : undefined,
          },
          subject: `Update on your submission: ${submission.title}`,
        });
      });

      await step.run('queue-in-app', async () => {
        await queueInAppNotification({
          orgId,
          userId: submitterId,
          eventType: 'submission.rejected',
          title: `Update on your submission: ${submission.title}`,
          link: `/submissions/${submissionId}`,
        });
      });

      await step.run('capture-correspondence', async () => {
        try {
          const feedbackText =
            feedbackItems.length > 0
              ? `\n\nReader feedback:\n${feedbackItems
                  .map((f: { tags: string[]; comment: string | null }) => {
                    const parts = [...f.tags, f.comment].filter(Boolean);
                    return `- ${parts.join(': ')}`;
                  })
                  .join('\n')}`
              : '';

          await withRls({ orgId }, async (tx) => {
            await correspondenceService.create(tx, {
              userId: submitterId,
              submissionId,
              direction: 'outbound',
              channel: 'email',
              sentAt: new Date(),
              subject: `Update on your submission: ${submission.title}`,
              body: `${
                comment
                  ? `Thank you for your submission. After careful review, we are unable to accept it at this time.\n\nNote from the editors:\n${comment}`
                  : 'Thank you for your submission. After careful review, we are unable to accept it at this time.'
              }${feedbackText}`,
              senderName: null,
              senderEmail: null,
              isPersonalized: !!comment || feedbackItems.length > 0,
              source: 'colophony',
            });
          });
        } catch {
          // Non-fatal: correspondence capture should not block notifications
        }
      });

      return { notified: 1 };
    },
  );

export const submissionReviseAndResubmitNotification: InngestFunction.Any =
  inngest.createFunction(
    {
      id: 'submission-revise-and-resubmit-notification',
      name: 'Submission Revise and Resubmit Notification',
      retries: 3,
      triggers: [{ event: 'hopper/submission.revise_and_resubmit' }],
    },
    async ({ event, step }) => {
      const { orgId, submissionId, submitterId, comment } =
        event.data as HopperSubmissionReviseAndResubmitEvent['data'];

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
          eventType: 'submission.revise_and_resubmit',
          templateName: 'submission-revise-resubmit',
          templateData: {
            submissionTitle: submission.title,
            submitterName: submitter.email,
            submitterEmail: submitter.email,
            orgName,
            editorComment: comment,
          },
          subject: `Revision requested for your submission: ${submission.title}`,
        });
      });

      await step.run('queue-in-app', async () => {
        await queueInAppNotification({
          orgId,
          userId: submitterId,
          eventType: 'submission.revise_and_resubmit',
          title: `Revisions requested for: ${submission.title}`,
          link: `/submissions/${submissionId}`,
        });
      });

      await step.run('capture-correspondence', async () => {
        try {
          await withRls({ orgId }, async (tx) => {
            await correspondenceService.create(tx, {
              userId: submitterId,
              submissionId,
              direction: 'outbound',
              channel: 'email',
              sentAt: new Date(),
              subject: `Revision requested for your submission: ${submission.title}`,
              body: `After careful review, the editors are interested in your work but are requesting revisions.\n\nRevision notes:\n${comment}`,
              senderName: null,
              senderEmail: null,
              isPersonalized: true,
              source: 'colophony',
            });
          });
        } catch {
          // Non-fatal: correspondence capture should not block notifications
        }
      });

      return { notified: 1 };
    },
  );

export const submissionWithdrawnNotification: InngestFunction.Any =
  inngest.createFunction(
    {
      id: 'submission-withdrawn-notification',
      name: 'Submission Withdrawn Notification',
      retries: 3,
      triggers: [{ event: 'hopper/submission.withdrawn' }],
    },
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

      await step.run('queue-in-app-notifications', async () => {
        for (const editor of editors) {
          await queueInAppNotification({
            orgId,
            userId: editor.userId,
            eventType: 'submission.withdrawn',
            title: `Submission withdrawn: ${submission.title}`,
            link: `/submissions/${submissionId}`,
          });
        }
      });

      return { notified: editors.length };
    },
  );
