import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../lib/url-validation.js', () => ({
  validateOutboundUrl: vi.fn().mockResolvedValue(undefined),
  SsrfValidationError: class SsrfValidationError extends Error {
    constructor(msg: string) {
      super(msg);
      this.name = 'SsrfValidationError';
    }
  },
}));

vi.mock('@colophony/db', () => {
  const eqMock = vi.fn((...args: unknown[]) => ({ type: 'eq', args }));
  const andMock = vi.fn((...args: unknown[]) => ({ type: 'and', args }));
  const sqlMock = vi.fn((...args: unknown[]) => ({ type: 'sql', args }));
  return {
    webhookEndpoints: {
      id: 'id',
      organizationId: 'organization_id',
      url: 'url',
      secret: 'secret',
      status: 'status',
      eventTypes: 'event_types',
      createdAt: 'created_at',
    },
    webhookDeliveries: {
      id: 'id',
      // Distinct from the endpoint's column stub so tests can assert that the
      // org predicate is applied to BOTH tables in a join, not just one.
      organizationId: 'delivery_organization_id',
      webhookEndpointId: 'webhook_endpoint_id',
      eventType: 'event_type',
      status: 'status',
      createdAt: 'created_at',
    },
    eq: eqMock,
    and: andMock,
    sql: sqlMock,
  };
});

import { eq, and } from '@colophony/db';
import { webhookService } from './webhook.service.js';

const eqFn = eq as ReturnType<typeof vi.fn>;
const andFn = and as ReturnType<typeof vi.fn>;

