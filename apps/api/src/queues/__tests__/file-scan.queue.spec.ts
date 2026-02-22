import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockAdd = vi.fn();
const mockClose = vi.fn();

vi.mock('bullmq', () => ({
  Queue: vi.fn().mockImplementation(function () {
    return { add: mockAdd, close: mockClose };
  }),
}));

// Must import after mocks
import { enqueueFileScan, closeFileScanQueue } from '../file-scan.queue.js';
import type { Env } from '../../config/env.js';

const testEnv = {
  REDIS_HOST: 'localhost',
  REDIS_PORT: 6379,
  REDIS_PASSWORD: '',
} as Env;

describe('file-scan queue', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('enqueues a scan job with fileId as jobId for idempotency', async () => {
    mockAdd.mockResolvedValueOnce({});

    await enqueueFileScan(testEnv, {
      fileId: 'file-123',
      storageKey: 'quarantine/upload-abc',
      organizationId: 'org-1',
      userId: 'test-user-id',
    });

    expect(mockAdd).toHaveBeenCalledWith(
      'scan',
      {
        fileId: 'file-123',
        storageKey: 'quarantine/upload-abc',
        organizationId: 'org-1',
        userId: 'test-user-id',
      },
      { jobId: 'file-123' },
    );
  });

  it('closes queue on shutdown', async () => {
    mockClose.mockResolvedValueOnce(undefined);
    // Ensure queue is created first
    await enqueueFileScan(testEnv, {
      fileId: 'file-456',
      storageKey: 'quarantine/upload-def',
      organizationId: 'org-2',
      userId: 'test-user-id',
    });

    await closeFileScanQueue();
    expect(mockClose).toHaveBeenCalled();
  });

  it('closeFileScanQueue is safe to call when no queue exists', async () => {
    // After closing, calling again should not throw
    await expect(closeFileScanQueue()).resolves.toBeUndefined();
  });
});
