import { Queue } from 'bullmq';
import type { Env } from '../config/env.js';

export interface OutboxPollerJobData {
  /** Placeholder — the poller reads directly from the outbox_events table. */
  trigger: 'scheduled';
}

let queue: Queue<OutboxPollerJobData> | null = null;

function getQueue(env: Env): Queue<OutboxPollerJobData> {
  if (!queue) {
    queue = new Queue<OutboxPollerJobData>('outbox-poller', {
      connection: {
        host: env.REDIS_HOST,
        port: env.REDIS_PORT,
        password: env.REDIS_PASSWORD || undefined,
      },
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 5_000 },
        removeOnComplete: { age: 3_600 }, // 1 hour
        removeOnFail: { age: 86_400 }, // 24 hours
      },
    });
  }
  return queue;
}

/**
 * Start the repeatable outbox poller job.
 * Runs every 5 seconds to check for unprocessed outbox events.
 */
export async function startOutboxPoller(env: Env): Promise<void> {
  const q = getQueue(env);
  await q.upsertJobScheduler(
    'outbox-poll',
    { every: 5_000 },
    { data: { trigger: 'scheduled' } },
  );
}

export function getOutboxPollerQueueInstance(): Queue<OutboxPollerJobData> | null {
  return queue;
}

export async function closeOutboxPollerQueue(): Promise<void> {
  if (queue) {
    await queue.close();
    queue = null;
  }
}
