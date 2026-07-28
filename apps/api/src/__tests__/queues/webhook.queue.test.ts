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

// Mock SSRF validation via vi.mock trampoline
const mockValidateOutboundUrl = vi.fn();
vi.mock('../../lib/url-validation.js', () => ({
  validateOutboundUrl: (...args: unknown[]) => mockValidateOutboundUrl(...args),
}));

// Mock auditService via vi.mock trampoline
const mockAuditLog = vi.fn().mockResolvedValue(undefined);
vi.mock('../../services/audit.service.js', () => ({
  auditService: {
    log: (...args: unknown[]) => mockAuditLog(...args),
    logDirect: vi.fn().mockResolvedValue(undefined),
  },
}));

// Mock globalThis.fetch via vi.stubGlobal
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

import type { WebhookJobData } from '../../queues/webhook.queue';
import {
  startWebhookWorker,
  stopWebhookWorker,
} from '../../workers/webhook.worker';
import { globalSetup } from '../rls/helpers/db-setup';
import { truncateAllTables } from '../rls/helpers/cleanup';
import { flushRedis, closeRedis, getRedisConfig } from './helpers/redis-setup';
import {
  waitForJobCompletion,
  waitForJobFailure,
  closeAllQueueEvents,
} from './helpers/job-helpers';
import { createTestEnv } from './helpers/mock-adapters';
import {
  createOrganization,
  createUser,
  createOrgMember,
} from '../rls/helpers/factories';
import {
  createWebhookEndpoint,
  createWebhookDelivery,
} from './helpers/queue-factories';
import crypto from 'node:crypto';
import { webhookDeliveries, webhookEndpoints, eq } from '@colophony/db';
import { drizzle } from 'drizzle-orm/node-postgres';
import { getAdminPool } from '../rls/helpers/db-setup';

function adminDb(): any {
  return drizzle(getAdminPool());
}

