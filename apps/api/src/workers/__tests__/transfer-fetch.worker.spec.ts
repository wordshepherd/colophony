import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks — must be set up before imports
// ---------------------------------------------------------------------------

const mockWithRls = vi.fn();
vi.mock('@colophony/db', () => ({
  withRls: (...args: unknown[]) => mockWithRls(...args),
  submissions: { id: 'id', formData: 'form_data' },
  trustedPeers: {
    instanceUrl: 'instance_url',
    domain: 'domain',
    status: 'status',
  },
  eq: vi.fn((_col, val) => ({ _eq: val })),
  and: vi.fn((...args: unknown[]) => ({ _and: args })),
}));

const mockAuditLogDirect = vi.fn().mockResolvedValue(undefined);
vi.mock('../../services/audit.service.js', () => ({
  auditService: {
    logDirect: (...args: unknown[]) => mockAuditLogDirect(...args),
  },
}));

const mockPutObject = vi.fn().mockResolvedValue(undefined);
const mockCreateS3Client = vi.fn().mockReturnValue({});
vi.mock('../../services/s3.js', () => ({
  createS3Client: (...args: unknown[]) => mockCreateS3Client(...args),
  putObject: (...args: unknown[]) => mockPutObject(...args),
}));

// Mock BullMQ Worker — capture the processor function
let capturedProcessor: ((job: unknown) => Promise<void>) | null = null;
vi.mock('bullmq', () => ({
  Worker: vi.fn().mockImplementation(function (
    _name: string,
    processor: (job: unknown) => Promise<void>,
  ) {
    capturedProcessor = processor;
    return {
      on: vi.fn(),
      close: vi.fn(),
    };
  }),
  UnrecoverableError: class extends Error {
    constructor(msg: string) {
      super(msg);
      this.name = 'UnrecoverableError';
    }
  },
}));

// Mock global fetch
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { startTransferFetchWorker } from '../transfer-fetch.worker.js';
import type { Env } from '../../config/env.js';

const testEnv = {
  REDIS_HOST: 'localhost',
  REDIS_PORT: 6379,
  REDIS_PASSWORD: '',
  S3_ENDPOINT: 'http://localhost:9000',
  S3_BUCKET: 'submissions',
  S3_QUARANTINE_BUCKET: 'quarantine',
  S3_ACCESS_KEY: 'minioadmin',
  S3_SECRET_KEY: 'minioadmin',
  S3_REGION: 'us-east-1',
  FEDERATION_ENABLED: true,
  FEDERATION_DOMAIN: 'magazine.example',
} as unknown as Env;

const baseJobData = {
  transferId: 'transfer-123',
  orgId: 'org-1',
  originDomain: 'peer.example',
  transferToken: 'jwt-token-here',
  tokenExpiresAt: new Date(Date.now() + 3_600_000).toISOString(), // 1h from now
  fileManifest: [
    {
      fileId: 'file-1',
      filename: 'essay.pdf',
      mimeType: 'application/pdf',
      size: 1024,
    },
    {
      fileId: 'file-2',
      filename: 'bio.txt',
      mimeType: 'text/plain',
      size: 256,
    },
  ],
  localSubmissionId: 'sub-1',
};

