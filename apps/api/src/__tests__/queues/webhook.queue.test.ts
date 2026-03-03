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
import { webhookDeliveries, eq } from '@colophony/db';
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

  function buildJobData(
    orgId: string,
    deliveryId: string,
    endpointUrl: string,
    secret: string,
  ): WebhookJobData {
    return {
      deliveryId,
      orgId,
      endpointUrl,
      secret,
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

    const jobData = buildJobData(
      org.id,
      delivery.id,
      endpoint.url,
      endpoint.secret,
    );
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

    const jobData = buildJobData(
      org.id,
      delivery.id,
      endpoint.url,
      endpoint.secret,
    );
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

    const jobData = buildJobData(
      org.id,
      delivery.id,
      endpoint.url,
      endpoint.secret,
    );
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

    const jobData = buildJobData(
      org.id,
      delivery.id,
      endpoint.url,
      endpoint.secret,
    );
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
});