describe('webhook queue integration', () => {
  const env = createTestEnv();
  let queue: Queue<WebhookJobData>;

  beforeAll(async () => {
    await globalSetup();
    await flushRedis();
    startWebhookWorker(env);
    queue = new Queue<WebhookJobData>('webhook', {
      connection: getRedisConfig(),
    });
  });

  afterAll(async () => {
    await stopWebhookWorker();
    await queue.close();
    await closeAllQueueEvents();
    await closeRedis();
  });

  beforeEach(async () => {
    await truncateAllTables();
    vi.clearAllMocks();
    // Re-apply default implementations after clearAllMocks
    mockValidateOutboundUrl.mockResolvedValue(undefined);
    mockAuditLog.mockResolvedValue(undefined);
  });

  // The job carries no endpoint URL or secret — the worker reads both from the
  // database immediately before each send.
  function buildJobData(orgId: string, deliveryId: string): WebhookJobData {
    return {
      deliveryId,
      orgId,
      payload: {
        id: deliveryId,
        event: 'submission.created',
        timestamp: new Date().toISOString(),
        organizationId: orgId,
        data: { submissionId: 'sub-123' },
      },
    };
  }

  it('enqueue → webhook_deliveries transitions QUEUED → DELIVERED', async () => {
    const org = await createOrganization();
    const user = await createUser();
    await createOrgMember(org.id, user.id);
    const endpoint = await createWebhookEndpoint(org.id);
    const delivery = await createWebhookDelivery(org.id, endpoint.id);

    mockFetch.mockImplementation(
      async () => new Response('OK', { status: 200 }),
    );

    const jobData = buildJobData(org.id, delivery.id);
    await queue.add('deliver', jobData, { jobId: delivery.id });
    await waitForJobCompletion(queue, delivery.id);

    const db = adminDb();
    const [updated] = await db
      .select()
      .from(webhookDeliveries)
      .where(eq(webhookDeliveries.id, delivery.id));

    expect(updated.status).toBe('DELIVERED');
    expect(updated.httpStatusCode).toBe(200);
    expect(updated.deliveredAt).toBeTruthy();
  });

  it('retries on non-2xx then succeeds', async () => {
    const org = await createOrganization();
    const user = await createUser();
    await createOrgMember(org.id, user.id);
    const endpoint = await createWebhookEndpoint(org.id);
    const delivery = await createWebhookDelivery(org.id, endpoint.id);

    let callCount = 0;
    mockFetch.mockImplementation(async () => {
      callCount++;
      if (callCount === 1) {
        return new Response('Internal Server Error', { status: 500 });
      }
      return new Response('OK', { status: 200 });
    });

    const jobData = buildJobData(org.id, delivery.id);
    await queue.add('deliver', jobData, {
      jobId: delivery.id,
      attempts: 2,
      backoff: { type: 'fixed', delay: 100 },
    });
    await waitForJobCompletion(queue, delivery.id);

    const db = adminDb();
    const [updated] = await db
      .select()
      .from(webhookDeliveries)
      .where(eq(webhookDeliveries.id, delivery.id));

    expect(updated.status).toBe('DELIVERED');
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it('marks FAILED after all retries exhausted', async () => {
    const org = await createOrganization();
    const user = await createUser();
    await createOrgMember(org.id, user.id);
    const endpoint = await createWebhookEndpoint(org.id);
    const delivery = await createWebhookDelivery(org.id, endpoint.id);

    mockFetch.mockImplementation(
      async () => new Response('Server Error', { status: 500 }),
    );

    const jobData = buildJobData(org.id, delivery.id);
    await queue.add('deliver', jobData, {
      jobId: delivery.id,
      attempts: 1,
      backoff: { type: 'fixed', delay: 100 },
    });
    await waitForJobFailure(queue, delivery.id);

    // Allow onFailed callback to complete (it runs async after job failure)
    await new Promise((r) => setTimeout(r, 500));

    const db = adminDb();
    const [updated] = await db
      .select()
      .from(webhookDeliveries)
      .where(eq(webhookDeliveries.id, delivery.id));

    expect(updated.status).toBe('FAILED');
  });

  it('SSRF validation rejects private IP (permanent failure, no retry)', async () => {
    const org = await createOrganization();
    const user = await createUser();
    await createOrgMember(org.id, user.id);
    const endpoint = await createWebhookEndpoint(org.id, {
      url: 'http://192.168.1.1/webhook',
    });
    const delivery = await createWebhookDelivery(org.id, endpoint.id);

    mockValidateOutboundUrl.mockRejectedValue(
      new Error('URL validation failed: hostname resolves to private IP'),
    );

    const jobData = buildJobData(org.id, delivery.id);
    await queue.add('deliver', jobData, { jobId: delivery.id });
    // SSRF failures don't throw — job completes (returns early, permanent fail)
    await waitForJobCompletion(queue, delivery.id);

    const db = adminDb();
    const [updated] = await db
      .select()
      .from(webhookDeliveries)
      .where(eq(webhookDeliveries.id, delivery.id));

    expect(updated.status).toBe('FAILED');
    expect(updated.errorMessage).toContain('URL validation');
    // fetch should NOT have been called
    expect(mockFetch).not.toHaveBeenCalled();
  });

  describe('pre-send re-validation', () => {
    it('cancels a queued delivery when the endpoint is disabled mid-flight', async () => {
      const org = await createOrganization();
      const user = await createUser();
      await createOrgMember(org.id, user.id);
      const endpoint = await createWebhookEndpoint(org.id);
      const delivery = await createWebhookDelivery(org.id, endpoint.id);

      const db = adminDb();
      // Disable AFTER the delivery row exists — i.e. while the job is queued.
      await db
        .update(webhookEndpoints)
        .set({ status: 'DISABLED' })
        .where(eq(webhookEndpoints.id, endpoint.id));

      await queue.add('deliver', buildJobData(org.id, delivery.id), {
        jobId: delivery.id,
      });
      await waitForJobCompletion(queue, delivery.id);

      const [updated] = await db
        .select()
        .from(webhookDeliveries)
        .where(eq(webhookDeliveries.id, delivery.id));

      expect(updated.status).toBe('CANCELLED');
      expect(updated.errorMessage).toContain('disabled');
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('cancels when the endpoint no longer subscribes to the event', async () => {
      const org = await createOrganization();
      const user = await createUser();
      await createOrgMember(org.id, user.id);
      const endpoint = await createWebhookEndpoint(org.id);
      const delivery = await createWebhookDelivery(org.id, endpoint.id);

      const db = adminDb();
      // Unsubscribe from submission.created, which buildJobData sends.
      await db
        .update(webhookEndpoints)
        .set({ eventTypes: ['submission.updated'] })
        .where(eq(webhookEndpoints.id, endpoint.id));

      await queue.add('deliver', buildJobData(org.id, delivery.id), {
        jobId: delivery.id,
      });
      await waitForJobCompletion(queue, delivery.id);

      const [updated] = await db
        .select()
        .from(webhookDeliveries)
        .where(eq(webhookDeliveries.id, delivery.id));

      expect(updated.status).toBe('CANCELLED');
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('a retry after cancellation actually re-runs, despite the retained job id', async () => {
      const org = await createOrganization();
      const user = await createUser();
      await createOrgMember(org.id, user.id);
      const endpoint = await createWebhookEndpoint(org.id);
      const delivery = await createWebhookDelivery(org.id, endpoint.id);

      const db = adminDb();
      await db
        .update(webhookEndpoints)
        .set({ status: 'DISABLED' })
        .where(eq(webhookEndpoints.id, endpoint.id));

      await queue.add('deliver', buildJobData(org.id, delivery.id), {
        jobId: delivery.id,
      });
      await waitForJobCompletion(queue, delivery.id);

      // Re-enable and re-add with the SAME jobId, exactly as retryDelivery does.
      await db
        .update(webhookEndpoints)
        .set({ status: 'ACTIVE' })
        .where(eq(webhookEndpoints.id, endpoint.id));
      await db
        .update(webhookDeliveries)
        .set({ status: 'QUEUED' })
        .where(eq(webhookDeliveries.id, delivery.id));

      mockFetch.mockImplementation(
        async () => new Response('OK', { status: 200 }),
      );

      // A plain re-add is deduped against the retained completed job and never runs;
      // the retry helper drops it first. Exercise the helper's semantics here.
      await queue.remove(delivery.id).catch(() => undefined);
      await queue.add('deliver', buildJobData(org.id, delivery.id), {
        jobId: delivery.id,
      });
      await waitForJobCompletion(queue, delivery.id);

      const [after] = await db
        .select()
        .from(webhookDeliveries)
        .where(eq(webhookDeliveries.id, delivery.id));

      expect(after.status).toBe('DELIVERED');
      expect(mockFetch).toHaveBeenCalled();
    });

    it('signs with the rotated secret and posts to the edited URL, not the enqueued ones', async () => {
      const org = await createOrganization();
      const user = await createUser();
      await createOrgMember(org.id, user.id);
      const endpoint = await createWebhookEndpoint(org.id);
      const delivery = await createWebhookDelivery(org.id, endpoint.id);

      const db = adminDb();
      // Rotate both AFTER enqueue — a job carrying stale values could not know these.
      await db
        .update(webhookEndpoints)
        .set({
          url: 'https://rotated.example.com/hook',
          secret: 'rotated-secret-value',
        })
        .where(eq(webhookEndpoints.id, endpoint.id));

      mockFetch.mockImplementation(
        async () => new Response('OK', { status: 200 }),
      );

      const jobData = buildJobData(org.id, delivery.id);
      await queue.add('deliver', jobData, { jobId: delivery.id });
      await waitForJobCompletion(queue, delivery.id);

      const expectedSig =
        'sha256=' +
        crypto
          .createHmac('sha256', 'rotated-secret-value')
          .update(JSON.stringify(jobData.payload))
          .digest('hex');

      expect(mockFetch).toHaveBeenCalledWith(
        'https://rotated.example.com/hook',
        expect.objectContaining({
          headers: expect.objectContaining({
            'X-Webhook-Signature': expectedSig,
          }),
        }),
      );

      const [updated] = await db
        .select()
        .from(webhookDeliveries)
        .where(eq(webhookDeliveries.id, delivery.id));
      expect(updated.status).toBe('DELIVERED');
    });
  });
});
