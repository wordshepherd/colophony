import { describe, it, expect, vi } from 'vitest';

vi.mock('@colophony/db', () => {
  const eq = vi.fn();
  const and = vi.fn();
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
    eq,
    and,
    sql: vi.fn(),
  };
});

import { webhookService } from './webhook.service.js';

describe('webhookService', () => {
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
});
