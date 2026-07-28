import { Queue } from 'bullmq';
import type { Env } from '../config/env.js';

export interface WebhookPayload {
  id: string;
  event: string;
  timestamp: string;
  organizationId: string;
  data: Record<string, unknown>;
}

/**
 * The endpoint URL and signing secret are deliberately NOT carried here. The worker
 * re-reads both from the database immediately before every send, so a rotated secret or
 * an edited URL cannot be replayed out of a job that has been sitting in Redis (retries
 * back off to 1h, and `removeOnFail` keeps failed jobs for 7 days).
 */
export interface WebhookJobData {
  deliveryId: string;
  orgId: string;
  payload: WebhookPayload;
}

// Custom backoff delays: 1s, 5s, 30s, 2m, 10m, 1h, 1h, 1h
// Final 3 attempts are capped at 1h to avoid multi-day delivery windows
// while still giving endpoints time to recover from extended outages.
const BACKOFF_DELAYS = [
  1_000, 5_000, 30_000, 120_000, 600_000, 3_600_000, 3_600_000, 3_600_000,
];

let queue: Queue<WebhookJobData> | null = null;

function getQueue(env: Env): Queue<WebhookJobData> {
  if (!queue) {
    queue = new Queue<WebhookJobData>('webhook', {
      connection: {
        host: env.REDIS_HOST,
        port: env.REDIS_PORT,
        password: env.REDIS_PASSWORD || undefined,
      },
      defaultJobOptions: {
        attempts: 8,
        backoff: {
          type: 'custom',
        },
        removeOnComplete: { age: 86_400 },
        removeOnFail: { age: 604_800 },
      },
    });
  }
  return queue;
}

export function getWebhookBackoffDelay(attemptsMade: number): number {
  return BACKOFF_DELAYS[Math.min(attemptsMade, BACKOFF_DELAYS.length - 1)];
}

export async function enqueueWebhook(
  env: Env,
  data: WebhookJobData,
): Promise<void> {
  await getQueue(env).add('deliver', data, { jobId: data.deliveryId });
}

/**
 * Enqueue an operator-initiated retry of an existing delivery.
 *
 * `jobId` is the delivery id, and BullMQ treats a re-added jobId as a duplicate for as
 * long as the previous job is retained — 24h for completed (`removeOnComplete`), 7 days
 * for failed. Every terminal state a retry is offered from leaves such a job behind:
 * FAILED exhausts its attempts, and CANCELLED / permanent-SSRF-failure return
 * successfully. Re-adding alone therefore sets the row back to QUEUED and then never
 * runs. Drop the retained job first so the retry actually executes.
 */
export async function enqueueWebhookRetry(
  env: Env,
  data: WebhookJobData,
): Promise<void> {
  const q = getQueue(env);
  // Returns 0 if the job is gone or currently active; neither is an error here.
  await q.remove(data.deliveryId).catch(() => undefined);
  await q.add('deliver', data, { jobId: data.deliveryId });
}

export function getWebhookQueueInstance(): Queue<WebhookJobData> | null {
  return queue;
}

export async function closeWebhookQueue(): Promise<void> {
  if (queue) {
    await queue.close();
    queue = null;
  }
}