describe('webhookService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('exports expected endpoint methods', () => {
    /* eslint-disable @typescript-eslint/unbound-method */
    expect(webhookService.createEndpoint).toBeTypeOf('function');
    expect(webhookService.updateEndpoint).toBeTypeOf('function');
    expect(webhookService.deleteEndpoint).toBeTypeOf('function');
    expect(webhookService.getEndpoint).toBeTypeOf('function');
    expect(webhookService.listEndpoints).toBeTypeOf('function');
    expect(webhookService.rotateSecret).toBeTypeOf('function');
    expect(webhookService.getActiveEndpointsForEvent).toBeTypeOf('function');
    /* eslint-enable @typescript-eslint/unbound-method */
  });

  it('exports expected delivery methods', () => {
    /* eslint-disable @typescript-eslint/unbound-method */
    expect(webhookService.createDelivery).toBeTypeOf('function');
    expect(webhookService.updateDeliveryStatus).toBeTypeOf('function');
    expect(webhookService.listDeliveries).toBeTypeOf('function');
    expect(webhookService.retryDelivery).toBeTypeOf('function');
    expect(webhookService.countRecentFailures).toBeTypeOf('function');
    /* eslint-enable @typescript-eslint/unbound-method */
  });

  it('filters by organizationId in getEndpoint', async () => {
    const mockLimit = vi
      .fn()
      .mockResolvedValue([{ id: 'ep-1', organization_id: 'org-1' }]);
    const mockWhere = vi.fn().mockReturnValue({ limit: mockLimit });
    const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
    const mockSelect = vi.fn().mockReturnValue({ from: mockFrom });
    const mockTx = { select: mockSelect } as never;

    await webhookService.getEndpoint(mockTx, 'ep-1', 'org-1');

    expect(andFn).toHaveBeenCalled();
    const andArgs = andFn.mock.calls[0];
    expect(andArgs[0]).toEqual({ type: 'eq', args: ['id', 'ep-1'] });
    expect(andArgs[1]).toEqual({
      type: 'eq',
      args: ['organization_id', 'org-1'],
    });
  });

  it('filters by organizationId in listEndpoints', async () => {
    const mockOffset = vi.fn().mockResolvedValue([]);
    const mockItemsLimit = vi.fn().mockReturnValue({ offset: mockOffset });
    const mockOrderBy = vi.fn().mockReturnValue({ limit: mockItemsLimit });
    const mockItemsWhere = vi.fn().mockReturnValue({ orderBy: mockOrderBy });
    const mockFrom = vi.fn().mockReturnValue({ where: mockItemsWhere });
    const mockSelect = vi.fn().mockReturnValue({ from: mockFrom });

    const mockCountWhere = vi.fn().mockResolvedValue([{ count: 0 }]);
    const mockCountFrom = vi.fn().mockReturnValue({ where: mockCountWhere });
    const mockCountSelect = vi.fn().mockReturnValue({ from: mockCountFrom });

    let selectCallCount = 0;
    const mockTx = {
      select: vi.fn((...args: unknown[]) => {
        selectCallCount++;
        if (selectCallCount === 1) return mockSelect(...args);
        return mockCountSelect(...args);
      }),
    } as never;

    await webhookService.listEndpoints(mockTx, { page: 1, limit: 10 }, 'org-1');

    expect(eqFn).toHaveBeenCalledWith('organization_id', 'org-1');
  });

  it('filters by organizationId in updateEndpoint', async () => {
    const mockReturning = vi
      .fn()
      .mockResolvedValue([{ id: 'ep-1', organization_id: 'org-1' }]);
    const mockWhere = vi.fn().mockReturnValue({ returning: mockReturning });
    const mockSet = vi.fn().mockReturnValue({ where: mockWhere });
    const mockUpdate = vi.fn().mockReturnValue({ set: mockSet });
    const mockTx = { update: mockUpdate } as never;

    await webhookService.updateEndpoint(
      mockTx,
      'ep-1',
      { status: 'DISABLED' },
      'org-1',
    );

    expect(andFn).toHaveBeenCalled();
    const andArgs = andFn.mock.calls[0];
    expect(andArgs[0]).toEqual({ type: 'eq', args: ['id', 'ep-1'] });
    expect(andArgs[1]).toEqual({
      type: 'eq',
      args: ['organization_id', 'org-1'],
    });
  });

  it('filters by organizationId in deleteEndpoint', async () => {
    // `.returning({ id })` is what lets the method tell a real delete from a
    // no-op; a mock without it makes the method throw not-found.
    const mockReturning = vi.fn().mockResolvedValue([{ id: 'ep-1' }]);
    const mockWhere = vi.fn().mockReturnValue({ returning: mockReturning });
    const mockDeleteFrom = vi.fn().mockReturnValue({ where: mockWhere });
    const mockTx = { delete: mockDeleteFrom } as never;

    await webhookService.deleteEndpoint(mockTx, 'ep-1', 'org-1');

    expect(andFn).toHaveBeenCalled();
    const andArgs = andFn.mock.calls[0];
    expect(andArgs[0]).toEqual({ type: 'eq', args: ['id', 'ep-1'] });
    expect(andArgs[1]).toEqual({
      type: 'eq',
      args: ['organization_id', 'org-1'],
    });
  });

  it('filters by organizationId in rotateSecret', async () => {
    const mockReturning = vi
      .fn()
      .mockResolvedValue([{ id: 'ep-1', secret: 'new-secret' }]);
    const mockWhere = vi.fn().mockReturnValue({ returning: mockReturning });
    const mockSet = vi.fn().mockReturnValue({ where: mockWhere });
    const mockUpdate = vi.fn().mockReturnValue({ set: mockSet });
    const mockTx = { update: mockUpdate } as never;

    await webhookService.rotateSecret(mockTx, 'ep-1', 'org-1');

    expect(andFn).toHaveBeenCalled();
    const andArgs = andFn.mock.calls[0];
    expect(andArgs[0]).toEqual({ type: 'eq', args: ['id', 'ep-1'] });
    expect(andArgs[1]).toEqual({
      type: 'eq',
      args: ['organization_id', 'org-1'],
    });
  });

  it('filters by organizationId in getActiveEndpointsForEvent', async () => {
    const mockWhere = vi.fn().mockResolvedValue([]);
    const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
    const mockSelect = vi.fn().mockReturnValue({ from: mockFrom });
    const mockTx = { select: mockSelect } as never;

    const orgId = 'org-123';
    const eventType = 'submission.created';

    await webhookService.getActiveEndpointsForEvent(mockTx, orgId, eventType);

    // eq should be called with organizationId column + orgId as the first filter
    expect(eqFn).toHaveBeenCalledWith('organization_id', orgId);
    // and() should include the org filter
    expect(andFn).toHaveBeenCalled();
    const andArgs = andFn.mock.calls[0];
    // First arg to and() should be the org filter
    expect(andArgs[0]).toEqual({
      type: 'eq',
      args: ['organization_id', orgId],
    });
  });

  describe('delivery methods — org predicates', () => {
    it('seeds listDeliveries conditions with the org filter, before any caller filter', async () => {
      const mockOrderBy = vi.fn().mockReturnValue({
        limit: vi
          .fn()
          .mockReturnValue({ offset: vi.fn().mockResolvedValue([]) }),
      });
      const mockItemsWhere = vi.fn().mockReturnValue({ orderBy: mockOrderBy });
      const mockCountWhere = vi.fn().mockResolvedValue([{ count: 0 }]);
      let call = 0;
      const mockTx = {
        select: vi.fn(() => ({
          from: vi.fn(() => ({
            where: ++call === 1 ? mockItemsWhere : mockCountWhere,
          })),
        })),
      } as never;

      // `endpointId` is caller-supplied and carries no tenancy of its own, so
      // the org term must be present regardless of what the caller filtered on.
      await webhookService.listDeliveries(
        mockTx,
        { page: 1, limit: 10, endpointId: 'ep-other' },
        'org-1',
      );

      const andArgs = andFn.mock.calls[0];
      expect(andArgs[0]).toEqual({
        type: 'eq',
        args: ['delivery_organization_id', 'org-1'],
      });
      // Page and count share one `where`, so the total cannot drift from the page.
      expect(mockItemsWhere).toHaveBeenCalledWith(andFn.mock.results[0]?.value);
      expect(mockCountWhere).toHaveBeenCalledWith(andFn.mock.results[0]?.value);
    });

    it('filters retryDelivery on both id and organizationId', async () => {
      const mockReturning = vi.fn().mockResolvedValue([{ id: 'del-1' }]);
      const mockWhere = vi.fn().mockReturnValue({ returning: mockReturning });
      const mockSet = vi.fn().mockReturnValue({ where: mockWhere });
      const mockTx = {
        update: vi.fn().mockReturnValue({ set: mockSet }),
      } as never;

      await webhookService.retryDelivery(mockTx, 'del-1', 'org-1');

      const andArgs = andFn.mock.calls[0];
      expect(andArgs[0]).toEqual({ type: 'eq', args: ['id', 'del-1'] });
      expect(andArgs[1]).toEqual({
        type: 'eq',
        args: ['delivery_organization_id', 'org-1'],
      });
    });

    it('throws rather than returning undefined when retryDelivery matches nothing', async () => {
      const mockReturning = vi.fn().mockResolvedValue([]);
      const mockWhere = vi.fn().mockReturnValue({ returning: mockReturning });
      const mockSet = vi.fn().mockReturnValue({ where: mockWhere });
      const mockTx = {
        update: vi.fn().mockReturnValue({ set: mockSet }),
      } as never;

      // The throw is load-bearing: without it the caller goes on to audit and
      // enqueue a retry against a row it does not own.
      await expect(
        webhookService.retryDelivery(mockTx, 'del-1', 'org-1'),
      ).rejects.toThrow(/delivery .*not found/i);
    });

    it('filters updateDeliveryStatus on both id and organizationId', async () => {
      const mockWhere = vi.fn().mockResolvedValue(undefined);
      const mockSet = vi.fn().mockReturnValue({ where: mockWhere });
      const mockTx = {
        update: vi.fn().mockReturnValue({ set: mockSet }),
      } as never;

      await webhookService.updateDeliveryStatus(
        mockTx,
        'del-1',
        'DELIVERED',
        'org-1',
      );

      const andArgs = andFn.mock.calls[0];
      expect(andArgs[0]).toEqual({ type: 'eq', args: ['id', 'del-1'] });
      expect(andArgs[1]).toEqual({
        type: 'eq',
        args: ['delivery_organization_id', 'org-1'],
      });
    });

    it('scopes countRecentFailures to the org so another tenant cannot trip the threshold', async () => {
      const mockWhere = vi.fn().mockResolvedValue([{ count: 0 }]);
      const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
      const mockTx = {
        select: vi.fn().mockReturnValue({ from: mockFrom }),
      } as never;

      await webhookService.countRecentFailures(mockTx, 'ep-1', 'org-1');

      expect(eqFn).toHaveBeenCalledWith('delivery_organization_id', 'org-1');
    });
  });

  describe('getEndpointForDelivery', () => {
    function mockJoinTx(rows: unknown[]) {
      const mockLimit = vi.fn().mockResolvedValue(rows);
      const mockWhere = vi.fn().mockReturnValue({ limit: mockLimit });
      const mockInnerJoin = vi.fn().mockReturnValue({ where: mockWhere });
      const mockFrom = vi.fn().mockReturnValue({ innerJoin: mockInnerJoin });
      const mockSelect = vi.fn().mockReturnValue({ from: mockFrom });
      return { select: mockSelect } as never;
    }

    it('filters on the delivery id and the org id of BOTH tables', async () => {
      const tx = mockJoinTx([]);

      await webhookService.getEndpointForDelivery(tx, 'del-1', 'org-123');

      expect(eqFn).toHaveBeenCalledWith('id', 'del-1');
      // The org predicate must be applied to the delivery AND the endpoint —
      // the FK guarantees the endpoint exists, not that it shares the org.
      expect(eqFn).toHaveBeenCalledWith('delivery_organization_id', 'org-123');
      expect(eqFn).toHaveBeenCalledWith('organization_id', 'org-123');
    });

    it('returns null when the join yields no row', async () => {
      const tx = mockJoinTx([]);
      await expect(
        webhookService.getEndpointForDelivery(tx, 'del-1', 'org-123'),
      ).resolves.toBeNull();
    });

    it('returns the unredacted secret so the worker can sign', async () => {
      const tx = mockJoinTx([
        {
          endpointId: 'ep-1',
          url: 'https://example.com/hook',
          secret: 'live-secret',
          status: 'ACTIVE',
          eventTypes: ['submission.created'],
        },
      ]);

      const row = await webhookService.getEndpointForDelivery(
        tx,
        'del-1',
        'org-123',
      );

      expect(row?.secret).toBe('live-secret');
    });
  });
});
