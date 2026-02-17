import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  vi,
  beforeEach,
} from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';
import type { Env } from '../config/env.js';

// vi.hoisted for mock functions used in vi.mock factories
const {
  mockPoolConnect,
  mockClientQuery,
  mockClientRelease,
  mockTxInsert,
  mockAuditLog,
  mockRedisEval,
  mockRedisQuit,
  mockConstructEvent,
} = vi.hoisted(() => {
  const mockClientQuery = vi.fn().mockResolvedValue({ rows: [] });
  const mockClientRelease = vi.fn();
  const mockPoolConnect = vi.fn().mockResolvedValue({
    query: mockClientQuery,
    release: mockClientRelease,
  });

  // Mock tx (Drizzle instance on transaction client)
  const onConflictDoUpdate = vi.fn().mockResolvedValue({ rowCount: 1 });
  const values = vi.fn(() => ({ onConflictDoUpdate }));
  const mockTxInsert = vi.fn(() => ({ values }));
  const mockAuditLog = vi.fn().mockResolvedValue(undefined);
  const mockRedisEval = vi.fn().mockResolvedValue([1, 60000]);
  const mockRedisQuit = vi.fn().mockResolvedValue('OK');
  const mockConstructEvent = vi.fn();

  return {
    mockPoolConnect,
    mockClientQuery,
    mockClientRelease,
    mockTxInsert,
    mockAuditLog,
    mockRedisEval,
    mockRedisQuit,
    mockConstructEvent,
  };
});

vi.mock('@colophony/db', () => {
  return {
    sql: Object.assign(
      (strings: TemplateStringsArray, ...values: unknown[]) => ({
        strings,
        values,
      }),
      { raw: (s: string) => s },
    ),
    pool: {
      connect: mockPoolConnect,
      query: vi.fn().mockResolvedValue({ rows: [{ '?column?': 1 }] }),
    },
    payments: {
      stripeSessionId: 'stripe_session_id',
      stripePaymentId: 'stripe_payment_id',
      amount: 'amount',
      currency: 'currency',
      status: 'status',
    },
  };
});

// Mock drizzle constructor to return a tx with insert
vi.mock('drizzle-orm/node-postgres', () => ({
  drizzle: vi.fn(() => ({
    insert: mockTxInsert,
  })),
}));

vi.mock('../services/audit.service.js', () => ({
  auditService: { log: mockAuditLog },
}));

// Mock ioredis
vi.mock('ioredis', () => {
  const RedisMock = vi.fn().mockImplementation(function () {
    return {
      connect: vi.fn().mockResolvedValue(undefined),
      eval: mockRedisEval,
      quit: mockRedisQuit,
      status: 'ready',
    };
  });
  return { default: RedisMock };
});

// Mock Stripe
vi.mock('stripe', () => {
  const StripeMock = vi.fn().mockImplementation(function () {
    return {
      webhooks: {
        constructEvent: mockConstructEvent,
      },
    };
  });
  return { default: StripeMock };
});

import { registerStripeWebhooks } from './stripe.webhook.js';

const WEBHOOK_SECRET = 'whsec_test_secret';

const testEnv: Env = {
  DATABASE_URL: 'postgresql://test:test@localhost:5432/test',
  PORT: 0,
  HOST: '127.0.0.1',
  NODE_ENV: 'test',
  LOG_LEVEL: 'fatal',
  REDIS_HOST: 'localhost',
  REDIS_PORT: 6379,
  REDIS_PASSWORD: '',
  CORS_ORIGIN: 'http://localhost:3000',
  RATE_LIMIT_DEFAULT_MAX: 60,
  RATE_LIMIT_AUTH_MAX: 200,
  RATE_LIMIT_WINDOW_SECONDS: 60,
  RATE_LIMIT_KEY_PREFIX: 'colophony:rl',
  AUTH_FAILURE_THROTTLE_MAX: 10,
  AUTH_FAILURE_THROTTLE_WINDOW_SECONDS: 300,
  WEBHOOK_TIMESTAMP_MAX_AGE_SECONDS: 300,
  WEBHOOK_RATE_LIMIT_MAX: 100,
  S3_ENDPOINT: 'http://localhost:9000',
  S3_BUCKET: 'submissions',
  S3_QUARANTINE_BUCKET: 'quarantine',
  S3_ACCESS_KEY: 'minioadmin',
  S3_SECRET_KEY: 'minioadmin',
  S3_REGION: 'us-east-1',
  TUS_ENDPOINT: 'http://localhost:1080',
  CLAMAV_HOST: 'localhost',
  CLAMAV_PORT: 3310,
  VIRUS_SCAN_ENABLED: true,
  DEV_AUTH_BYPASS: false,
  FEDERATION_ENABLED: false,
  STRIPE_SECRET_KEY: 'sk_test_xxx',
  STRIPE_WEBHOOK_SECRET: WEBHOOK_SECRET,
};

