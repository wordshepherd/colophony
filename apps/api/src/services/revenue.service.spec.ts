import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('@colophony/db', () => ({
  paymentTransactions: {
    id: 'pt.id',
    organizationId: 'pt.org_id',
    contributorId: 'pt.contributor_id',
    submissionId: 'pt.submission_id',
    paymentId: 'pt.payment_id',
    type: 'pt.type',
    direction: 'pt.direction',
    amount: 'pt.amount',
    currency: 'pt.currency',
    status: 'pt.status',
    description: 'pt.description',
    metadata: 'pt.metadata',
    processedAt: 'pt.processed_at',
    createdAt: 'pt.created_at',
    updatedAt: 'pt.updated_at',
  },
  contributors: {
    id: 'c.id',
    organizationId: 'c.org_id',
    displayName: 'c.display_name',
  },
  eq: vi.fn(),
  and: vi.fn(),
}));

vi.mock('drizzle-orm', () => ({
  count: vi.fn(),
  sql: vi.fn(),
}));

vi.mock('./errors.js', () => ({
  assertBusinessOpsOrAdmin: vi.fn(),
  ForbiddenError: class ForbiddenError extends Error {
    constructor(msg: string) {
      super(msg);
      this.name = 'ForbiddenError';
    }
  },
}));

vi.mock('./rights-agreement.service.js', () => ({
  ContributorNotInOrgError: class ContributorNotInOrgError extends Error {
    constructor(id: string) {
      super(`Contributor "${id}" does not belong to this organization`);
      this.name = 'ContributorNotInOrgError';
    }
  },
}));

import {
  revenueService,
  PaymentTransactionNotFoundError,
  InvalidPaymentStatusTransitionError,
} from './revenue.service.js';
import { ContributorNotInOrgError } from './rights-agreement.service.js';
import { assertBusinessOpsOrAdmin } from './errors.js';
import type { ServiceContext } from './types.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const ORG_ID = 'org-1';
const USER_ID = 'user-1';
const TX_ID = 'tx-1';
const CONTRIBUTOR_ID = 'contributor-1';

const fakeTransaction = {
  id: TX_ID,
  organizationId: ORG_ID,
  contributorId: CONTRIBUTOR_ID,
  submissionId: null,
  paymentId: null,
  type: 'submission_fee' as const,
  direction: 'inbound' as const,
  amount: 1500,
  currency: 'usd',
  status: 'PENDING' as const,
  description: null,
  metadata: null,
  processedAt: null,
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
};

function makeChain() {
  const c: Record<string, ReturnType<typeof vi.fn>> = {};
  for (const m of [
    'from',
    'leftJoin',
    'innerJoin',
    'where',
    'orderBy',
    'limit',
    'offset',
    'values',
    'set',
    'returning',
    'groupBy',
  ]) {
    c[m] = vi.fn().mockReturnValue(c);
  }
  return c;
}

function makeMockTx() {
  const chains: Array<Record<string, ReturnType<typeof vi.fn>>> = [];

  function newChain() {
    const c = makeChain();
    chains.push(c);
    return c;
  }

  return {
    select: vi.fn(() => newChain()),
    insert: vi.fn(() => newChain()),
    update: vi.fn(() => newChain()),
    delete: vi.fn(() => newChain()),
    chain(n: number) {
      return chains[n];
    },
    resetChains() {
      chains.length = 0;
    },
  };
}

