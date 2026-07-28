import { describe, it, expect, vi, beforeEach } from 'vitest';

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
const mockGetEndpointForDelivery = vi.fn();

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
    getEndpointForDelivery: (...args: unknown[]) =>
      mockGetEndpointForDelivery(...args),
  },
}));

vi.mock('../../queues/webhook.queue.js', () => ({
  enqueueWebhook: vi.fn(),
  enqueueWebhookRetry: vi.fn(),
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

// Mock tRPC init with a passthrough stub. `query`/`mutation` terminate the chain by
// returning a marker that carries the resolver, so tests can drive the real handler
// instead of only asserting that the procedure exists.
type Resolver = (opts: {
  ctx: Record<string, unknown>;
  input: Record<string, unknown>;
}) => Promise<unknown>;

vi.mock('../init.js', () => {
  const passthrough: Record<string, unknown> = {
    input: vi.fn().mockReturnThis(),
    output: vi.fn().mockReturnThis(),
    use: vi.fn().mockReturnThis(),
    query: vi.fn((fn: Resolver) => ({ _resolver: fn })),
    mutation: vi.fn((fn: Resolver) => ({ _resolver: fn })),
  };
  return {
    requireScopes: vi.fn(() => vi.fn()),
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
import {
  enqueueWebhook,
  enqueueWebhookRetry,
} from '../../queues/webhook.queue.js';

const mockEnqueueWebhook = enqueueWebhook as ReturnType<typeof vi.fn>;
const mockEnqueueWebhookRetry = enqueueWebhookRetry as ReturnType<typeof vi.fn>;

function resolver(name: keyof typeof webhooksRouter): Resolver {
  return (webhooksRouter[name] as unknown as { _resolver: Resolver })._resolver;
}

const ORG_ID = 'org-1';
const baseCtx = () => ({
  authContext: { orgId: ORG_ID },
  dbTx: 'mock-tx',
  audit: vi.fn().mockResolvedValue(undefined),
});

describe('webhooksRouter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

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

  describe('test', () => {
    it('refuses to send to a disabled endpoint', async () => {
      mockGetEndpoint.mockResolvedValue({
        id: 'ep-1',
        url: 'https://example.com/hook',
        status: 'DISABLED',
      });

      await expect(
        resolver('test')({ ctx: baseCtx(), input: { id: 'ep-1' } }),
      ).rejects.toThrow(/disabled/i);

      expect(mockCreateDelivery).not.toHaveBeenCalled();
      expect(mockEnqueueWebhook).not.toHaveBeenCalled();
    });

    it('enqueues a job carrying no endpoint URL or secret', async () => {
      mockGetEndpoint.mockResolvedValue({
        id: 'ep-1',
        url: 'https://example.com/hook',
        status: 'ACTIVE',
      });
      mockCreateDelivery.mockResolvedValue({ id: 'del-1' });

      await resolver('test')({ ctx: baseCtx(), input: { id: 'ep-1' } });

      const jobData = mockEnqueueWebhook.mock.calls[0][1];
      expect(jobData).toEqual({
        deliveryId: 'del-1',
        orgId: ORG_ID,
        payload: expect.objectContaining({ event: 'webhook.test' }),
      });
      expect(jobData).not.toHaveProperty('secret');
      expect(jobData).not.toHaveProperty('endpointUrl');
    });
  });

  describe('retryDelivery', () => {
    it('refuses when the delivery and endpoint are not in the same org', async () => {
      mockRetryDelivery.mockResolvedValue({
        id: 'del-1',
        organizationId: ORG_ID,
        webhookEndpointId: 'ep-other',
        eventType: 'submission.created',
        payload: {},
      });
      // The org-scoped join finds nothing — the endpoint belongs elsewhere.
      mockGetEndpointForDelivery.mockResolvedValue(null);

      await expect(
        resolver('retryDelivery')({
          ctx: baseCtx(),
          input: { deliveryId: 'del-1' },
        }),
      ).rejects.toThrow(/endpoint not found/i);

      expect(mockEnqueueWebhookRetry).not.toHaveBeenCalled();
    });

    it('enqueues a job carrying no endpoint URL or secret', async () => {
      mockRetryDelivery.mockResolvedValue({
        id: 'del-1',
        organizationId: ORG_ID,
        webhookEndpointId: 'ep-1',
        eventType: 'submission.created',
        payload: { submissionId: 'sub-1' },
      });
      mockGetEndpointForDelivery.mockResolvedValue({
        endpointId: 'ep-1',
        url: 'https://example.com/hook',
        secret: 'live-secret',
        status: 'ACTIVE',
        eventTypes: ['submission.created'],
      });

      await resolver('retryDelivery')({
        ctx: baseCtx(),
        input: { deliveryId: 'del-1' },
      });

      // Must go through the retry helper — a plain enqueue is deduped into a
      // no-op by the job BullMQ still retains under this delivery id.
      expect(mockEnqueueWebhook).not.toHaveBeenCalled();
      expect(mockEnqueueWebhookRetry).toHaveBeenCalledTimes(1);

      const jobData = mockEnqueueWebhookRetry.mock.calls[0][1];
      expect(jobData).toEqual({
        deliveryId: 'del-1',
        orgId: ORG_ID,
        payload: expect.objectContaining({ event: 'submission.created' }),
      });
      expect(jobData).not.toHaveProperty('secret');
    });
  });
});
