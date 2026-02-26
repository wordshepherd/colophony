import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockAdd = vi.fn();
const mockClose = vi.fn();

vi.mock('bullmq', () => ({
  Queue: vi.fn().mockImplementation(function () {
    return { add: mockAdd, close: mockClose };
  }),
}));

// Must import after mocks
import {
  enqueueTransferFetch,
  closeTransferFetchQueue,
} from '../transfer-fetch.queue.js';
import type { Env } from '../../config/env.js';
import type { TransferFetchJobData } from '../transfer-fetch.queue.js';

const testEnv = {
  REDIS_HOST: 'localhost',
  REDIS_PORT: 6379,
  REDIS_PASSWORD: '',
} as Env;

describe('transfer-fetch queue', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('enqueues job with transferId as jobId for idempotency', async () => {
    mockAdd.mockResolvedValueOnce({});

    const data: TransferFetchJobData = {
      transferId: 'transfer-123',
      orgId: 'org-1',
      originDomain: 'peer.example',
      transferToken: 'jwt-token',
      tokenExpiresAt: new Date(Date.now() + 3_600_000).toISOString(),
      fileManifest: [
        {
          fileId: 'file-1',
          filename: 'essay.pdf',
          mimeType: 'application/pdf',
          size: 1024,
        },
      ],
      localSubmissionId: 'sub-1',
    };

    await enqueueTransferFetch(testEnv, data);

    expect(mockAdd).toHaveBeenCalledWith('fetch', data, {
      jobId: 'transfer-123',
    });
  });

  it('closes queue on shutdown', async () => {
    mockClose.mockResolvedValueOnce(undefined);
    // Ensure queue is created first
    await enqueueTransferFetch(testEnv, {
      transferId: 'transfer-456',
      orgId: 'org-2',
      originDomain: 'peer.example',
      transferToken: 'jwt-token',
      tokenExpiresAt: new Date(Date.now() + 3_600_000).toISOString(),
      fileManifest: [],
      localSubmissionId: 'sub-2',
    });

    await closeTransferFetchQueue();
    expect(mockClose).toHaveBeenCalled();
  });

  it('closeTransferFetchQueue is safe to call when no queue exists', async () => {
    await expect(closeTransferFetchQueue()).resolves.toBeUndefined();
  });
});