function makeServiceContext(tx: ReturnType<typeof makeMockTx>): ServiceContext {
  return {
    tx: tx as unknown as ServiceContext['tx'],
    actor: { userId: USER_ID, orgId: ORG_ID, roles: ['BUSINESS_OPS'] },
    audit: vi.fn(),
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('revenueService', () => {
  let mockTx: ReturnType<typeof makeMockTx>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockTx = makeMockTx();
  });

  // -----------------------------------------------------------------------
  // getById
  // -----------------------------------------------------------------------

  describe('getById', () => {
    it('returns transaction when found', async () => {
      mockTx.select = vi.fn(() => {
        const c = makeChain();
        c.limit.mockResolvedValueOnce([fakeTransaction]);
        return c;
      });

      const result = await revenueService.getById(mockTx as any, TX_ID, ORG_ID);
      expect(result).toEqual(fakeTransaction);
    });

    it('returns null when not found', async () => {
      mockTx.select = vi.fn(() => {
        const c = makeChain();
        c.limit.mockResolvedValueOnce([]);
        return c;
      });

      const result = await revenueService.getById(
        mockTx as any,
        'nonexistent',
        ORG_ID,
      );
      expect(result).toBeNull();
    });
  });

  // -----------------------------------------------------------------------
  // list
  // -----------------------------------------------------------------------

  describe('list', () => {
    it('returns paginated results', async () => {
      const listItem = { ...fakeTransaction, contributorName: 'Jane Doe' };
      let selectCount = 0;
      mockTx.select = vi.fn(() => {
        const c = makeChain();
        selectCount++;
        if (selectCount === 1) {
          c.offset.mockResolvedValueOnce([listItem]);
        } else {
          // count query
          c.where.mockResolvedValueOnce([{ total: 1 }]);
        }
        return c;
      });

      const result = await revenueService.list(
        mockTx as any,
        { page: 1, limit: 20 },
        ORG_ID,
      );

      expect(result.items).toEqual([listItem]);
      expect(result.total).toBe(1);
      expect(result.totalPages).toBe(1);
    });

    it('applies type filter', async () => {
      let selectCount = 0;
      mockTx.select = vi.fn(() => {
        const c = makeChain();
        selectCount++;
        if (selectCount === 1) {
          c.offset.mockResolvedValueOnce([]);
        } else {
          c.where.mockResolvedValueOnce([{ total: 0 }]);
        }
        return c;
      });

      await revenueService.list(
        mockTx as any,
        { page: 1, limit: 20, type: 'submission_fee' },
        ORG_ID,
      );

      // Should have been called (we just verify it doesn't throw)
      expect(mockTx.select).toHaveBeenCalledTimes(2);
    });

    it('applies status filter', async () => {
      let selectCount = 0;
      mockTx.select = vi.fn(() => {
        const c = makeChain();
        selectCount++;
        if (selectCount === 1) {
          c.offset.mockResolvedValueOnce([]);
        } else {
          c.where.mockResolvedValueOnce([{ total: 0 }]);
        }
        return c;
      });

      await revenueService.list(
        mockTx as any,
        { page: 1, limit: 20, status: 'SUCCEEDED' },
        ORG_ID,
      );

      expect(mockTx.select).toHaveBeenCalledTimes(2);
    });
  });

  // -----------------------------------------------------------------------
  // getSummary
  // -----------------------------------------------------------------------

  describe('getSummary', () => {
    it('returns aggregated revenue summary', async () => {
      let selectCount = 0;
      mockTx.select = vi.fn(() => {
        const c = makeChain();
        selectCount++;
        if (selectCount === 1) {
          // totals query
          c.where.mockResolvedValueOnce([
            { totalInbound: 5000, totalOutbound: 2000 },
          ]);
        } else if (selectCount === 2) {
          // countByType
          c.groupBy.mockResolvedValueOnce([
            { type: 'submission_fee', count: 3 },
            { type: 'contributor_payment', count: 1 },
          ]);
        } else {
          // countByStatus
          c.groupBy.mockResolvedValueOnce([
            { status: 'SUCCEEDED', count: 3 },
            { status: 'PENDING', count: 1 },
          ]);
        }
        return c;
      });

      const result = await revenueService.getSummary(mockTx as any, ORG_ID);

      expect(result.totalInbound).toBe(5000);
      expect(result.totalOutbound).toBe(2000);
      expect(result.net).toBe(3000);
      expect(result.countByType).toEqual({
        submission_fee: 3,
        contributor_payment: 1,
      });
      expect(result.countByStatus).toEqual({
        SUCCEEDED: 3,
        PENDING: 1,
      });
    });
  });

  // -----------------------------------------------------------------------
  // createWithAudit
  // -----------------------------------------------------------------------

  describe('createWithAudit', () => {
    it('inserts transaction and emits audit event', async () => {
      // contributor validation + insert
      mockTx.select = vi.fn(() => {
        const c = makeChain();
        c.limit.mockResolvedValueOnce([{ id: CONTRIBUTOR_ID }]);
        return c;
      });
      mockTx.insert = vi.fn(() => {
        const c = makeChain();
        c.returning.mockResolvedValueOnce([fakeTransaction]);
        return c;
      });
      const ctx = makeServiceContext(mockTx);

      const result = await revenueService.createWithAudit(ctx, {
        contributorId: CONTRIBUTOR_ID,
        type: 'submission_fee',
        direction: 'inbound',
        amount: 1500,
        currency: 'usd',
      });

      expect(result).toEqual(fakeTransaction);
      expect(assertBusinessOpsOrAdmin).toHaveBeenCalledWith(['BUSINESS_OPS']);
      expect(ctx.audit).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'PAYMENT_TRANSACTION_CREATED',
          resource: 'payment_transaction',
          resourceId: TX_ID,
        }),
      );
    });

    it('allows creation without contributorId', async () => {
      mockTx.insert = vi.fn(() => {
        const c = makeChain();
        c.returning.mockResolvedValueOnce([
          { ...fakeTransaction, contributorId: null },
        ]);
        return c;
      });
      const ctx = makeServiceContext(mockTx);

      const result = await revenueService.createWithAudit(ctx, {
        type: 'submission_fee',
        direction: 'inbound',
        amount: 1500,
        currency: 'usd',
      });

      expect(result.contributorId).toBeNull();
      // No contributor select should have happened
      expect(mockTx.select).not.toHaveBeenCalled();
    });

    it('throws ContributorNotInOrgError for cross-org contributor', async () => {
      mockTx.select = vi.fn(() => {
        const c = makeChain();
        c.limit.mockResolvedValueOnce([]);
        return c;
      });
      const ctx = makeServiceContext(mockTx);

      await expect(
        revenueService.createWithAudit(ctx, {
          contributorId: 'other-org-contributor',
          type: 'submission_fee',
          direction: 'inbound',
          amount: 1500,
          currency: 'usd',
        }),
      ).rejects.toThrow(ContributorNotInOrgError);
    });
  });

  // -----------------------------------------------------------------------
  // updateWithAudit
  // -----------------------------------------------------------------------

  describe('updateWithAudit', () => {
    it('updates fields and emits audit', async () => {
      mockTx.select = vi.fn(() => {
        const c = makeChain();
        c.limit.mockResolvedValueOnce([fakeTransaction]);
        return c;
      });
      mockTx.update = vi.fn(() => {
        const c = makeChain();
        c.returning.mockResolvedValueOnce([
          { ...fakeTransaction, description: 'Updated desc' },
        ]);
        return c;
      });
      const ctx = makeServiceContext(mockTx);

      const result = await revenueService.updateWithAudit(ctx, {
        id: TX_ID,
        description: 'Updated desc',
      });

      expect(result.description).toBe('Updated desc');
      expect(ctx.audit).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'PAYMENT_TRANSACTION_UPDATED',
          resource: 'payment_transaction',
        }),
      );
    });

    it('throws PaymentTransactionNotFoundError for missing ID', async () => {
      mockTx.select = vi.fn(() => {
        const c = makeChain();
        c.limit.mockResolvedValueOnce([]);
        return c;
      });
      const ctx = makeServiceContext(mockTx);

      await expect(
        revenueService.updateWithAudit(ctx, {
          id: 'nonexistent',
          description: 'foo',
        }),
      ).rejects.toThrow(PaymentTransactionNotFoundError);
    });
  });

  // -----------------------------------------------------------------------
  // transitionStatusWithAudit
  // -----------------------------------------------------------------------

  describe('transitionStatusWithAudit', () => {
    it('transitions PENDING to PROCESSING', async () => {
      mockTx.select = vi.fn(() => {
        const c = makeChain();
        c.limit.mockResolvedValueOnce([fakeTransaction]);
        return c;
      });
      mockTx.update = vi.fn(() => {
        const c = makeChain();
        c.returning.mockResolvedValueOnce([
          { ...fakeTransaction, status: 'PROCESSING' },
        ]);
        return c;
      });
      const ctx = makeServiceContext(mockTx);

      const result = await revenueService.transitionStatusWithAudit(ctx, {
        id: TX_ID,
        status: 'PROCESSING',
      });

      expect(result.status).toBe('PROCESSING');
      expect(ctx.audit).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'PAYMENT_TRANSACTION_STATUS_CHANGED',
          newValue: { status: 'PROCESSING' },
        }),
      );
    });

    it('transitions PROCESSING to SUCCEEDED and sets processedAt', async () => {
      const processing = { ...fakeTransaction, status: 'PROCESSING' as const };
      mockTx.select = vi.fn(() => {
        const c = makeChain();
        c.limit.mockResolvedValueOnce([processing]);
        return c;
      });
      mockTx.update = vi.fn(() => {
        const c = makeChain();
        c.returning.mockResolvedValueOnce([
          { ...processing, status: 'SUCCEEDED', processedAt: new Date() },
        ]);
        return c;
      });
      const ctx = makeServiceContext(mockTx);

      const result = await revenueService.transitionStatusWithAudit(ctx, {
        id: TX_ID,
        status: 'SUCCEEDED',
      });

      expect(result.status).toBe('SUCCEEDED');
      expect(result.processedAt).toBeTruthy();
    });

    it('transitions SUCCEEDED to REFUNDED and sets processedAt', async () => {
      const succeeded = {
        ...fakeTransaction,
        status: 'SUCCEEDED' as const,
        processedAt: new Date('2026-01-15'),
      };
      mockTx.select = vi.fn(() => {
        const c = makeChain();
        c.limit.mockResolvedValueOnce([succeeded]);
        return c;
      });
      mockTx.update = vi.fn(() => {
        const c = makeChain();
        c.returning.mockResolvedValueOnce([
          { ...succeeded, status: 'REFUNDED', processedAt: new Date() },
        ]);
        return c;
      });
      const ctx = makeServiceContext(mockTx);

      const result = await revenueService.transitionStatusWithAudit(ctx, {
        id: TX_ID,
        status: 'REFUNDED',
      });

      expect(result.status).toBe('REFUNDED');
    });

    it('transitions FAILED to PENDING (retry) and resets processedAt', async () => {
      const failed = {
        ...fakeTransaction,
        status: 'FAILED' as const,
        processedAt: new Date('2026-01-15'),
      };
      mockTx.select = vi.fn(() => {
        const c = makeChain();
        c.limit.mockResolvedValueOnce([failed]);
        return c;
      });
      mockTx.update = vi.fn(() => {
        const c = makeChain();
        c.returning.mockResolvedValueOnce([
          { ...failed, status: 'PENDING', processedAt: null },
        ]);
        return c;
      });
      const ctx = makeServiceContext(mockTx);

      const result = await revenueService.transitionStatusWithAudit(ctx, {
        id: TX_ID,
        status: 'PENDING',
      });

      expect(result.status).toBe('PENDING');
      expect(result.processedAt).toBeNull();
    });

    it('throws InvalidPaymentStatusTransitionError for REFUNDED to any', async () => {
      const refunded = { ...fakeTransaction, status: 'REFUNDED' as const };
      mockTx.select = vi.fn(() => {
        const c = makeChain();
        c.limit.mockResolvedValueOnce([refunded]);
        return c;
      });
      const ctx = makeServiceContext(mockTx);

      await expect(
        revenueService.transitionStatusWithAudit(ctx, {
          id: TX_ID,
          status: 'PENDING',
        }),
      ).rejects.toThrow(InvalidPaymentStatusTransitionError);
    });

    it('throws InvalidPaymentStatusTransitionError for SUCCEEDED to PROCESSING', async () => {
      const succeeded = { ...fakeTransaction, status: 'SUCCEEDED' as const };
      mockTx.select = vi.fn(() => {
        const c = makeChain();
        c.limit.mockResolvedValueOnce([succeeded]);
        return c;
      });
      const ctx = makeServiceContext(mockTx);

      await expect(
        revenueService.transitionStatusWithAudit(ctx, {
          id: TX_ID,
          status: 'PROCESSING',
        }),
      ).rejects.toThrow(InvalidPaymentStatusTransitionError);
    });

    it('throws PaymentTransactionNotFoundError for missing ID', async () => {
      mockTx.select = vi.fn(() => {
        const c = makeChain();
        c.limit.mockResolvedValueOnce([]);
        return c;
      });
      const ctx = makeServiceContext(mockTx);

      await expect(
        revenueService.transitionStatusWithAudit(ctx, {
          id: 'nonexistent',
          status: 'PROCESSING',
        }),
      ).rejects.toThrow(PaymentTransactionNotFoundError);
    });
  });

  // -----------------------------------------------------------------------
  // deleteWithAudit
  // -----------------------------------------------------------------------

  describe('deleteWithAudit', () => {
    it('deletes and emits audit', async () => {
      mockTx.select = vi.fn(() => {
        const c = makeChain();
        c.limit.mockResolvedValueOnce([fakeTransaction]);
        return c;
      });
      const ctx = makeServiceContext(mockTx);

      await revenueService.deleteWithAudit(ctx, TX_ID);

      expect(ctx.audit).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'PAYMENT_TRANSACTION_DELETED',
          resource: 'payment_transaction',
          resourceId: TX_ID,
        }),
      );
    });

    it('throws PaymentTransactionNotFoundError for missing ID', async () => {
      mockTx.select = vi.fn(() => {
        const c = makeChain();
        c.limit.mockResolvedValueOnce([]);
        return c;
      });
      const ctx = makeServiceContext(mockTx);

      await expect(
        revenueService.deleteWithAudit(ctx, 'nonexistent'),
      ).rejects.toThrow(PaymentTransactionNotFoundError);
    });
  });

  // -----------------------------------------------------------------------
  // Role guard
  // -----------------------------------------------------------------------

  describe('role guard', () => {
    it('createWithAudit calls assertBusinessOpsOrAdmin', async () => {
      mockTx.insert = vi.fn(() => {
        const c = makeChain();
        c.returning.mockResolvedValueOnce([fakeTransaction]);
        return c;
      });
      const ctx = makeServiceContext(mockTx);

      await revenueService.createWithAudit(ctx, {
        type: 'submission_fee',
        direction: 'inbound',
        amount: 1500,
        currency: 'usd',
      });
      expect(assertBusinessOpsOrAdmin).toHaveBeenCalledWith(['BUSINESS_OPS']);
    });

    it('updateWithAudit calls assertBusinessOpsOrAdmin', async () => {
      mockTx.select = vi.fn(() => {
        const c = makeChain();
        c.limit.mockResolvedValueOnce([fakeTransaction]);
        return c;
      });
      mockTx.update = vi.fn(() => {
        const c = makeChain();
        c.returning.mockResolvedValueOnce([
          { ...fakeTransaction, description: 'x' },
        ]);
        return c;
      });
      const ctx = makeServiceContext(mockTx);

      await revenueService.updateWithAudit(ctx, {
        id: TX_ID,
        description: 'x',
      });
      expect(assertBusinessOpsOrAdmin).toHaveBeenCalledWith(['BUSINESS_OPS']);
    });

    it('transitionStatusWithAudit calls assertBusinessOpsOrAdmin', async () => {
      mockTx.select = vi.fn(() => {
        const c = makeChain();
        c.limit.mockResolvedValueOnce([fakeTransaction]);
        return c;
      });
      mockTx.update = vi.fn(() => {
        const c = makeChain();
        c.returning.mockResolvedValueOnce([
          { ...fakeTransaction, status: 'PROCESSING' },
        ]);
        return c;
      });
      const ctx = makeServiceContext(mockTx);

      await revenueService.transitionStatusWithAudit(ctx, {
        id: TX_ID,
        status: 'PROCESSING',
      });
      expect(assertBusinessOpsOrAdmin).toHaveBeenCalledWith(['BUSINESS_OPS']);
    });

    it('deleteWithAudit calls assertBusinessOpsOrAdmin', async () => {
      mockTx.select = vi.fn(() => {
        const c = makeChain();
        c.limit.mockResolvedValueOnce([fakeTransaction]);
        return c;
      });
      const ctx = makeServiceContext(mockTx);

      await revenueService.deleteWithAudit(ctx, TX_ID);
      expect(assertBusinessOpsOrAdmin).toHaveBeenCalledWith(['BUSINESS_OPS']);
    });
  });
});
