import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ORPCError } from '@orpc/server';

/**
 * The error classes are re-exported from this mock, not just the service
 * object. `error-mapper.ts` builds `errorCodeMap` from these constructors at
 * module load, so an `undefined` entry throws before any test body runs.
 * Declared inside the factory because `vi.mock` is hoisted above every
 * top-level declaration in this file.
 */
vi.mock('../../services/webhook.service.js', () => ({
  WebhookUrlValidationError: class extends Error {
    constructor(message: string) {
      super(message);
      this.name = 'WebhookUrlValidationError';
    }
  },
  WebhookEndpointNotFoundError: class extends Error {
    constructor(id: string) {
      super(`Webhook endpoint "${id}" not found`);
      this.name = 'WebhookEndpointNotFoundError';
    }
  },
  WebhookDeliveryNotFoundError: class extends Error {
    constructor(id: string) {
      super(`Webhook delivery "${id}" not found`);
      this.name = 'WebhookDeliveryNotFoundError';
    }
  },
  WebhookEndpointDisabledError: class extends Error {
    constructor(id: string) {
      super(`Webhook endpoint "${id}" is disabled`);
      this.name = 'WebhookEndpointDisabledError';
    }
  },
  webhookService: {
    createEndpoint: vi.fn(),
    updateEndpoint: vi.fn(),
    deleteEndpoint: vi.fn(),
    getEndpoint: vi.fn(),
    listEndpoints: vi.fn(),
    rotateSecret: vi.fn(),
    createDelivery: vi.fn(),
    listDeliveries: vi.fn(),
    retryDelivery: vi.fn(),
    getEndpointForDelivery: vi.fn(),
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
  pool: { query: vi.fn(), connect: vi.fn() },
  db: { query: {} },
  webhookEndpoints: {},
  webhookDeliveries: {},
  eq: vi.fn(),
  and: vi.fn(),
  sql: vi.fn(),
}));

import {
  webhookService,
  WebhookEndpointNotFoundError,
  WebhookDeliveryNotFoundError,
  WebhookUrlValidationError,
} from '../../services/webhook.service.js';
import {
  enqueueWebhook,
  enqueueWebhookRetry,
} from '../../queues/webhook.queue.js';
import { webhooksRouter } from './webhooks.js';
import type { RestContext } from '../context.js';
import { createProcedureClient } from '@orpc/server';

const mockWebhooks = vi.mocked(webhookService);
const mockEnqueue = vi.mocked(enqueueWebhook);
const mockEnqueueRetry = vi.mocked(enqueueWebhookRetry);

const USER_ID = 'a0000000-0000-4000-a000-000000000001';
const ORG_ID = 'b0000000-0000-4000-a000-000000000001';
const EP_ID = 'c0000000-0000-4000-a000-000000000001';
const DEL_ID = 'd0000000-0000-4000-a000-000000000001';

function baseContext(): RestContext {
  return { authContext: null, dbTx: null, audit: vi.fn() };
}

/** Authenticated but with no organization resolved. */
function authedContext(): RestContext {
  return {
    authContext: {
      userId: USER_ID,
      zitadelUserId: 'zid-1',
      email: 'editor@example.com',
      emailVerified: true,
      authMethod: 'test',
    },
    dbTx: {} as never,
    audit: vi.fn(),
  };
}

/**
 * READER, deliberately. Six of the nine routes are `adminProcedure`, so this
 * context is what proves the role guard rejects rather than merely that the
 * scope guard does.
 */
function orgContext(): RestContext {
  return {
    authContext: {
      userId: USER_ID,
      zitadelUserId: 'zid-1',
      email: 'editor@example.com',
      emailVerified: true,
      authMethod: 'test',
      orgId: ORG_ID,
      roles: ['READER'],
    },
    dbTx: {} as never,
    audit: vi.fn(),
  };
}

function adminContext(): RestContext {
  return {
    authContext: {
      userId: USER_ID,
      zitadelUserId: 'zid-1',
      email: 'editor@example.com',
      emailVerified: true,
      authMethod: 'test',
      orgId: ORG_ID,
      roles: ['ADMIN'],
    },
    dbTx: {} as never,
    audit: vi.fn(),
  };
}

function apiKeyContext(scopes: string[]): RestContext {
  return {
    authContext: {
      userId: USER_ID,
      email: 'editor@example.com',
      emailVerified: true,
      authMethod: 'apikey',
      apiKeyId: 'k0000000-0000-4000-a000-000000000001',
      apiKeyScopes: scopes as never,
      orgId: ORG_ID,
      roles: ['ADMIN'],
    },
    dbTx: {} as never,
    audit: vi.fn(),
  };
}

function client<T>(procedure: T, context: RestContext) {
  return createProcedureClient(procedure as never, { context }) as (
    input?: unknown,
  ) => Promise<never>;
}

/** A redacted endpoint row, as the service returns from get/list/update. */
function endpointRow() {
  return {
    id: EP_ID,
    url: 'https://example.com/hook',
    description: null,
    eventTypes: ['hopper/submission.submitted'],
    status: 'ACTIVE' as const,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  };
}

/** An unredacted row, as create/rotateSecret return. */
function endpointRowWithSecret() {
  return { ...endpointRow(), secret: 'plaintext-secret' };
}

function deliveryRow() {
  return {
    id: DEL_ID,
    webhookEndpointId: EP_ID,
    eventType: 'hopper/submission.submitted',
    eventId: 'e0000000-0000-4000-a000-000000000001',
    payload: { submissionId: 'sub-1' },
    status: 'FAILED' as const,
    httpStatusCode: 500,
    responseBody: null,
    errorMessage: 'boom',
    attempts: 3,
    nextRetryAt: null,
    deliveredAt: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
  };
}

const ALL_ROUTES: Array<[string, unknown, unknown]> = [
  ['list', webhooksRouter.list, { page: 1, limit: 20 }],
  [
    'create',
    webhooksRouter.create,
    { url: 'https://example.com/hook', eventTypes: ['webhook.test'] },
  ],
  ['getById', webhooksRouter.getById, { id: EP_ID }],
  ['update', webhooksRouter.update, { id: EP_ID, status: 'DISABLED' }],
  ['delete', webhooksRouter.delete, { id: EP_ID }],
  ['rotateSecret', webhooksRouter.rotateSecret, { id: EP_ID }],
  ['test', webhooksRouter.test, { id: EP_ID }],
  ['deliveries', webhooksRouter.deliveries, { page: 1, limit: 20 }],
  ['retryDelivery', webhooksRouter.retryDelivery, { deliveryId: DEL_ID }],
];

describe('webhooks REST router', () => {
  beforeEach(() => {
    // resetAllMocks, not clearAllMocks: this suite runs under vitest's random
    // sequencing, and `clearAllMocks` leaves queued `mockResolvedValueOnce`
    // implementations in place.
    vi.resetAllMocks();
  });

  // -------------------------------------------------------------------------
  // Auth and org context, across the whole router
  // -------------------------------------------------------------------------

  describe.each(ALL_ROUTES)('%s', (_name, procedure, input) => {
    it('requires auth', async () => {
      await expect(client(procedure, baseContext())(input)).rejects.toThrow(
        ORPCError,
      );
    });

    it('requires org context', async () => {
      await expect(client(procedure, authedContext())(input)).rejects.toThrow(
        'X-Organization-Id header is required',
      );
    });
  });

  // -------------------------------------------------------------------------
  // GET /webhooks
  // -------------------------------------------------------------------------

  describe('GET /webhooks', () => {
    it('passes the org id as the third argument', async () => {
      mockWebhooks.listEndpoints.mockResolvedValueOnce({
        items: [endpointRow()],
        total: 1,
        page: 1,
        limit: 20,
        totalPages: 1,
      } as never);

      await client(webhooksRouter.list, orgContext())({ page: 1, limit: 20 });

      // The full argument list, not a prefix: a dropped org id silently widens
      // the query to RLS alone.
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(mockWebhooks.listEndpoints).toHaveBeenCalledWith(
        expect.anything(),
        { page: 1, limit: 20 },
        ORG_ID,
      );
    });

    it('never returns a secret, even if the service leaks one', async () => {
      mockWebhooks.listEndpoints.mockResolvedValueOnce({
        items: [endpointRowWithSecret()],
        total: 1,
        page: 1,
        limit: 20,
        totalPages: 1,
      } as never);

      const result = (await client(
        webhooksRouter.list,
        orgContext(),
      )({ page: 1, limit: 20 })) as { items: unknown[] };

      expect(result.items[0]).not.toHaveProperty('secret');
    });

    it('coerces page and limit from query strings', async () => {
      mockWebhooks.listEndpoints.mockResolvedValueOnce({
        items: [],
        total: 0,
        page: 2,
        limit: 5,
        totalPages: 0,
      });

      await client(
        webhooksRouter.list,
        orgContext(),
      )({ page: '2', limit: '5' });

      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(mockWebhooks.listEndpoints).toHaveBeenCalledWith(
        expect.anything(),
        { page: 2, limit: 5 },
        ORG_ID,
      );
    });
  });

  // -------------------------------------------------------------------------
  // POST /webhooks
  // -------------------------------------------------------------------------

  describe('POST /webhooks', () => {
    it('creates, audits, and returns the plaintext secret', async () => {
      mockWebhooks.createEndpoint.mockResolvedValueOnce(
        endpointRowWithSecret() as never,
      );
      const ctx = adminContext();

      const result = (await client(
        webhooksRouter.create,
        ctx,
      )({
        url: 'https://example.com/hook',
        eventTypes: ['hopper/submission.submitted'],
      })) as { secret?: string };

      // Registration is one of only two operations that may return it.
      expect(result.secret).toBe('plaintext-secret');
      expect(ctx.audit).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'WEBHOOK_ENDPOINT_CREATED' }),
      );
    });

    it('binds organizationId from context, never from input', async () => {
      mockWebhooks.createEndpoint.mockResolvedValueOnce(
        endpointRowWithSecret() as never,
      );

      await client(
        webhooksRouter.create,
        adminContext(),
      )({
        url: 'https://example.com/hook',
        eventTypes: ['hopper/submission.submitted'],
        organizationId: 'f0000000-0000-4000-a000-000000000999',
      });

      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(mockWebhooks.createEndpoint).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ organizationId: ORG_ID }),
      );
    });

    it('maps WebhookUrlValidationError to 400, not 500', async () => {
      // An SSRF rejection was a 500 on both surfaces until the error was
      // registered in the mappers.
      mockWebhooks.createEndpoint.mockRejectedValueOnce(
        new WebhookUrlValidationError(
          'URL is not allowed: must be a public HTTPS endpoint',
        ),
      );

      await expect(
        client(
          webhooksRouter.create,
          adminContext(),
        )({
          url: 'https://127.0.0.1/hook',
          eventTypes: ['hopper/submission.submitted'],
        }),
      ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    });

    it('rejects an event type outside the enum', async () => {
      await expect(
        client(
          webhooksRouter.create,
          adminContext(),
        )({
          url: 'https://example.com/hook',
          eventTypes: ['not.a.real.event'],
        }),
      ).rejects.toThrow(ORPCError);
    });

    it('requires ADMIN', async () => {
      await expect(
        client(
          webhooksRouter.create,
          orgContext(),
        )({
          url: 'https://example.com/hook',
          eventTypes: ['hopper/submission.submitted'],
        }),
      ).rejects.toThrow('Admin role required');
    });
  });

  // -------------------------------------------------------------------------
  // GET /webhooks/{id}
  // -------------------------------------------------------------------------

  describe('GET /webhooks/{id}', () => {
    it('passes all three arguments and returns no secret', async () => {
      mockWebhooks.getEndpoint.mockResolvedValueOnce(endpointRow() as never);

      const result = await client(
        webhooksRouter.getById,
        orgContext(),
      )({ id: EP_ID });

      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(mockWebhooks.getEndpoint).toHaveBeenCalledWith(
        expect.anything(),
        EP_ID,
        ORG_ID,
      );
      expect(result).not.toHaveProperty('secret');
    });

    it('maps WebhookEndpointNotFoundError to 404', async () => {
      mockWebhooks.getEndpoint.mockRejectedValueOnce(
        new WebhookEndpointNotFoundError(EP_ID),
      );

      await expect(
        client(webhooksRouter.getById, orgContext())({ id: EP_ID }),
      ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    });

    it('rejects a non-uuid id', async () => {
      await expect(
        client(webhooksRouter.getById, orgContext())({ id: 'not-a-uuid' }),
      ).rejects.toThrow(ORPCError);
    });
  });

  // -------------------------------------------------------------------------
  // PATCH /webhooks/{id}
  // -------------------------------------------------------------------------

  describe('PATCH /webhooks/{id}', () => {
    it('passes (tx, id, params, orgId) in that order and does not leak id into params', async () => {
      mockWebhooks.updateEndpoint.mockResolvedValueOnce(endpointRow() as never);

      await client(
        webhooksRouter.update,
        adminContext(),
      )({ id: EP_ID, status: 'DISABLED' });

      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(mockWebhooks.updateEndpoint).toHaveBeenCalledWith(
        expect.anything(),
        EP_ID,
        { status: 'DISABLED' },
        ORG_ID,
      );
    });

    it('does not audit when the endpoint was not found', async () => {
      // The service throws on zero rows precisely so the audit below cannot
      // record an update that never happened.
      mockWebhooks.updateEndpoint.mockRejectedValueOnce(
        new WebhookEndpointNotFoundError(EP_ID),
      );
      const ctx = adminContext();

      await expect(
        client(webhooksRouter.update, ctx)({ id: EP_ID, status: 'DISABLED' }),
      ).rejects.toMatchObject({ code: 'NOT_FOUND' });

      expect(ctx.audit).not.toHaveBeenCalled();
    });

    it('requires ADMIN', async () => {
      await expect(
        client(
          webhooksRouter.update,
          orgContext(),
        )({ id: EP_ID, status: 'DISABLED' }),
      ).rejects.toThrow('Admin role required');
    });
  });

  // -------------------------------------------------------------------------
  // DELETE /webhooks/{id}
  // -------------------------------------------------------------------------

  describe('DELETE /webhooks/{id}', () => {
    it('deletes, audits, and returns success', async () => {
      mockWebhooks.deleteEndpoint.mockResolvedValueOnce({ id: EP_ID });
      const ctx = adminContext();

      const result = await client(webhooksRouter.delete, ctx)({ id: EP_ID });

      expect(result).toEqual({ success: true });
      expect(ctx.audit).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'WEBHOOK_ENDPOINT_DELETED' }),
      );
    });

    it('maps not-found to 404 and does not audit', async () => {
      // It reported `{success:true}` for an id that never existed before.
      mockWebhooks.deleteEndpoint.mockRejectedValueOnce(
        new WebhookEndpointNotFoundError(EP_ID),
      );
      const ctx = adminContext();

      await expect(
        client(webhooksRouter.delete, ctx)({ id: EP_ID }),
      ).rejects.toMatchObject({ code: 'NOT_FOUND' });

      expect(ctx.audit).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // POST /webhooks/{id}/rotate-secret
  // -------------------------------------------------------------------------

  describe('POST /webhooks/{id}/rotate-secret', () => {
    it('returns the new plaintext secret and audits', async () => {
      mockWebhooks.rotateSecret.mockResolvedValueOnce(
        endpointRowWithSecret() as never,
      );
      const ctx = adminContext();

      const result = (await client(
        webhooksRouter.rotateSecret,
        ctx,
      )({ id: EP_ID })) as { secret?: string };

      expect(result.secret).toBe('plaintext-secret');
      expect(ctx.audit).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'WEBHOOK_ENDPOINT_SECRET_ROTATED' }),
      );
    });

    it('maps not-found to 404 and does not audit', async () => {
      mockWebhooks.rotateSecret.mockRejectedValueOnce(
        new WebhookEndpointNotFoundError(EP_ID),
      );
      const ctx = adminContext();

      await expect(
        client(webhooksRouter.rotateSecret, ctx)({ id: EP_ID }),
      ).rejects.toMatchObject({ code: 'NOT_FOUND' });

      expect(ctx.audit).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // POST /webhooks/{id}/test
  // -------------------------------------------------------------------------

  describe('POST /webhooks/{id}/test', () => {
    it('enqueues a job carrying no endpoint URL or secret', async () => {
      mockWebhooks.getEndpoint.mockResolvedValueOnce(endpointRow() as never);
      mockWebhooks.createDelivery.mockResolvedValueOnce({
        id: DEL_ID,
      } as never);

      await client(webhooksRouter.test, adminContext())({ id: EP_ID });

      const jobData = mockEnqueue.mock.calls[0]?.[1];
      // The worker re-reads both at send time, so a rotated secret cannot be
      // replayed out of Redis.
      expect(jobData).not.toHaveProperty('secret');
      expect(jobData).not.toHaveProperty('endpointUrl');
      expect(jobData).toMatchObject({ deliveryId: DEL_ID, orgId: ORG_ID });
    });

    it('refuses a disabled endpoint with 400 and enqueues nothing', async () => {
      mockWebhooks.getEndpoint.mockResolvedValueOnce({
        ...endpointRow(),
        status: 'DISABLED',
      } as never);

      await expect(
        client(webhooksRouter.test, adminContext())({ id: EP_ID }),
      ).rejects.toMatchObject({ code: 'BAD_REQUEST' });

      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(mockWebhooks.createDelivery).not.toHaveBeenCalled();
      expect(mockEnqueue).not.toHaveBeenCalled();
    });

    it('maps not-found to 404 and creates no delivery', async () => {
      mockWebhooks.getEndpoint.mockRejectedValueOnce(
        new WebhookEndpointNotFoundError(EP_ID),
      );

      await expect(
        client(webhooksRouter.test, adminContext())({ id: EP_ID }),
      ).rejects.toMatchObject({ code: 'NOT_FOUND' });

      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(mockWebhooks.createDelivery).not.toHaveBeenCalled();
    });

    it('emits no audit event, matching the tRPC twin', async () => {
      // Pins a deliberate parity gap rather than hiding it: there is no
      // WEBHOOK_ENDPOINT_TESTED action, and adding one has to land on both
      // surfaces at once. Filed as a follow-up.
      mockWebhooks.getEndpoint.mockResolvedValueOnce(endpointRow() as never);
      mockWebhooks.createDelivery.mockResolvedValueOnce({
        id: DEL_ID,
      } as never);
      const ctx = adminContext();

      await client(webhooksRouter.test, ctx)({ id: EP_ID });

      expect(ctx.audit).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // GET /webhook-deliveries
  // -------------------------------------------------------------------------

  describe('GET /webhook-deliveries', () => {
    it('passes the org id as the third argument', async () => {
      mockWebhooks.listDeliveries.mockResolvedValueOnce({
        items: [],
        total: 0,
        page: 1,
        limit: 20,
        totalPages: 0,
      });

      await client(
        webhooksRouter.deliveries,
        orgContext(),
      )({ page: 1, limit: 20 });

      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(mockWebhooks.listDeliveries).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ page: 1, limit: 20 }),
        ORG_ID,
      );
    });

    it('forwards the endpointId, eventType and status filters', async () => {
      // These three come from `listWebhookDeliveriesSchema`; merging bare
      // pagination would have dropped them and stopped mirroring the tRPC twin.
      mockWebhooks.listDeliveries.mockResolvedValueOnce({
        items: [],
        total: 0,
        page: 1,
        limit: 20,
        totalPages: 0,
      });

      await client(
        webhooksRouter.deliveries,
        orgContext(),
      )({
        page: 1,
        limit: 20,
        endpointId: EP_ID,
        eventType: 'hopper/submission.submitted',
        status: 'FAILED',
      });

      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(mockWebhooks.listDeliveries).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          endpointId: EP_ID,
          eventType: 'hopper/submission.submitted',
          status: 'FAILED',
        }),
        ORG_ID,
      );
    });
  });

  // -------------------------------------------------------------------------
  // POST /webhook-deliveries/{deliveryId}/retry
  // -------------------------------------------------------------------------

  describe('POST /webhook-deliveries/{deliveryId}/retry', () => {
    it('passes (tx, deliveryId, orgId) — all three', async () => {
      // The argument list PR #541 exists for. Before it, the org id was not
      // passed at all and ownership was compared after the row was mutated.
      mockWebhooks.retryDelivery.mockResolvedValueOnce(deliveryRow() as never);
      mockWebhooks.getEndpointForDelivery.mockResolvedValueOnce({
        endpointId: EP_ID,
        url: 'https://example.com/hook',
        secret: 's',
        status: 'ACTIVE',
        eventTypes: ['hopper/submission.submitted'],
      } as never);

      await client(
        webhooksRouter.retryDelivery,
        adminContext(),
      )({ deliveryId: DEL_ID });

      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(mockWebhooks.retryDelivery).toHaveBeenCalledWith(
        expect.anything(),
        DEL_ID,
        ORG_ID,
      );
    });

    it('retries through enqueueWebhookRetry, never a plain enqueue', async () => {
      // A plain add is deduped into a no-op by the retained job under the same
      // delivery id — the row would go back to QUEUED and nothing would run.
      mockWebhooks.retryDelivery.mockResolvedValueOnce(deliveryRow() as never);
      mockWebhooks.getEndpointForDelivery.mockResolvedValueOnce({
        endpointId: EP_ID,
        url: 'https://example.com/hook',
        secret: 's',
        status: 'ACTIVE',
        eventTypes: ['hopper/submission.submitted'],
      } as never);

      await client(
        webhooksRouter.retryDelivery,
        adminContext(),
      )({ deliveryId: DEL_ID });

      expect(mockEnqueueRetry).toHaveBeenCalled();
      expect(mockEnqueue).not.toHaveBeenCalled();
    });

    it('maps a missing delivery to 404 and does not audit or enqueue', async () => {
      mockWebhooks.retryDelivery.mockRejectedValueOnce(
        new WebhookDeliveryNotFoundError(DEL_ID),
      );
      const ctx = adminContext();

      await expect(
        client(webhooksRouter.retryDelivery, ctx)({ deliveryId: DEL_ID }),
      ).rejects.toMatchObject({ code: 'NOT_FOUND' });

      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(mockWebhooks.getEndpointForDelivery).not.toHaveBeenCalled();
      expect(mockEnqueueRetry).not.toHaveBeenCalled();
      expect(ctx.audit).not.toHaveBeenCalled();
    });

    it('maps an endpoint in another org to 404 and does not enqueue', async () => {
      // The retry predicate scopes the delivery; this join scopes the endpoint
      // it points at. The FK guarantees existence, not org affinity.
      mockWebhooks.retryDelivery.mockResolvedValueOnce(deliveryRow() as never);
      mockWebhooks.getEndpointForDelivery.mockResolvedValueOnce(null as never);
      const ctx = adminContext();

      await expect(
        client(webhooksRouter.retryDelivery, ctx)({ deliveryId: DEL_ID }),
      ).rejects.toMatchObject({ code: 'NOT_FOUND' });

      expect(mockEnqueueRetry).not.toHaveBeenCalled();
      expect(ctx.audit).not.toHaveBeenCalled();
    });

    it('requires ADMIN', async () => {
      await expect(
        client(
          webhooksRouter.retryDelivery,
          orgContext(),
        )({ deliveryId: DEL_ID }),
      ).rejects.toThrow('Admin role required');
    });
  });

  // -------------------------------------------------------------------------
  // API key scope enforcement
  // -------------------------------------------------------------------------

  describe('API key scope enforcement', () => {
    it('denies a key holding an unrelated scope', async () => {
      await expect(
        client(
          webhooksRouter.list,
          apiKeyContext(['submissions:read']),
        )({ page: 1, limit: 20 }),
      ).rejects.toThrow('Insufficient API key scope');
    });

    it('allows webhooks:read on a read route', async () => {
      mockWebhooks.listEndpoints.mockResolvedValueOnce({
        items: [],
        total: 0,
        page: 1,
        limit: 20,
        totalPages: 0,
      });

      const result = await client(
        webhooksRouter.list,
        apiKeyContext(['webhooks:read']),
      )({ page: 1, limit: 20 });

      expect(result).toMatchObject({ total: 0 });
    });

    it('does not let webhooks:read satisfy a manage route', async () => {
      // Read must not imply manage. If these ever collapse into one scope,
      // this is the test that should stop it.
      await expect(
        client(
          webhooksRouter.rotateSecret,
          apiKeyContext(['webhooks:read']),
        )({ id: EP_ID }),
      ).rejects.toThrow('Insufficient API key scope');
    });

    it('allows webhooks:manage on a manage route', async () => {
      mockWebhooks.rotateSecret.mockResolvedValueOnce(
        endpointRowWithSecret() as never,
      );

      const result = (await client(
        webhooksRouter.rotateSecret,
        apiKeyContext(['webhooks:manage']),
      )({ id: EP_ID })) as { secret?: string };

      expect(result.secret).toBe('plaintext-secret');
    });

    it('does not let webhooks:manage satisfy a read route', async () => {
      await expect(
        client(
          webhooksRouter.deliveries,
          apiKeyContext(['webhooks:manage']),
        )({ page: 1, limit: 20 }),
      ).rejects.toThrow('Insufficient API key scope');
    });

    it('bypasses scopes entirely for interactive auth', async () => {
      mockWebhooks.listEndpoints.mockResolvedValueOnce({
        items: [],
        total: 0,
        page: 1,
        limit: 20,
        totalPages: 0,
      });

      const result = await client(
        webhooksRouter.list,
        orgContext(),
      )({ page: 1, limit: 20 });

      expect(result).toMatchObject({ total: 0 });
    });
  });
});
