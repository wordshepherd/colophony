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
 * it's a system table. Each event is claimed atomically (processedAt set to
 * a sentinel value) before sending to avoid duplicate delivery if multiple
 * poller instances overlap.
 */
async function processOutboxEvents(): Promise<number> {
  // Recover stale claims: rows claimed (processedAt = epoch) but not completed
  // within 5 minutes are likely from a crashed worker. Reset them for retry.
  const staleThreshold = new Date(Date.now() - 5 * 60 * 1000);
  const claimSentinel = new Date(0);
  await db
    .update(outboxEvents)
    .set({ processedAt: null, retryCount: sql`${outboxEvents.retryCount} + 1` })
    .where(
      sql`${outboxEvents.processedAt} = ${claimSentinel} AND ${outboxEvents.createdAt} < ${staleThreshold}`,
    );

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
    // Claim the row atomically — only succeeds if still unclaimed
    const claimSentinel = new Date(0); // epoch = "claimed, not yet delivered"
    const [claimed] = await db
      .update(outboxEvents)
      .set({ processedAt: claimSentinel })
      .where(
        sql`${outboxEvents.id} = ${event.id} AND ${outboxEvents.processedAt} IS NULL`,
      )
      .returning({ id: outboxEvents.id });

    if (!claimed) continue; // Another poller instance already claimed this row

    try {
      await inngest.send({
        name: event.eventType,
        data: event.payload as Record<string, unknown>,
      });

      // Mark as fully processed with actual timestamp
      await db
        .update(outboxEvents)
        .set({ processedAt: new Date() })
        .where(eq(outboxEvents.id, event.id));

      processed++;
    } catch (err) {
      // Unclaim + record error so the event can be retried
      await db
        .update(outboxEvents)
        .set({
          processedAt: null,
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
