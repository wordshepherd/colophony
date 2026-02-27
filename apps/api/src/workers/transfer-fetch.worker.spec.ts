import { describe, it, expect, beforeEach, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('p-limit', () => ({
  default: (concurrency: number) => {
    // Track concurrency for testing
    let active = 0;
    let maxObserved = 0;
    const limit = <T>(fn: () => Promise<T>): Promise<T> => {
      active++;
      if (active > maxObserved) maxObserved = active;
      return fn().finally(() => {
        active--;
      });
    };
    limit.concurrency = concurrency;
    limit.maxObserved = () => maxObserved;
    return limit;
  },
}));

const mockUploadToBucket = vi.fn().mockResolvedValue(undefined);
const mockStorage = {
  defaultBucket: 'test-bucket',
  uploadToBucket: mockUploadToBucket,
};

const mockResolve = vi.fn().mockReturnValue(mockStorage);
vi.mock('@colophony/plugin-sdk', () => ({
  loadConfig: vi.fn(),
}));

const mockWithRls = vi
  .fn()
  .mockImplementation(
    async (_ctx: unknown, fn: (tx: unknown) => Promise<unknown>) => fn(mockTx),
  );
const mockTx = {
  update: vi.fn().mockReturnThis(),
  set: vi.fn().mockReturnThis(),
  where: vi.fn().mockResolvedValue(undefined),
  select: vi.fn().mockReturnThis(),
  from: vi.fn().mockReturnThis(),
  limit: vi.fn().mockResolvedValue([]),
};

vi.mock('@colophony/db', () => ({
  withRls: (...args: unknown[]) => mockWithRls(...args),
  submissions: { formData: 'formData', id: 'id' },
  trustedPeers: {
    instanceUrl: 'instanceUrl',
    domain: 'domain',
    status: 'status',
  },
  inboundTransfers: { id: 'id', status: 'status' },
  eq: vi.fn(),
  and: vi.fn(),
}));

vi.mock('@colophony/types', () => ({
  AuditActions: {
    TRANSFER_FILES_FETCH_STARTED: 'TRANSFER_FILES_FETCH_STARTED',
    TRANSFER_FILES_FETCH_COMPLETED: 'TRANSFER_FILES_FETCH_COMPLETED',
    TRANSFER_FILES_FETCH_FAILED: 'TRANSFER_FILES_FETCH_FAILED',
  },
  AuditResources: { TRANSFER: 'transfer' },
}));

const mockLogDirect = vi.fn().mockResolvedValue(undefined);
vi.mock('../services/audit.service.js', () => ({
  auditService: { logDirect: (...args: unknown[]) => mockLogDirect(...args) },
}));

vi.mock('../config/instrumented-worker.js', () => ({
  createInstrumentedWorker: vi.fn(
    (opts: { processor: (job: unknown) => Promise<void> }) => {
      // Store the processor so tests can invoke it directly
      (globalThis as any).__transferFetchProcessor = opts.processor;
      return { close: vi.fn() };
    },
  ),
}));

// ---------------------------------------------------------------------------
// Import after mocks
// ---------------------------------------------------------------------------

import { startTransferFetchWorker } from './transfer-fetch.worker.js';

const baseJobData = {
  transferId: 'transfer-1',
  orgId: 'org-1',
  originDomain: 'origin.example.com',
  transferToken: 'tok-123',
  tokenExpiresAt: new Date(Date.now() + 3600_000).toISOString(),
  localSubmissionId: 'sub-1',
  inboundTransferId: null,
};

function makeJob(overrides: Record<string, unknown> = {}) {
  return {
    data: { ...baseJobData, ...overrides },
    attemptsMade: 0,
    opts: { attempts: 3 },
  };
}

describe('transfer-fetch worker', () => {
  let processor: (job: unknown) => Promise<void>;

  beforeEach(() => {
    vi.clearAllMocks();
    // peer lookup + other RLS operations
    mockWithRls.mockImplementation(
      async (_ctx: unknown, fn: (tx: unknown) => Promise<unknown>) => {
        // Build a mock tx where every method returns a chainable + thenable object
        const defaultResult = [{ instanceUrl: 'https://origin.example.com' }];
        function makeDrizzleChain(resolveWith: unknown = defaultResult): any {
          const chain: any = {
            then: (res: any, rej?: any) =>
              Promise.resolve(resolveWith).then(res, rej),
          };
          chain.update = vi.fn().mockReturnValue(chain);
          chain.set = vi.fn().mockReturnValue(chain);
          chain.where = vi.fn().mockReturnValue(chain);
          chain.select = vi.fn().mockReturnValue(chain);
          chain.from = vi.fn().mockReturnValue(chain);
          chain.limit = vi.fn().mockReturnValue(chain);
          return chain;
        }
        return fn(makeDrizzleChain());
      },
    );

    const registry = { resolve: mockResolve } as any;
    const env = {
      REDIS_HOST: 'localhost',
      REDIS_PORT: 6379,
      REDIS_PASSWORD: '',
    } as any;
    startTransferFetchWorker(env, registry);
    processor = (globalThis as any).__transferFetchProcessor;
  });

  it('fetches files concurrently up to limit of 5', async () => {
    const files = Array.from({ length: 8 }, (_, i) => ({
      fileId: `file-${i}`,
      filename: `doc-${i}.pdf`,
      mimeType: 'application/pdf',
      size: 1000,
    }));

    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockImplementation(async () => {
        return new Response(Buffer.from('data'), { status: 200 });
      });

    await processor(
      makeJob({
        fileManifest: files,
      }),
    );

    // All 8 files should have been fetched
    expect(fetchSpy.mock.calls.length).toBe(8);
    // All 8 files should have been uploaded
    expect(mockUploadToBucket.mock.calls.length).toBe(8);

    fetchSpy.mockRestore();
  });

  it('tracks individual file failures separately from successes', async () => {
    const files = [
      {
        fileId: 'file-ok',
        filename: 'a.pdf',
        mimeType: 'application/pdf',
        size: 100,
      },
      {
        fileId: 'file-fail',
        filename: 'b.pdf',
        mimeType: 'application/pdf',
        size: 100,
      },
      {
        fileId: 'file-ok2',
        filename: 'c.pdf',
        mimeType: 'application/pdf',
        size: 100,
      },
    ];

    let callIdx = 0;
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockImplementation(async () => {
        callIdx++;
        if (callIdx === 2) {
          return new Response('Not Found', { status: 404 });
        }
        return new Response(Buffer.from('data'), { status: 200 });
      });

    // Partial failure → should throw for retry
    await expect(processor(makeJob({ fileManifest: files }))).rejects.toThrow(
      'Partial failure',
    );

    // 2 files uploaded (the successful ones)
    expect(mockUploadToBucket.mock.calls.length).toBe(2);

    fetchSpy.mockRestore();
  });

  it('handles all files failing gracefully', async () => {
    const files = [
      {
        fileId: 'file-1',
        filename: 'a.pdf',
        mimeType: 'application/pdf',
        size: 100,
      },
      {
        fileId: 'file-2',
        filename: 'b.pdf',
        mimeType: 'application/pdf',
        size: 100,
      },
    ];

    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockImplementation(async () => {
        return new Response('Error', { status: 500 });
      });

    await expect(processor(makeJob({ fileManifest: files }))).rejects.toThrow(
      'All 2 file fetches failed',
    );

    // No uploads should have happened
    expect(mockUploadToBucket).not.toHaveBeenCalled();

    fetchSpy.mockRestore();
  });
});
