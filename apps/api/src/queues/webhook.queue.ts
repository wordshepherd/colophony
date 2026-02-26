import { Queue } from 'bullmq';
import type { Env } from '../config/env.js';

export interface WebhookPayload {
  id: string;
  event: string;
  timestamp: string;
  organizationId: string;
  data: Record<string, unknown>;
}

export interface WebhookJobData {
  deliveryId: string;
  orgId: string;
  endpointUrl: string;
  secret: string;
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

export async function closeWebhookQueue(): Promise<void> {
  if (queue) {
    await queue.close();
    queue = null;
  }
}
