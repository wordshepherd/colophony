import { Worker } from 'bullmq';
import { withRls } from '@colophony/db';
import type { DrizzleDb } from '@colophony/db';
import { AuditActions, AuditResources } from '@colophony/types';
import type { Env } from '../config/env.js';
import type { EmailJobData } from '../queues/email.queue.js';
import { emailService } from '../services/email.service.js';
import { auditService } from '../services/audit.service.js';
import {
  createEmailAdapter,
  type EmailAdapter,
} from '../adapters/email/index.js';
import { renderEmailTemplate } from '../templates/email/index.js';
import type { TemplateName } from '../templates/email/types.js';

let worker: Worker<EmailJobData> | null = null;
let adapter: EmailAdapter | null = null;

export function startEmailWorker(env: Env): Worker<EmailJobData> {
  adapter = createEmailAdapter(env);
  if (!adapter) {
    throw new Error(
      `Email adapter could not be created for provider "${env.EMAIL_PROVIDER}"`,
    );
  }

  const currentAdapter = adapter;

  worker = new Worker<EmailJobData>(
    'email',
    async (job) => {
      const { emailSendId, orgId, to, from, templateName, templateData } =
        job.data;

      // Phase 1: Mark as SENDING
      await withRls({ orgId }, async (tx: DrizzleDb) => {
        await emailService.updateStatus(
          tx,
          emailSendId,
          'SENDING',
          job.attemptsMade + 1,
        );
      });

      // Phase 2: Render template (non-retryable — fail immediately on error)
      let rendered: { html: string; text: string; subject: string };
      try {
        rendered = renderEmailTemplate(
          templateName as TemplateName,
          templateData,
        );
      } catch (renderErr) {
        await withRls({ orgId }, async (tx: DrizzleDb) => {
          await emailService.markFailed(
            tx,
            emailSendId,
            `Template render error: ${renderErr instanceof Error ? renderErr.message : String(renderErr)}`,
          );
          await auditService.log(tx, {
            resource: AuditResources.EMAIL,
            action: AuditActions.EMAIL_FAILED,
            resourceId: emailSendId,
            organizationId: orgId,
            newValue: {
              to,
              templateName,
              error: 'template-render-failed',
            },
          });
        });
        // Don't rethrow — job is done (no point retrying a bad template)
        return;
      }

      // Phase 3: Send via adapter
      const result = await currentAdapter.send({
        to,
        from,
        subject: rendered.subject,
        html: rendered.html,
        text: rendered.text,
        replyTo: job.data.replyTo,
        tags: job.data.tags,
      });

      // Phase 4: Mark SENT + audit
      await withRls({ orgId }, async (tx: DrizzleDb) => {
        await emailService.markSent(tx, emailSendId, result.messageId);
        await auditService.log(tx, {
          resource: AuditResources.EMAIL,
          action: AuditActions.EMAIL_SENT,
          resourceId: emailSendId,
          organizationId: orgId,
          newValue: {
            to,
            templateName,
            providerMessageId: result.messageId,
          },
        });
      });
    },
    {
      connection: {
        host: env.REDIS_HOST,
        port: env.REDIS_PORT,
        password: env.REDIS_PASSWORD || undefined,
      },
      concurrency: 5,
    },
  );

  worker.on('failed', async (job, err) => {
    console.error(
      `[email] Job ${job?.id} failed (attempt ${job?.attemptsMade}/${job?.opts.attempts}):`,
      err.message,
    );

    // On final failure, mark as FAILED + audit
    if (job && job.attemptsMade >= (job.opts.attempts ?? 5)) {
      try {
        const { emailSendId, orgId, to, templateName } = job.data;
        await withRls({ orgId }, async (tx: DrizzleDb) => {
          await emailService.markFailed(tx, emailSendId, err.message);
          await auditService.log(tx, {
            resource: AuditResources.EMAIL,
            action: AuditActions.EMAIL_FAILED,
            resourceId: emailSendId,
            organizationId: orgId,
            newValue: {
              to,
              templateName,
              error: err.message,
              attempts: job.attemptsMade,
            },
          });
        });
      } catch (auditErr) {
        console.error(
          `[email] Failed to record failure for job ${job.id}:`,
          auditErr,
        );
      }
    }
  });

  return worker;
}

export async function stopEmailWorker(): Promise<void> {
  if (worker) {
    await worker.close();
    worker = null;
  }
}