const TEST_ORG_ID = '550e8400-e29b-41d4-a716-446655440000';
const TEST_SUBMISSION_ID = '660e8400-e29b-41d4-a716-446655440001';

function makeStripeEvent(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    id: 'evt_test_001',
    type: 'checkout.session.completed',
    data: {
      object: {
        id: 'cs_test_session',
        payment_intent: 'pi_test_intent',
        amount_total: 2500,
        currency: 'usd',
        metadata: {
          organizationId: TEST_ORG_ID,
          submissionId: TEST_SUBMISSION_ID,
        },
      },
    },
    ...overrides,
  };
}

function sendWebhook(
  app: FastifyInstance,
  headers: Record<string, string> = {},
) {
  return app.inject({
    method: 'POST',
    url: '/webhooks/stripe',
    headers: {
      'content-type': 'application/json',
      'stripe-signature': 'test_sig',
      ...headers,
    },
    payload: '{}', // Raw body is what matters; Stripe SDK verifies from rawBody
  });
}

describe('Stripe webhook handler', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = Fastify({ logger: false });
    await app.register(async (scope) => {
      await registerStripeWebhooks(scope, { env: testEnv });
    });
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    mockClientQuery.mockClear();
    mockClientRelease.mockClear();
    mockPoolConnect.mockClear();
    mockTxInsert.mockClear();
    mockAuditLog.mockClear().mockResolvedValue(undefined);
    mockRedisEval.mockClear().mockResolvedValue([1, 60000]);
    mockRedisQuit.mockClear();
    mockConstructEvent.mockClear();

    // Default mock setup
    mockPoolConnect.mockResolvedValue({
      query: mockClientQuery,
      release: mockClientRelease,
    });

    // Default: constructEvent returns a valid event
    mockConstructEvent.mockReturnValue(makeStripeEvent());

    // Default client.query behavior:
    // - INSERT returns nothing (ON CONFLICT DO NOTHING)
    // - SELECT processed returns false (new event)
    // - UPDATE returns success
    mockClientQuery.mockImplementation((sqlStr: string) => {
      if (typeof sqlStr === 'string' && sqlStr.includes('SELECT processed')) {
        return { rows: [{ processed: false }] };
      }
      return { rows: [] };
    });

    // Reset tx mock
    const onConflictDoUpdate = vi.fn().mockResolvedValue({ rowCount: 1 });
    const values = vi.fn(() => ({ onConflictDoUpdate }));
    mockTxInsert.mockImplementation(() => ({ values }));
  });

  // === Signature verification ===

  describe('signature verification', () => {
    it('rejects missing stripe-signature header', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/webhooks/stripe',
        headers: { 'content-type': 'application/json' },
        payload: '{}',
      });
      expect(response.statusCode).toBe(401);
      expect(response.json().error).toBe('invalid_signature');
    });

    it('passes configured timestamp tolerance to constructEvent', async () => {
      await sendWebhook(app);
      expect(mockConstructEvent).toHaveBeenCalledWith(
        expect.anything(), // rawBody
        'test_sig', // signature header
        WEBHOOK_SECRET,
        testEnv.WEBHOOK_TIMESTAMP_MAX_AGE_SECONDS,
      );
    });

    it('rejects invalid signature', async () => {
      mockConstructEvent.mockImplementation(() => {
        throw new Error('Invalid signature');
      });

      const response = await sendWebhook(app);
      expect(response.statusCode).toBe(401);
      expect(response.json().error).toBe('invalid_signature');
    });

    it('rejects when STRIPE_SECRET_KEY not configured', async () => {
      const noKeyApp = Fastify({ logger: false });
      await noKeyApp.register(async (scope) => {
        await registerStripeWebhooks(scope, {
          env: { ...testEnv, STRIPE_SECRET_KEY: undefined },
        });
      });

      const response = await noKeyApp.inject({
        method: 'POST',
        url: '/webhooks/stripe',
        headers: {
          'content-type': 'application/json',
          'stripe-signature': 'test_sig',
        },
        payload: '{}',
      });
      expect(response.statusCode).toBe(401);
      expect(response.json().error).toBe('invalid_signature');
      await noKeyApp.close();
    });

    it('rejects when STRIPE_WEBHOOK_SECRET not configured', async () => {
      const noSecretApp = Fastify({ logger: false });
      await noSecretApp.register(async (scope) => {
        await registerStripeWebhooks(scope, {
          env: { ...testEnv, STRIPE_WEBHOOK_SECRET: undefined },
        });
      });

      const response = await noSecretApp.inject({
        method: 'POST',
        url: '/webhooks/stripe',
        headers: {
          'content-type': 'application/json',
          'stripe-signature': 'test_sig',
        },
        payload: '{}',
      });
      expect(response.statusCode).toBe(401);
      expect(response.json().error).toBe('invalid_signature');
      await noSecretApp.close();
    });
  });

  // === Idempotency ===

  describe('idempotency', () => {
    it('processes new event (INSERT succeeds, processed=false)', async () => {
      const response = await sendWebhook(app);
      expect(response.statusCode).toBe(200);
      expect(response.json().status).toBe('processed');
      expect(mockClientRelease).toHaveBeenCalledOnce();
    });

    it('skips already-processed event (processed=true)', async () => {
      mockClientQuery.mockImplementation((sqlStr: string) => {
        if (typeof sqlStr === 'string' && sqlStr.includes('SELECT processed')) {
          return { rows: [{ processed: true }] };
        }
        return { rows: [] };
      });

      const response = await sendWebhook(app);
      expect(response.statusCode).toBe(200);
      expect(response.json().status).toBe('already_processed');
      // Should not process business logic
      expect(mockTxInsert).not.toHaveBeenCalled();
      expect(mockAuditLog).not.toHaveBeenCalled();
      expect(mockClientRelease).toHaveBeenCalledOnce();
    });

    it('reprocesses partially-processed event (crash recovery, processed=false on existing)', async () => {
      // INSERT ON CONFLICT DO NOTHING (existing record), SELECT returns processed=false
      mockClientQuery.mockImplementation((sqlStr: string) => {
        if (typeof sqlStr === 'string' && sqlStr.includes('SELECT processed')) {
          return { rows: [{ processed: false }] };
        }
        return { rows: [] };
      });

      const response = await sendWebhook(app);
      expect(response.statusCode).toBe(200);
      expect(response.json().status).toBe('processed');
      // Should process business logic (crash recovery)
      expect(mockTxInsert).toHaveBeenCalled();
    });
  });

  // === Event processing ===

  describe('checkout.session.completed', () => {
    it('upserts payment and logs audit', async () => {
      const response = await sendWebhook(app);
      expect(response.statusCode).toBe(200);
      expect(response.json().status).toBe('processed');

      // Verify payment upsert
      expect(mockTxInsert).toHaveBeenCalledOnce();

      // Verify audit log
      expect(mockAuditLog).toHaveBeenCalledOnce();
      const params = mockAuditLog.mock.calls[0][1];
      expect(params.action).toBe('PAYMENT_SUCCEEDED');
      expect(params.resource).toBe('payment');
      expect(params.organizationId).toBe(TEST_ORG_ID);
      expect(params.resourceId).toBe('cs_test_session');
    });

    it('sets RLS org context via set_config', async () => {
      await sendWebhook(app);

      // Find the set_config call
      const setConfigCall = mockClientQuery.mock.calls.find(
        (call: unknown[]) =>
          typeof call[0] === 'string' && call[0].includes('set_config'),
      );
      expect(setConfigCall).toBeDefined();
      expect(setConfigCall![1]).toEqual(['app.current_org', TEST_ORG_ID]);
    });
  });

  describe('checkout.session.expired', () => {
    it('upserts payment with FAILED status and logs audit', async () => {
      mockConstructEvent.mockReturnValue(
        makeStripeEvent({
          id: 'evt_expired_001',
          type: 'checkout.session.expired',
        }),
      );

      const response = await sendWebhook(app);
      expect(response.statusCode).toBe(200);
      expect(response.json().status).toBe('processed');

      expect(mockTxInsert).toHaveBeenCalledOnce();
      expect(mockAuditLog).toHaveBeenCalledOnce();
      const params = mockAuditLog.mock.calls[0][1];
      expect(params.action).toBe('PAYMENT_EXPIRED');
      expect(params.resource).toBe('payment');
    });
  });

  describe('unknown event types', () => {
    it('stores but does not process unknown event types', async () => {
      mockConstructEvent.mockReturnValue(
        makeStripeEvent({
          id: 'evt_unknown_001',
          type: 'customer.subscription.created',
        }),
      );

      const response = await sendWebhook(app);
      expect(response.statusCode).toBe(200);
      expect(response.json().status).toBe('processed');
      // No payment upsert or audit for unknown types
      expect(mockTxInsert).not.toHaveBeenCalled();
      expect(mockAuditLog).not.toHaveBeenCalled();
    });
  });

  // === Metadata validation ===

  describe('metadata validation', () => {
    it('records error for missing organizationId and returns 200', async () => {
      mockConstructEvent.mockReturnValue(
        makeStripeEvent({
          id: 'evt_no_org',
          data: {
            object: {
              id: 'cs_no_org',
              payment_intent: 'pi_no_org',
              amount_total: 1000,
              currency: 'usd',
              metadata: {},
            },
          },
        }),
      );

      const response = await sendWebhook(app);
      expect(response.statusCode).toBe(200);
      expect(response.json().status).toBe('processed');
      // Should not upsert payment or log audit
      expect(mockTxInsert).not.toHaveBeenCalled();
      expect(mockAuditLog).not.toHaveBeenCalled();

      // Should record error in webhook events table
      const errorCall = mockClientQuery.mock.calls.find(
        (call: unknown[]) =>
          typeof call[0] === 'string' &&
          call[0].includes('UPDATE stripe_webhook_events SET error'),
      );
      expect(errorCall).toBeDefined();
    });

    it('records error for invalid organizationId format', async () => {
      mockConstructEvent.mockReturnValue(
        makeStripeEvent({
          id: 'evt_bad_org',
          data: {
            object: {
              id: 'cs_bad_org',
              payment_intent: 'pi_bad_org',
              amount_total: 1000,
              currency: 'usd',
              metadata: { organizationId: 'not-a-uuid' },
            },
          },
        }),
      );

      const response = await sendWebhook(app);
      expect(response.statusCode).toBe(200);
      expect(response.json().status).toBe('processed');
      expect(mockTxInsert).not.toHaveBeenCalled();
    });

    it('processes event with optional submissionId omitted', async () => {
      mockConstructEvent.mockReturnValue(
        makeStripeEvent({
          id: 'evt_no_sub',
          data: {
            object: {
              id: 'cs_no_sub',
              payment_intent: 'pi_no_sub',
              amount_total: 1000,
              currency: 'usd',
              metadata: { organizationId: TEST_ORG_ID },
            },
          },
        }),
      );

      const response = await sendWebhook(app);
      expect(response.statusCode).toBe(200);
      expect(response.json().status).toBe('processed');
      expect(mockTxInsert).toHaveBeenCalledOnce();
      expect(mockAuditLog).toHaveBeenCalledOnce();
    });
  });

  // === Error handling ===

  describe('error handling', () => {
    it('returns 500 and rolls back on processing error', async () => {
      mockTxInsert.mockImplementation(() => ({
        values: vi.fn(() => ({
          onConflictDoUpdate: vi.fn().mockRejectedValue(new Error('DB error')),
        })),
      }));

      const response = await sendWebhook(app);
      expect(response.statusCode).toBe(500);
      expect(response.json().error).toBe('processing_failed');

      // Verify ROLLBACK was called
      const rollbackCall = mockClientQuery.mock.calls.find(
        (call: unknown[]) => call[0] === 'ROLLBACK',
      );
      expect(rollbackCall).toBeDefined();
      expect(mockClientRelease).toHaveBeenCalledOnce();
    });

    it('always releases client even on error', async () => {
      mockClientQuery.mockRejectedValue(new Error('Connection error'));

      const response = await sendWebhook(app);
      expect(response.statusCode).toBe(500);
      expect(mockClientRelease).toHaveBeenCalledOnce();
    });
  });

  // === Rate limiting ===

  describe('webhook rate limiting', () => {
    it('returns 429 when rate limit exceeded', async () => {
      mockRedisEval.mockResolvedValueOnce([101, 30000]);

      const response = await sendWebhook(app);
      expect(response.statusCode).toBe(429);
      expect(response.json().error).toBe('rate_limit_exceeded');
      expect(response.headers['retry-after']).toBeDefined();
    });

    it('allows request when under rate limit', async () => {
      mockRedisEval.mockResolvedValueOnce([5, 60000]);

      const response = await sendWebhook(app);
      expect(response.statusCode).toBe(200);
    });

    it('allows request when Redis errors (graceful degradation)', async () => {
      mockRedisEval.mockRejectedValueOnce(new Error('Redis connection failed'));

      const response = await sendWebhook(app);
      expect(response.statusCode).toBe(200);
      expect(response.json().status).toBe('processed');
    });
  });
});
