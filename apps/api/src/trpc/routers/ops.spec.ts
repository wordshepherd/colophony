import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { TRPCContext } from '../context.js';

// ---------------------------------------------------------------------------
// Mocks — queue instances
// ---------------------------------------------------------------------------

const makeQueueMock = (counts: Record<string, number>) => ({
  getJobCounts: vi.fn().mockResolvedValue(counts),
});

const { mockQueues } = vi.hoisted(() => {
  const mockQueues = {
    email: null as ReturnType<typeof makeQueueMock> | null,
    webhook: null as ReturnType<typeof makeQueueMock> | null,
    fileScan: null as ReturnType<typeof makeQueueMock> | null,
    contentExtract: null as ReturnType<typeof makeQueueMock> | null,
    s3Cleanup: null as ReturnType<typeof makeQueueMock> | null,
    outboxPoller: null as ReturnType<typeof makeQueueMock> | null,
    transferFetch: null as ReturnType<typeof makeQueueMock> | null,
  };
  return { mockQueues };
});

vi.mock('../../queues/index.js', () => ({
  getEmailQueueInstance: () => mockQueues.email,
  getWebhookQueueInstance: () => mockQueues.webhook,
  getFileScanQueueInstance: () => mockQueues.fileScan,
  getContentExtractQueueInstance: () => mockQueues.contentExtract,
  getS3CleanupQueueInstance: () => mockQueues.s3Cleanup,
  getOutboxPollerQueueInstance: () => mockQueues.outboxPoller,
  getTransferFetchQueueInstance: () => mockQueues.transferFetch,
  // Stubs required by other routers that import from queues
  enqueueEmail: vi.fn(),
  enqueueWebhook: vi.fn(),
  enqueueFileScan: vi.fn(),
  enqueueContentExtract: vi.fn(),
  enqueueS3Cleanup: vi.fn(),
  enqueueTransferFetch: vi.fn(),
  startOutboxPoller: vi.fn(),
  closeEmailQueue: vi.fn(),
  closeWebhookQueue: vi.fn(),
  closeFileScanQueue: vi.fn(),
  closeContentExtractQueue: vi.fn(),
  closeS3CleanupQueue: vi.fn(),
  closeOutboxPollerQueue: vi.fn(),
  closeTransferFetchQueue: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Mocks — DB (webhook health + submission trend)
// ---------------------------------------------------------------------------

const mockDbExecute = vi.fn();

vi.mock('@colophony/db', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@colophony/db')>();
  return {
    ...actual,
    db: { execute: (...args: unknown[]) => mockDbExecute(...args) },
  };
});

vi.mock('../../config/env.js', () => ({
  validateEnv: () => ({
    WEBHOOK_HEALTH_ZITADEL_STALE_SECONDS: 3600,
    WEBHOOK_HEALTH_STRIPE_STALE_SECONDS: 86400,
    WEBHOOK_HEALTH_DOCUMENSO_STALE_SECONDS: 86400,
  }),
}));

// ---------------------------------------------------------------------------
// Import router after mocks
// ---------------------------------------------------------------------------

import { appRouter } from '../router.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeContext(overrides: Partial<TRPCContext> = {}): TRPCContext {
  return {
    authContext: null,
    dbTx: null,
    audit: vi.fn(),
    ...overrides,
  };
}

function adminContext(
  dbTxOverride?: Partial<TRPCContext['dbTx']>,
): TRPCContext {
  const mockTx = {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockResolvedValue([{ value: 0 }]),
    ...dbTxOverride,
  } as never;
  return makeContext({
    authContext: {
      userId: 'user-1',
      zitadelUserId: 'zid-1',
      email: 'admin@example.com',
      emailVerified: true,
      authMethod: 'test',
      orgId: 'org-1',
      roles: ['ADMIN'],
    },
    dbTx: mockTx,
    audit: vi.fn(),
  });
}

function editorContext(): TRPCContext {
  return makeContext({
    authContext: {
      userId: 'user-1',
      zitadelUserId: 'zid-1',
      email: 'editor@example.com',
      emailVerified: true,
      authMethod: 'test',
      orgId: 'org-1',
      roles: ['EDITOR'],
    },
    dbTx: {} as never,
    audit: vi.fn(),
  });
}

const createCaller = (appRouter as any).createCaller as (
  ctx: TRPCContext,
) => any;

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ops router', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset all queue mocks to null
    mockQueues.email = null;
    mockQueues.webhook = null;
    mockQueues.fileScan = null;
    mockQueues.contentExtract = null;
    mockQueues.s3Cleanup = null;
    mockQueues.outboxPoller = null;
    mockQueues.transferFetch = null;
  });

  describe('queueHealth', () => {
    it('returns counts for all 7 queues', async () => {
      const counts = { waiting: 5, active: 2, delayed: 1, failed: 0 };
      mockQueues.email = makeQueueMock(counts);
      mockQueues.webhook = makeQueueMock(counts);
      mockQueues.fileScan = makeQueueMock(counts);
      mockQueues.contentExtract = makeQueueMock(counts);
      mockQueues.s3Cleanup = makeQueueMock(counts);
      mockQueues.outboxPoller = makeQueueMock(counts);
      mockQueues.transferFetch = makeQueueMock(counts);

      const caller = createCaller(adminContext());
      const result = await caller.ops.queueHealth();

      expect(result.queues).toHaveLength(7);
      for (const q of result.queues) {
        expect(q).toMatchObject(counts);
      }
      expect(result.queues.map((q: { name: string }) => q.name)).toEqual([
        'email',
        'webhook',
        'file-scan',
        'content-extract',
        's3-cleanup',
        'outbox-poller',
        'transfer-fetch',
      ]);
    });

    it('returns zeros for null queue instances', async () => {
      // All queues are null (default in beforeEach)
      const caller = createCaller(adminContext());
      const result = await caller.ops.queueHealth();

      expect(result.queues).toHaveLength(7);
      for (const q of result.queues) {
        expect(q.waiting).toBe(0);
        expect(q.active).toBe(0);
        expect(q.delayed).toBe(0);
        expect(q.failed).toBe(0);
      }
    });

    it('returns zeros when Redis is unavailable', async () => {
      mockQueues.email = {
        getJobCounts: vi.fn().mockRejectedValue(new Error('Redis down')),
      };

      const caller = createCaller(adminContext());
      const result = await caller.ops.queueHealth();

      const emailQueue = result.queues.find(
        (q: { name: string }) => q.name === 'email',
      );
      expect(emailQueue).toMatchObject({
        waiting: 0,
        active: 0,
        delayed: 0,
        failed: 0,
      });
    });
  });

  describe('webhookProviderHealth', () => {
    it('returns provider statuses', async () => {
      const now = new Date();
      const recentTs = new Date(now.getTime() - 60_000).toISOString(); // 1 min ago
      mockDbExecute.mockResolvedValueOnce({
        rows: [
          { provider: 'zitadel', last_received_at: recentTs },
          { provider: 'stripe', last_received_at: recentTs },
          { provider: 'documenso', last_received_at: null },
        ],
      });

      const caller = createCaller(adminContext());
      const result = await caller.ops.webhookProviderHealth();

      expect(result.providers).toHaveLength(3);
      expect(result.providers[0]).toMatchObject({
        provider: 'zitadel',
        status: 'healthy',
      });
      expect(result.providers[1]).toMatchObject({
        provider: 'stripe',
        status: 'healthy',
      });
      expect(result.providers[2]).toMatchObject({
        provider: 'documenso',
        status: 'unknown',
        lastReceivedAt: null,
      });
      expect(result.timestamp).toBeDefined();
    });

    it('marks stale when over threshold', async () => {
      const staleTs = new Date(
        Date.now() - 7200_000, // 2 hours ago (> 3600s zitadel threshold)
      ).toISOString();
      mockDbExecute.mockResolvedValueOnce({
        rows: [
          { provider: 'zitadel', last_received_at: staleTs },
          { provider: 'stripe', last_received_at: staleTs },
          { provider: 'documenso', last_received_at: staleTs },
        ],
      });

      const caller = createCaller(adminContext());
      const result = await caller.ops.webhookProviderHealth();

      expect(result.providers[0]).toMatchObject({
        provider: 'zitadel',
        status: 'stale',
      });
      // Stripe threshold is 86400s, so 2h ago is still healthy
      expect(result.providers[1]).toMatchObject({
        provider: 'stripe',
        status: 'healthy',
      });
    });
  });

  describe('submissionTrend', () => {
    it('returns this month vs last month counts', async () => {
      const mockSelect = vi.fn().mockReturnThis();
      const mockFrom = vi.fn().mockReturnThis();
      const mockWhere = vi
        .fn()
        .mockResolvedValueOnce([{ value: 15 }]) // this month
        .mockResolvedValueOnce([{ value: 10 }]); // last month

      const ctx = adminContext({
        select: mockSelect,
        from: mockFrom,
        where: mockWhere,
      } as never);
      const caller = createCaller(ctx);
      const result = await caller.ops.submissionTrend();

      expect(result).toEqual({
        thisMonth: 15,
        lastMonth: 10,
        trend: 'up',
      });
    });

    it('returns flat when counts equal', async () => {
      const mockSelect = vi.fn().mockReturnThis();
      const mockFrom = vi.fn().mockReturnThis();
      const mockWhere = vi
        .fn()
        .mockResolvedValueOnce([{ value: 5 }])
        .mockResolvedValueOnce([{ value: 5 }]);

      const ctx = adminContext({
        select: mockSelect,
        from: mockFrom,
        where: mockWhere,
      } as never);
      const caller = createCaller(ctx);
      const result = await caller.ops.submissionTrend();

      expect(result.trend).toBe('flat');
    });

    it('returns down when this month is lower', async () => {
      const mockSelect = vi.fn().mockReturnThis();
      const mockFrom = vi.fn().mockReturnThis();
      const mockWhere = vi
        .fn()
        .mockResolvedValueOnce([{ value: 3 }])
        .mockResolvedValueOnce([{ value: 10 }]);

      const ctx = adminContext({
        select: mockSelect,
        from: mockFrom,
        where: mockWhere,
      } as never);
      const caller = createCaller(ctx);
      const result = await caller.ops.submissionTrend();

      expect(result.trend).toBe('down');
    });
  });

  describe('authorization', () => {
    it('rejects non-admin users with FORBIDDEN', async () => {
      const caller = createCaller(editorContext());

      await expect(caller.ops.queueHealth()).rejects.toThrow(/admin/i);
      await expect(caller.ops.webhookProviderHealth()).rejects.toThrow(
        /admin/i,
      );
      await expect(caller.ops.submissionTrend()).rejects.toThrow(/admin/i);
    });

    it('rejects unauthenticated users', async () => {
      const caller = createCaller(makeContext());

      await expect(caller.ops.queueHealth()).rejects.toThrow(
        /not authenticated/i,
      );
    });
  });
});
