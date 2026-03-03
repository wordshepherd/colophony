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

// Mock SSRF validation
const mockValidateOutboundUrl = vi.fn();
vi.mock('../../lib/url-validation.js', () => ({
  validateOutboundUrl: (...args: unknown[]) => mockValidateOutboundUrl(...args),
}));

// Mock auditService.logDirect (transfer-fetch uses it directly)
const mockLogDirect = vi.fn().mockResolvedValue(undefined);
vi.mock('../../services/audit.service.js', () => ({
  auditService: {
    logDirect: (...args: unknown[]) => mockLogDirect(...args),
    log: vi.fn().mockResolvedValue(undefined),
  },
}));

import type { TransferFetchJobData } from '../../queues/transfer-fetch.queue';
import {
  startTransferFetchWorker,
  stopTransferFetchWorker,
} from '../../workers/transfer-fetch.worker';
import { globalSetup } from '../rls/helpers/db-setup';
import { truncateAllTables } from '../rls/helpers/cleanup';
import { flushRedis, closeRedis, getRedisConfig } from './helpers/redis-setup';
import {
  waitForJobCompletion,
  waitForJobFailure,
  closeAllQueueEvents,
} from './helpers/job-helpers';
import {
  createMockStorage,
  createMockRegistry,
  createTestEnv,
} from './helpers/mock-adapters';
import {
  createOrganization,
  createUser,
  createOrgMember,
  createSubmission,
  createSubmissionPeriod,
} from '../rls/helpers/factories';
import { createTrustedPeer } from './helpers/queue-factories';
import { submissions, eq } from '@colophony/db';
import { drizzle } from 'drizzle-orm/node-postgres';
import { getAdminPool } from '../rls/helpers/db-setup';

function adminDb(): any {
  return drizzle(getAdminPool());
}

// Mock globalThis.fetch
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

describe('transfer-fetch queue integration', () => {
  const env = createTestEnv();
  const mockStorage = createMockStorage();
  const mockRegistry = createMockRegistry({ storage: mockStorage });
  let queue: Queue<TransferFetchJobData>;

  beforeAll(async () => {
    await globalSetup();
    await flushRedis();
    startTransferFetchWorker(env, mockRegistry as any);
    queue = new Queue<TransferFetchJobData>('transfer-fetch', {
      connection: getRedisConfig(),
    });
  });

  afterAll(async () => {
    await stopTransferFetchWorker();
    await queue.close();
    await closeAllQueueEvents();
    await closeRedis();
  });

  beforeEach(async () => {
    await truncateAllTables();
    vi.clearAllMocks();
    mockValidateOutboundUrl.mockResolvedValue(undefined);
  });

  it('fetches files and updates submission formData', async () => {
    const org = await createOrganization();
    const user = await createUser();
    await createOrgMember(org.id, user.id);
    const period = await createSubmissionPeriod(org.id);
    const submission = await createSubmission(org.id, user.id, {
      submissionPeriodId: period.id,
    });
    const peer = await createTrustedPeer(org.id, {
      domain: 'origin.example.com',
      instanceUrl: 'http://localhost:4001',
    });

    // Mock fetch: return file content
    mockFetch.mockImplementation(async () => {
      const buf = Buffer.from('test file content');
      return new Response(buf, { status: 200 });
    });
    mockStorage.uploadToBucket.mockResolvedValue(undefined);

    const jobData: TransferFetchJobData = {
      transferId: 'transfer-001',
      orgId: org.id,
      originDomain: 'origin.example.com',
      transferToken: 'token-abc',
      tokenExpiresAt: new Date(Date.now() + 60_000).toISOString(),
      fileManifest: [
        {
          fileId: 'file-1',
          filename: 'story.pdf',
          mimeType: 'application/pdf',
          size: 1024,
        },
      ],
      localSubmissionId: submission.id,
    };

    await queue.add('fetch', jobData, { jobId: jobData.transferId });
    await waitForJobCompletion(queue, jobData.transferId);

    // Verify submission formData was updated
    const db = adminDb();
    const [updated] = await db
      .select()
      .from(submissions)
      .where(eq(submissions.id, submission.id));

    const formData = updated.formData as Record<string, unknown>;
    expect(formData._transferStatus).toBe('complete');
    expect(formData._transferFiles).toBeDefined();
    expect(mockStorage.uploadToBucket).toHaveBeenCalledTimes(1);
    expect(mockLogDirect).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'TRANSFER_FILES_FETCH_COMPLETED',
      }),
    );
  });

  it('fails permanently on expired transfer token', async () => {
    const org = await createOrganization();
    const user = await createUser();
    await createOrgMember(org.id, user.id);
    const period = await createSubmissionPeriod(org.id);
    const submission = await createSubmission(org.id, user.id, {
      submissionPeriodId: period.id,
    });

    const jobData: TransferFetchJobData = {
      transferId: 'transfer-expired',
      orgId: org.id,
      originDomain: 'origin.example.com',
      transferToken: 'token-expired',
      tokenExpiresAt: new Date(Date.now() - 60_000).toISOString(), // past
      fileManifest: [
        {
          fileId: 'file-1',
          filename: 'story.pdf',
          mimeType: 'application/pdf',
          size: 1024,
        },
      ],
      localSubmissionId: submission.id,
    };

    await queue.add('fetch', jobData, {
      jobId: jobData.transferId,
      attempts: 2,
      backoff: { type: 'fixed', delay: 100 },
    });
    await waitForJobFailure(queue, jobData.transferId);

    // UnrecoverableError means only 1 attempt even with attempts: 2
    const finalJob = await queue.getJob(jobData.transferId);
    expect(finalJob!.attemptsMade).toBe(1);

    expect(mockLogDirect).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'TRANSFER_FILES_FETCH_FAILED',
      }),
    );
    // fetch should NOT have been called (token check fails first)
    expect(mockFetch).not.toHaveBeenCalled();
  });
});
