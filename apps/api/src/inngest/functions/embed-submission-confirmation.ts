import type { InngestFunction } from 'inngest';
import { withRls, submissions, organizations, eq } from '@colophony/db';
import { AuditActions, AuditResources } from '@colophony/types';
import { inngest } from '../client.js';
import type { HopperSubmissionSubmittedEvent } from '../events.js';
import { emailService } from '../../services/email.service.js';
import { auditService } from '../../services/audit.service.js';
import { enqueueEmail } from '../../queues/email.queue.js';
import { validateEnv } from '../../config/env.js';

export const embedSubmissionConfirmation: InngestFunction.Any =
  inngest.createFunction(
    {
      id: 'embed-submission-confirmation',
      name: 'Embed Submission Confirmation Email',
      retries: 3,
      triggers: [{ event: 'hopper/submission.submitted' }],
    },
    async ({ event, step }) => {
      const { orgId, submissionId, isEmbed, submitterEmail, statusToken } =
        event.data as HopperSubmissionSubmittedEvent['data'];

      // Only handle embed submissions
      if (!isEmbed || !submitterEmail || !statusToken) {
        return { skipped: true, reason: 'not-embed-submission' };
      }

      const env = validateEnv();
      if (env.EMAIL_PROVIDER === 'none') {
        return { skipped: true, reason: 'email-disabled' };
      }

      const data = await step.run('resolve-data', async () => {
        return withRls({ orgId }, async (tx) => {
          const [submission] = await tx
            .select({ title: submissions.title })
            .from(submissions)
            .where(eq(submissions.id, submissionId))
            .limit(1);

          const [org] = await tx
            .select({ name: organizations.name })
            .from(organizations)
            .where(eq(organizations.id, orgId))
            .limit(1);

          return {
            submissionTitle: submission?.title ?? 'Untitled',
            orgName: org?.name ?? 'Unknown Organization',
          };
        });
      });

      const statusCheckUrl = `${env.CORS_ORIGIN}/embed/status/${statusToken}`;

      await step.run('queue-confirmation-email', async () => {
        const emailSend = await withRls({ orgId }, async (tx) => {
          const row = await emailService.create(tx, {
            organizationId: orgId,
            recipientEmail: submitterEmail,
            templateName: 'embed-submission-confirmation',
            eventType: 'embed.submission.confirmation',
            subject: `Submission received: ${data.submissionTitle}`,
          });
          await auditService.log(tx, {
            resource: AuditResources.EMAIL,
            action: AuditActions.EMAIL_QUEUED,
            resourceId: row.id,
            organizationId: orgId,
            newValue: {
              to: submitterEmail,
              templateName: 'embed-submission-confirmation',
              eventType: 'embed.submission.confirmation',
            },
          });
          return row;
        });

        await enqueueEmail(env, {
          emailSendId: emailSend.id,
          orgId,
          to: submitterEmail,
          from: env.SMTP_FROM ?? env.SENDGRID_FROM ?? 'noreply@colophony.dev',
          templateName: 'embed-submission-confirmation',
          templateData: {
            submissionTitle: data.submissionTitle,
            orgName: data.orgName,
            statusCheckUrl,
          },
        });
      });

      return { sent: true, to: submitterEmail };
    },
  );
