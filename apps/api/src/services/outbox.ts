import { outboxEvents, type DrizzleDb } from '@colophony/db';

/**
 * Insert an event into the transactional outbox.
 *
 * Call this inside the same RLS transaction as the mutation that triggers the
 * event. The outbox poller (superuser) reads and delivers events to Inngest
 * after the transaction commits.
 *
 * @param tx - The current RLS transaction (app_user has INSERT on outbox_events)
 * @param eventType - Inngest event name (e.g. 'slate/contract.generated')
 * @param payload - Event payload (must be JSON-serializable)
 */
export async function enqueueOutboxEvent(
  tx: DrizzleDb,
  eventType: string,
  payload: Record<string, unknown>,
): Promise<void> {
  await tx.insert(outboxEvents).values({
    eventType,
    payload,
  });
}
