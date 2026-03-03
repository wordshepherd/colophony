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

// Mock auditService via vi.mock trampoline (same pattern as transfer-fetch)
const mockLogDirect = vi.fn().mockResolvedValue(undefined);
const mockLog = vi.fn().mockResolvedValue(undefined);
vi.mock('../../services/audit.service.js', () => ({
  auditService: {
    logDirect: (...args: unknown[]) => mockLogDirect(...args),
    log: (...args: unknown[]) => mockLog(...args),
  },
}));

import type { S3CleanupJobData } from '../../queues/s3-cleanup.queue';
import {
  startS3CleanupWorker,
  stopS3CleanupWorker,
} from '../../workers/s3-cleanup.worker';
import { globalSetup } from '../rls/helpers/db-setup';
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

describe('s3-cleanup queue integration', () => {
  const env = createTestEnv();
  const mockStorage = createMockStorage();
  const mockRegistry = createMockRegistry({ storage: mockStorage });
  let queue: Queue<S3CleanupJobData>;

  beforeAll(async () => {
    await globalSetup();
    await flushRedis();
    startS3CleanupWorker(env, mockRegistry as any);
    queue = new Queue<S3CleanupJobData>('s3-cleanup', {
      connection: getRedisConfig(),
    });
  });

  afterAll(async () => {
    await stopS3CleanupWorker();
    await queue.close();
    await closeAllQueueEvents();
    await closeRedis();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mockLogDirect.mockResolvedValue(undefined);
    mockLog.mockResolvedValue(undefined);
  });

  it('deletes all storage keys and logs audit', async () => {
    mockStorage.deleteFromBucket.mockResolvedValue(undefined);

    const jobData: S3CleanupJobData = {
      storageKeys: [
        { storageKey: 'uploads/file1.pdf', bucket: 'clean' },
        { storageKey: 'uploads/file2.pdf', bucket: 'quarantine' },
      ],
      reason: 'user_gdpr_deletion',
      sourceId: 'user-123',
    };

    const job = await queue.add('cleanup', jobData);
    await waitForJobCompletion(queue, job.id!);

    expect(mockStorage.deleteFromBucket).toHaveBeenCalledTimes(2);
    expect(mockStorage.deleteFromBucket).toHaveBeenCalledWith(
      'submissions',
      'uploads/file1.pdf',
    );
    expect(mockStorage.deleteFromBucket).toHaveBeenCalledWith(
      'quarantine',
      'uploads/file2.pdf',
    );
    expect(mockLogDirect).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'S3_CLEANUP_COMPLETED',
        resourceId: 'user-123',
      }),
    );
  });

  it('partial failure throws and logs failed keys', async () => {
    mockStorage.deleteFromBucket
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('S3 delete failed'));

    const jobData: S3CleanupJobData = {
      storageKeys: [
        { storageKey: 'uploads/ok.pdf', bucket: 'clean' },
        { storageKey: 'uploads/fail.pdf', bucket: 'clean' },
      ],
      reason: 'user_gdpr_deletion',
      sourceId: 'user-456',
    };

    const job = await queue.add('cleanup', jobData, {
      attempts: 1,
    });
    await waitForJobFailure(queue, job.id!);

    expect(mockLogDirect).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'S3_CLEANUP_FAILED',
        resourceId: 'user-456',
      }),
    );
  });

  it('retries on total failure', async () => {
    mockStorage.deleteFromBucket.mockRejectedValue(new Error('S3 unavailable'));

    const jobData: S3CleanupJobData = {
      storageKeys: [{ storageKey: 'uploads/file.pdf', bucket: 'clean' }],
      reason: 'user_gdpr_deletion',
      sourceId: 'user-789',
    };

    const job = await queue.add('cleanup', jobData, {
      attempts: 2,
      backoff: { type: 'fixed', delay: 100 },
    });
    await waitForJobFailure(queue, job.id!);

    const finalJob = await queue.getJob(job.id!);
    expect(finalJob!.attemptsMade).toBe(2);
  });
});
