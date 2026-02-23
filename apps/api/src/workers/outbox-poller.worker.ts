import { Worker } from 'bullmq';
import { db, outboxEvents, eq, sql, isNull, asc } from '@colophony/db';
import type { Env } from '../config/env.js';
import type { OutboxPollerJobData } from '../queues/outbox-poller.queue.js';
import { inngest } from '../inngest/client.js';

let worker: Worker<OutboxPollerJobData> | null = null;

/**
 * Process unprocessed outbox events by sending them to Inngest.
 *
 * Uses the superuser `db` instance because `outbox_events` has no RLS —
 * it's a system table. Each event is sent to Inngest individually, and marked
 * as processed on success or has its error/retry count updated on failure.
 */
async function processOutboxEvents(): Promise<number> {
  // Fetch up to 50 unprocessed events, oldest first
  const events = await db
    .select()
    .from(outboxEvents)
    .where(isNull(outboxEvents.processedAt))
    .orderBy(asc(outboxEvents.createdAt))
    .limit(50);

  if (events.length === 0) return 0;

  let processed = 0;

  for (const event of events) {
    try {
      await inngest.send({
        name: event.eventType,
        data: event.payload as Record<string, unknown>,
      });

      // Mark as processed
      await db
        .update(outboxEvents)
        .set({ processedAt: new Date() })
        .where(eq(outboxEvents.id, event.id));

      processed++;
    } catch (err) {
      // Record error but don't fail the whole batch
      await db
        .update(outboxEvents)
        .set({
          error: err instanceof Error ? err.message : String(err),
          retryCount: sql`${outboxEvents.retryCount} + 1`,
        })
        .where(eq(outboxEvents.id, event.id));
    }
  }

  return processed;
}

export function startOutboxPollerWorker(env: Env): void {
  if (worker) return;

  worker = new Worker<OutboxPollerJobData>(
    'outbox-poller',
    async () => {
      await processOutboxEvents();
    },
    {
      connection: {
        host: env.REDIS_HOST,
        port: env.REDIS_PORT,
        password: env.REDIS_PASSWORD || undefined,
      },
      concurrency: 1, // Single poller to avoid duplicate sends
    },
  );

  worker.on('failed', (job, err) => {
    console.error(`Outbox poller job ${job?.id} failed:`, err.message);
  });
}

export async function stopOutboxPollerWorker(): Promise<void> {
  if (worker) {
    await worker.close();
    worker = null;
  }
}
