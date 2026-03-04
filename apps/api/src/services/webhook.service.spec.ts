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

    await webhookService.listEndpoints(mockTx, {
      organizationId: 'org-1',
      page: 1,
      limit: 10,
    });

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

    await webhookService.updateEndpoint(mockTx, 'ep-1', 'org-1', {
      status: 'DISABLED',
    });

    expect(andFn).toHaveBeenCalled();
    const andArgs = andFn.mock.calls[0];
    expect(andArgs[0]).toEqual({ type: 'eq', args: ['id', 'ep-1'] });
    expect(andArgs[1]).toEqual({
      type: 'eq',
      args: ['organization_id', 'org-1'],
    });
  });

  it('filters by organizationId in deleteEndpoint', async () => {
    const mockWhere = vi.fn().mockResolvedValue(undefined);
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
});
