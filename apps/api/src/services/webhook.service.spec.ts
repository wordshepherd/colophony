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
