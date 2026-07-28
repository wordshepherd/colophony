import crypto from 'node:crypto';
import type { Worker } from 'bullmq';
import { withRls } from '@colophony/db';
import type { DrizzleDb } from '@colophony/db';
import { AuditActions, AuditResources } from '@colophony/types';
import type { Env } from '../config/env.js';
import type { WebhookJobData } from '../queues/webhook.queue.js';
import { getWebhookBackoffDelay } from '../queues/webhook.queue.js';
import { webhookService } from '../services/webhook.service.js';
import { auditService } from '../services/audit.service.js';
import { createInstrumentedWorker } from '../config/instrumented-worker.js';
import { validateOutboundUrl } from '../lib/url-validation.js';
import { getLogger } from '../config/logger.js';

const AUTO_DISABLE_THRESHOLD = 5;
const DELIVERY_TIMEOUT_MS = 30_000;

let worker: Worker<WebhookJobData> | null = null;

export function startWebhookWorker(env: Env): Worker<WebhookJobData> {
  worker = createInstrumentedWorker<WebhookJobData>({
    name: 'webhook',
    processor: async (job) => {
      const { deliveryId, orgId, payload } = job.data;

      // Phase 1: Re-validate the endpoint against its CURRENT state.
      // The job may have been queued up to an hour ago (8 retries, backoff to 1h), so
      // nothing about the endpoint is trusted from the payload — URL and secret included.
      // Runs before the DELIVERING write so a delivery we decline to send never enters
      // DELIVERING and never burns an attempt.
      const endpoint = await withRls({ orgId }, async (tx: DrizzleDb) =>
        webhookService.getEndpointForDelivery(tx, deliveryId, orgId),
      );

      if (!endpoint) {
        // Endpoint was deleted; ON DELETE CASCADE took the delivery row with it, so
        // there is no row left to mark. Discard the job without retrying.
        getLogger().info(
          { deliveryId, orgId },
          'Webhook endpoint no longer exists — discarding delivery',
        );
        return;
      }

      // A test send is an explicit operator action against one endpoint, so it is exempt
      // from the subscription filter — 'webhook.test' is never in event_types.
      const isTest = payload.event === 'webhook.test';
      const subscribed =
        Array.isArray(endpoint.eventTypes) &&
        endpoint.eventTypes.includes(payload.event);

      let cancelReason: string | null = null;
      if (endpoint.status === 'DISABLED') {
        cancelReason = 'Endpoint is disabled';
      } else if (!isTest && !subscribed) {
        cancelReason = `Endpoint no longer subscribes to ${payload.event}`;
      }

      if (cancelReason) {
        await withRls({ orgId }, async (tx: DrizzleDb) => {
          await webhookService.updateDeliveryStatus(
            tx,
            deliveryId,
            'CANCELLED',
            { errorMessage: `Cancelled before send: ${cancelReason}` },
          );
        });
        getLogger().info(
          { deliveryId, orgId, reason: cancelReason },
          'Webhook delivery cancelled before send',
        );
        return; // Permanent — do not retry
      }

      const { url: endpointUrl, secret } = endpoint;

      // Phase 2: Mark as DELIVERING + increment attempts
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

      // Phase 3: SSRF validation — all failures are permanent (no retry)
      // Retrying URL validation could enable DNS rebinding amplification
      const devMode = env.NODE_ENV === 'development' || env.NODE_ENV === 'test';
      try {
        await validateOutboundUrl(endpointUrl, { devMode });
      } catch (err) {
        const errorMsg =
          err instanceof Error ? err.message : 'URL validation failed';
        await withRls({ orgId }, async (tx: DrizzleDb) => {
          await webhookService.updateDeliveryStatus(tx, deliveryId, 'FAILED', {
            errorMessage: `URL validation failed: ${errorMsg}`,
          });
        });
        return; // Permanent failure — do not retry
      }

      // Phase 4: Compute HMAC-SHA256 signature with the freshly-read secret
      const body = JSON.stringify(payload);
      const signature =
        'sha256=' +
        crypto.createHmac('sha256', secret).update(body).digest('hex');

      // Phase 5: HTTP POST with timeout
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

      // Phase 6: Process response
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
    workerOpts: {
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
    onFailed: async (job, err) => {
      // On final failure, mark as FAILED + audit + auto-disable check
      if (job && job.attemptsMade >= (job.opts.attempts ?? 8)) {
        const { deliveryId, orgId, payload } = job.data;
        await withRls({ orgId }, async (tx: DrizzleDb) => {
          // Resolve the endpoint alongside the delivery. Returns null when the endpoint
          // was deleted mid-flight, in which case there is nothing to audit a URL for
          // and nothing left to auto-disable.
          const endpoint = await webhookService.getEndpointForDelivery(
            tx,
            deliveryId,
            orgId,
          );

          await webhookService.updateDeliveryStatus(tx, deliveryId, 'FAILED', {
            errorMessage: err.message,
          });
          await auditService.log(tx, {
            resource: AuditResources.WEBHOOK_DELIVERY,
            action: AuditActions.WEBHOOK_DELIVERY_FAILED,
            resourceId: deliveryId,
            organizationId: orgId,
            newValue: {
              endpointUrl: endpoint?.url,
              event: payload.event,
              error: err.message,
              attempts: job.attemptsMade,
            },
          });

          // Auto-disable: check if this endpoint has too many recent failures.
          // Note: concurrent final failures may race, but the consequence is benign
          // (disable at ±1 of the threshold). Atomic locking isn't worth the complexity.
          if (endpoint) {
            const failCount = await webhookService.countRecentFailures(
              tx,
              endpoint.endpointId,
            );
            if (failCount >= AUTO_DISABLE_THRESHOLD) {
              await webhookService.updateEndpoint(
                tx,
                endpoint.endpointId,
                orgId,
                { status: 'DISABLED' },
              );
              await auditService.log(tx, {
                resource: AuditResources.WEBHOOK_ENDPOINT,
                action: AuditActions.WEBHOOK_ENDPOINT_AUTO_DISABLED,
                resourceId: endpoint.endpointId,
                organizationId: orgId,
                newValue: {
                  endpointUrl: endpoint.url,
                  consecutiveFailures: failCount,
                },
              });
            }
          }
        });
      }
    },
  });

  return worker;
}

export async function stopWebhookWorker(): Promise<void> {
  if (worker) {
    await worker.close();
    worker = null;
  }
}
