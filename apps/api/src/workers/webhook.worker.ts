import crypto from 'node:crypto';
import { Worker } from 'bullmq';
import { withRls, webhookDeliveries, eq } from '@colophony/db';
import type { DrizzleDb } from '@colophony/db';
import { AuditActions, AuditResources } from '@colophony/types';
import type { Env } from '../config/env.js';
import type { WebhookJobData } from '../queues/webhook.queue.js';
import { getWebhookBackoffDelay } from '../queues/webhook.queue.js';
import { webhookService } from '../services/webhook.service.js';
import { auditService } from '../services/audit.service.js';

const AUTO_DISABLE_THRESHOLD = 5;
const DELIVERY_TIMEOUT_MS = 30_000;

let worker: Worker<WebhookJobData> | null = null;

export function startWebhookWorker(env: Env): Worker<WebhookJobData> {
  worker = new Worker<WebhookJobData>(
    'webhook',
    async (job) => {
      const { deliveryId, orgId, endpointUrl, secret, payload } = job.data;

      // Phase 1: Mark as DELIVERING + increment attempts
      await withRls({ orgId }, async (tx: DrizzleDb) => {
        await webhookService.updateDeliveryStatus(
          tx,
          deliveryId,
          'DELIVERING',
          {
            attempts: job.attemptsMade + 1,
          },
        );
      });

      // Phase 2: Compute HMAC-SHA256 signature
      const body = JSON.stringify(payload);
      const signature =
        'sha256=' +
        crypto.createHmac('sha256', secret).update(body).digest('hex');

      // Phase 3: HTTP POST with timeout
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), DELIVERY_TIMEOUT_MS);

      let response: Response;
      try {
        response = await fetch(endpointUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Webhook-Id': payload.id,
            'X-Webhook-Timestamp': payload.timestamp,
            'X-Webhook-Signature': signature,
            'User-Agent': 'Colophony-Webhook/1.0',
          },
          body,
          signal: controller.signal,
        });
      } catch (fetchErr) {
        clearTimeout(timeout);
        // Network error or timeout — store error and let BullMQ retry
        const errorMsg =
          fetchErr instanceof Error ? fetchErr.message : String(fetchErr);
        await withRls({ orgId }, async (tx: DrizzleDb) => {
          await webhookService.updateDeliveryStatus(
            tx,
            deliveryId,
            'DELIVERING',
            { errorMessage: errorMsg },
          );
        });
        throw fetchErr;
      } finally {
        clearTimeout(timeout);
      }

      // Phase 4: Process response
      const responseBody = await response.text().catch(() => '');
      const truncatedBody = responseBody.slice(0, 4096);

      if (response.ok) {
        // Success
        await withRls({ orgId }, async (tx: DrizzleDb) => {
          await webhookService.updateDeliveryStatus(
            tx,
            deliveryId,
            'DELIVERED',
            {
              httpStatusCode: response.status,
              responseBody: truncatedBody,
              deliveredAt: new Date(),
            },
          );
          await auditService.log(tx, {
            resource: AuditResources.WEBHOOK_DELIVERY,
            action: AuditActions.WEBHOOK_DELIVERED,
            resourceId: deliveryId,
            organizationId: orgId,
            newValue: {
              endpointUrl,
              event: payload.event,
              httpStatus: response.status,
            },
          });
        });
      } else {
        // Non-2xx — store status and throw for BullMQ retry
        await withRls({ orgId }, async (tx: DrizzleDb) => {
          await webhookService.updateDeliveryStatus(
            tx,
            deliveryId,
            'DELIVERING',
            {
              httpStatusCode: response.status,
              responseBody: truncatedBody,
              errorMessage: `HTTP ${response.status}`,
            },
          );
        });
        throw new Error(`Webhook delivery failed: HTTP ${response.status}`);
      }
    },
    {
      connection: {
        host: env.REDIS_HOST,
        port: env.REDIS_PORT,
        password: env.REDIS_PASSWORD || undefined,
      },
      concurrency: 10,
      settings: {
        backoffStrategy: (attemptsMade: number) => {
          return getWebhookBackoffDelay(attemptsMade);
        },
      },
    },
  );

  // eslint-disable-next-line @typescript-eslint/no-misused-promises
  worker.on('failed', async (job, err) => {
    console.error(
      `[webhook] Job ${job?.id} failed (attempt ${job?.attemptsMade}/${job?.opts.attempts}):`,
      err.message,
    );

    // On final failure, mark as FAILED + audit + auto-disable check
    if (job && job.attemptsMade >= (job.opts.attempts ?? 8)) {
      try {
        const { deliveryId, orgId, endpointUrl, payload } = job.data;
        await withRls({ orgId }, async (tx: DrizzleDb) => {
          await webhookService.updateDeliveryStatus(tx, deliveryId, 'FAILED', {
            errorMessage: err.message,
          });
          await auditService.log(tx, {
            resource: AuditResources.WEBHOOK_DELIVERY,
            action: AuditActions.WEBHOOK_DELIVERY_FAILED,
            resourceId: deliveryId,
            organizationId: orgId,
            newValue: {
              endpointUrl,
              event: payload.event,
              error: err.message,
              attempts: job.attemptsMade,
            },
          });

          // Auto-disable: check if this endpoint has too many consecutive failures
          const [deliveryRow] = await tx
            .select({ webhookEndpointId: webhookDeliveries.webhookEndpointId })
            .from(webhookDeliveries)
            .where(eq(webhookDeliveries.id, deliveryId))
            .limit(1);
          const endpointId = deliveryRow?.webhookEndpointId;

          if (endpointId) {
            const failCount = await webhookService.countRecentFailures(
              tx,
              endpointId,
            );
            if (failCount >= AUTO_DISABLE_THRESHOLD) {
              await webhookService.updateEndpoint(tx, endpointId, {
                status: 'DISABLED',
              });
              await auditService.log(tx, {
                resource: AuditResources.WEBHOOK_ENDPOINT,
                action: AuditActions.WEBHOOK_ENDPOINT_AUTO_DISABLED,
                resourceId: endpointId,
                organizationId: orgId,
                newValue: {
                  endpointUrl,
                  consecutiveFailures: failCount,
                },
              });
            }
          }
        });
      } catch (auditErr) {
        console.error(
          `[webhook] Failed to record failure for job ${job.id}:`,
          auditErr,
        );
      }
    }
  });

  return worker;
}

export async function stopWebhookWorker(): Promise<void> {
  if (worker) {
    await worker.close();
    worker = null;
  }
}
