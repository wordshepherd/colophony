import {
  describe,
  it,
  expect,
  vi,
  beforeAll,
  afterAll,
  beforeEach,
} from 'vitest';
import { Queue } from 'bullmq';

// Mock metrics, sentry, logger
vi.mock('../../config/metrics.js', () => ({
  bullmqJobDuration: { observe: vi.fn() },
  bullmqJobTotal: { inc: vi.fn() },
}));
vi.mock('../../config/sentry.js', () => ({
  captureException: vi.fn(),
}));
vi.mock('../../config/logger.js', () => ({
  getLogger: () => ({
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  }),
}));

// Mock inngest client via vi.mock trampoline
const mockInngestSend = vi.fn();
vi.mock('../../inngest/client.js', () => ({
  inngest: {
    send: (...args: unknown[]) => mockInngestSend(...args),
  },
}));

import type { OutboxPollerJobData } from '../../queues/outbox-poller.queue';
import {
  startOutboxPollerWorker,
  stopOutboxPollerWorker,
} from '../../workers/outbox-poller.worker';
import { globalSetup } from '../rls/helpers/db-setup';
import { truncateAllTables } from '../rls/helpers/cleanup';
import { flushRedis, closeRedis, getRedisConfig } from './helpers/redis-setup';
import {
  waitForJobCompletion,
  closeAllQueueEvents,
} from './helpers/job-helpers';
import { createTestEnv } from './helpers/mock-adapters';
import { createOutboxEvent } from './helpers/queue-factories';
import { outboxEvents, eq } from '@colophony/db';
import { drizzle } from 'drizzle-orm/node-postgres';
import { getAdminPool } from '../rls/helpers/db-setup';

function adminDb(): any {
  return drizzle(getAdminPool());
}

describe('outbox-poller queue integration', () => {
  const env = createTestEnv();
  let queue: Queue<OutboxPollerJobData>;

  beforeAll(async () => {
    await globalSetup();
    await flushRedis();
    startOutboxPollerWorker(env);
    queue = new Queue<OutboxPollerJobData>('outbox-poller', {
      connection: getRedisConfig(),
    });
  });

  afterAll(async () => {
    await stopOutboxPollerWorker();
    await queue.close();
    await closeAllQueueEvents();
    await closeRedis();
  });

  beforeEach(async () => {
    await truncateAllTables();
    vi.clearAllMocks();
    mockInngestSend.mockResolvedValue(undefined);
  });

  it('processes unprocessed events and sends to Inngest', async () => {
    const event1 = await createOutboxEvent({
      eventType: 'submission/created',
      payload: { submissionId: 'sub-1', orgId: 'org-1' },
    });
    const event2 = await createOutboxEvent({
      eventType: 'submission/updated',
      payload: { submissionId: 'sub-2', orgId: 'org-2' },
    });

    const job = await queue.add('poll', { trigger: 'scheduled' });
    await waitForJobCompletion(queue, job.id!);

    const db = adminDb();
    const [updated1] = await db
      .select()
      .from(outboxEvents)
      .where(eq(outboxEvents.id, event1.id));
    const [updated2] = await db
      .select()
      .from(outboxEvents)
      .where(eq(outboxEvents.id, event2.id));

    expect(updated1.processedAt).toBeTruthy();
    expect(updated1.processedAt!.getTime()).toBeGreaterThan(1000);
    expect(updated2.processedAt).toBeTruthy();
    expect(updated2.processedAt!.getTime()).toBeGreaterThan(1000);

    expect(mockInngestSend).toHaveBeenCalledTimes(2);
    expect(mockInngestSend).toHaveBeenCalledWith({
      name: 'submission/created',
      data: { submissionId: 'sub-1', orgId: 'org-1' },
    });
  });

  it('Inngest failure unclaims event for retry', async () => {
    const event = await createOutboxEvent({
      eventType: 'submission/created',
      payload: { submissionId: 'sub-fail' },
    });

    mockInngestSend.mockRejectedValue(new Error('Inngest unavailable'));

    const job = await queue.add('poll', { trigger: 'scheduled' });
    await waitForJobCompletion(queue, job.id!);

    const db = adminDb();
    const [updated] = await db
      .select()
      .from(outboxEvents)
      .where(eq(outboxEvents.id, event.id));

    expect(updated.processedAt).toBeNull();
    expect(updated.retryCount).toBe(1);
    expect(updated.error).toContain('Inngest unavailable');
  });

  it('skips already-processed events', async () => {
    await createOutboxEvent({
      eventType: 'submission/created',
      payload: { submissionId: 'sub-done' },
      processedAt: new Date(),
    });

    const job = await queue.add('poll', { trigger: 'scheduled' });
    await waitForJobCompletion(queue, job.id!);

    expect(mockInngestSend).not.toHaveBeenCalled();
  });
});
