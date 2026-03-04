import { describe, it, expect, vi } from 'vitest';

// Mock the service
const mockCreateEndpoint = vi.fn();
const mockUpdateEndpoint = vi.fn();
const mockDeleteEndpoint = vi.fn();
const mockGetEndpoint = vi.fn();
const mockListEndpoints = vi.fn();
const mockRotateSecret = vi.fn();
const mockCreateDelivery = vi.fn();
const mockListDeliveries = vi.fn();
const mockRetryDelivery = vi.fn();
const mockGetActiveEndpointsForEvent = vi.fn();

vi.mock('../../services/webhook.service.js', () => ({
  webhookService: {
    createEndpoint: (...args: unknown[]) => mockCreateEndpoint(...args),
    updateEndpoint: (...args: unknown[]) => mockUpdateEndpoint(...args),
    deleteEndpoint: (...args: unknown[]) => mockDeleteEndpoint(...args),
    getEndpoint: (...args: unknown[]) => mockGetEndpoint(...args),
    listEndpoints: (...args: unknown[]) => mockListEndpoints(...args),
    rotateSecret: (...args: unknown[]) => mockRotateSecret(...args),
    createDelivery: (...args: unknown[]) => mockCreateDelivery(...args),
    listDeliveries: (...args: unknown[]) => mockListDeliveries(...args),
    retryDelivery: (...args: unknown[]) => mockRetryDelivery(...args),
    getActiveEndpointsForEvent: (...args: unknown[]) =>
      mockGetActiveEndpointsForEvent(...args),
  },
}));

vi.mock('../../queues/webhook.queue.js', () => ({
  enqueueWebhook: vi.fn(),
}));

vi.mock('../../config/env.js', () => ({
  validateEnv: () => ({
    REDIS_HOST: 'localhost',
    REDIS_PORT: 6379,
    REDIS_PASSWORD: '',
  }),
}));

vi.mock('@colophony/db', () => ({
  webhookEndpoints: { id: 'id', organizationId: 'organization_id' },
  eq: vi.fn(),
  and: vi.fn(),
}));

// Mock tRPC init with a passthrough stub
vi.mock('../init.js', () => {
  const passthrough = {
    input: vi.fn().mockReturnThis(),
    output: vi.fn().mockReturnThis(),
    query: vi.fn().mockReturnThis(),
    mutation: vi.fn().mockReturnThis(),
    use: vi.fn().mockReturnThis(),
  };
  return {
    orgProcedure: passthrough,
    adminProcedure: passthrough,
    createRouter: vi.fn((routes) => routes),
  };
});

vi.mock('@colophony/types', () => ({
  createWebhookEndpointSchema: {},
  updateWebhookEndpointSchema: {},
  listWebhookDeliveriesSchema: {},
  AuditActions: {
    WEBHOOK_ENDPOINT_CREATED: 'WEBHOOK_ENDPOINT_CREATED',
    WEBHOOK_ENDPOINT_UPDATED: 'WEBHOOK_ENDPOINT_UPDATED',
    WEBHOOK_ENDPOINT_DELETED: 'WEBHOOK_ENDPOINT_DELETED',
    WEBHOOK_ENDPOINT_SECRET_ROTATED: 'WEBHOOK_ENDPOINT_SECRET_ROTATED',
    WEBHOOK_DELIVERY_RETRIED: 'WEBHOOK_DELIVERY_RETRIED',
  },
  AuditResources: {
    WEBHOOK_ENDPOINT: 'webhook_endpoint',
    WEBHOOK_DELIVERY: 'webhook_delivery',
  },
}));

vi.mock('zod', () => ({
  z: {
    object: vi.fn().mockReturnValue({
      merge: vi.fn().mockReturnValue({}),
    }),
    string: vi.fn().mockReturnValue({
      uuid: vi.fn().mockReturnValue({}),
    }),
    number: vi.fn().mockReturnValue({
      int: vi.fn().mockReturnValue({
        min: vi.fn().mockReturnValue({
          default: vi.fn().mockReturnValue({}),
          max: vi.fn().mockReturnValue({
            default: vi.fn().mockReturnValue({}),
          }),
        }),
      }),
    }),
  },
}));

import { webhooksRouter } from './webhooks.js';

describe('webhooksRouter', () => {
  it('exports all expected procedures', () => {
    expect(webhooksRouter).toHaveProperty('create');
    expect(webhooksRouter).toHaveProperty('update');
    expect(webhooksRouter).toHaveProperty('delete');
    expect(webhooksRouter).toHaveProperty('getById');
    expect(webhooksRouter).toHaveProperty('list');
    expect(webhooksRouter).toHaveProperty('rotateSecret');
    expect(webhooksRouter).toHaveProperty('test');
    expect(webhooksRouter).toHaveProperty('deliveries');
    expect(webhooksRouter).toHaveProperty('retryDelivery');
  });
});