describe('transfer-fetch worker', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    capturedProcessor = null;
    startTransferFetchWorker(testEnv);
  });

  it('marks FAILED when transfer token is expired', async () => {
    expect(capturedProcessor).not.toBeNull();

    const job = {
      data: {
        ...baseJobData,
        tokenExpiresAt: new Date(Date.now() - 60_000).toISOString(), // expired
      },
    };

    await expect(capturedProcessor!(job)).rejects.toThrow(
      'Transfer token expired',
    );
    expect(mockAuditLogDirect).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'TRANSFER_FILES_FETCH_FAILED',
      }),
    );
  });

  it('fetches all files and updates submission formData', async () => {
    expect(capturedProcessor).not.toBeNull();

    // withRls mock — first call returns peer, second call does DB read+update
    mockWithRls
      // Peer lookup
      .mockImplementationOnce(
        async (_ctx: unknown, fn: (tx: unknown) => Promise<unknown>) => {
          const tx = {
            select: vi.fn().mockReturnValue({
              from: vi.fn().mockReturnValue({
                where: vi.fn().mockReturnValue({
                  limit: vi
                    .fn()
                    .mockResolvedValue([
                      { instanceUrl: 'https://peer.example' },
                    ]),
                }),
              }),
            }),
          };
          return fn(tx);
        },
      )
      // formData read + update
      .mockImplementationOnce(
        async (_ctx: unknown, fn: (tx: unknown) => Promise<unknown>) => {
          const tx = {
            select: vi.fn().mockReturnValue({
              from: vi.fn().mockReturnValue({
                where: vi.fn().mockReturnValue({
                  limit: vi
                    .fn()
                    .mockResolvedValue([
                      { formData: { existingField: 'preserved' } },
                    ]),
                }),
              }),
            }),
            update: vi.fn().mockReturnValue({
              set: vi.fn().mockReturnValue({
                where: vi.fn().mockResolvedValue({ rowCount: 1 }),
              }),
            }),
          };
          return fn(tx);
        },
      );

    // Both fetches succeed
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(1024)),
      })
      .mockResolvedValueOnce({
        ok: true,
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(256)),
      });

    const job = { data: { ...baseJobData } };
    await capturedProcessor!(job);

    // Should store 2 files in S3
    expect(mockPutObject).toHaveBeenCalledTimes(2);

    // Should audit STARTED and COMPLETED
    expect(mockAuditLogDirect).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'TRANSFER_FILES_FETCH_STARTED' }),
    );
    expect(mockAuditLogDirect).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'TRANSFER_FILES_FETCH_COMPLETED',
        newValue: expect.objectContaining({ status: 'complete' }),
      }),
    );
  });

  it('handles partial failure and retries', async () => {
    expect(capturedProcessor).not.toBeNull();

    // Peer lookup
    mockWithRls
      .mockImplementationOnce(
        async (_ctx: unknown, fn: (tx: unknown) => Promise<unknown>) => {
          const tx = {
            select: vi.fn().mockReturnValue({
              from: vi.fn().mockReturnValue({
                where: vi.fn().mockReturnValue({
                  limit: vi
                    .fn()
                    .mockResolvedValue([
                      { instanceUrl: 'https://peer.example' },
                    ]),
                }),
              }),
            }),
          };
          return fn(tx);
        },
      )
      // formData update (partial success writes)
      .mockImplementationOnce(
        async (_ctx: unknown, fn: (tx: unknown) => Promise<unknown>) => {
          const tx = {
            select: vi.fn().mockReturnValue({
              from: vi.fn().mockReturnValue({
                where: vi.fn().mockReturnValue({
                  limit: vi.fn().mockResolvedValue([{ formData: {} }]),
                }),
              }),
            }),
            update: vi.fn().mockReturnValue({
              set: vi.fn().mockReturnValue({
                where: vi.fn().mockResolvedValue({ rowCount: 1 }),
              }),
            }),
          };
          return fn(tx);
        },
      );

    // First file succeeds, second fails
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(1024)),
      })
      .mockResolvedValueOnce({ ok: false, status: 500 });

    const job = { data: { ...baseJobData } };

    // Should throw for retry
    await expect(capturedProcessor!(job)).rejects.toThrow('Partial failure');

    // Should still have stored 1 file
    expect(mockPutObject).toHaveBeenCalledTimes(1);
  });

  it('handles total failure', async () => {
    expect(capturedProcessor).not.toBeNull();

    // Peer lookup
    mockWithRls.mockImplementationOnce(
      async (_ctx: unknown, fn: (tx: unknown) => Promise<unknown>) => {
        const tx = {
          select: vi.fn().mockReturnValue({
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                limit: vi
                  .fn()
                  .mockResolvedValue([{ instanceUrl: 'https://peer.example' }]),
              }),
            }),
          }),
        };
        return fn(tx);
      },
    );

    // All fetches fail
    mockFetch
      .mockResolvedValueOnce({ ok: false, status: 500 })
      .mockResolvedValueOnce({ ok: false, status: 500 });

    const job = { data: { ...baseJobData } };

    await expect(capturedProcessor!(job)).rejects.toThrow(
      'All 2 file fetches failed',
    );

    // No S3 puts
    expect(mockPutObject).not.toHaveBeenCalled();

    // Should audit FAILED
    expect(mockAuditLogDirect).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'TRANSFER_FILES_FETCH_FAILED',
        newValue: expect.objectContaining({
          reason: 'All file fetches failed',
        }),
      }),
    );
  });
});
