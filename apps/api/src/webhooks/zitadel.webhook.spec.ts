import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  vi,
  beforeEach,
} from 'vitest';
import { createHmac } from 'node:crypto';
import Fastify, { type FastifyInstance } from 'fastify';
import type { Env } from '../config/env.js';

// vi.hoisted for mock functions used in vi.mock factories
const {
  mockPoolConnect,
  mockClientQuery,
  mockClientRelease,
  mockTxInsert,
  mockTxUpdate,
  mockTxSelect,
  mockAuditLog,
  mockRedisEval,
  mockRedisQuit,
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
  const where = vi.fn().mockResolvedValue({ rowCount: 1 });
  const set = vi.fn(() => ({ where }));
  const mockTxUpdate = vi.fn(() => ({ set }));
  const limit = vi.fn().mockResolvedValue([{ id: 'existing-user-id' }]);
  const selectFrom = vi.fn(() => ({ where: vi.fn(() => ({ limit })) }));
  const mockTxSelect = vi.fn(() => ({ from: selectFrom }));
  const mockAuditLog = vi.fn().mockResolvedValue(undefined);
  const mockRedisEval = vi.fn().mockResolvedValue([1, 60000]);
  const mockRedisQuit = vi.fn().mockResolvedValue('OK');

  return {
    mockPoolConnect,
    mockClientQuery,
    mockClientRelease,
    mockTxInsert,
    mockTxUpdate,
    mockTxSelect,
    mockAuditLog,
    mockRedisEval,
    mockRedisQuit,
  };
});

vi.mock('@colophony/db', () => {
  return {
    eq: vi.fn((_col: unknown, val: unknown) => val),
    and: vi.fn((...args: unknown[]) => args),
    or: vi.fn((...args: unknown[]) => args),
    lt: vi.fn((_col: unknown, val: unknown) => val),
    isNull: vi.fn((_col: unknown) => 'IS_NULL'),
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
    users: {
      zitadelUserId: 'zitadel_user_id',
      lastEventAt: 'last_event_at',
      id: 'id',
    },
    zitadelWebhookEvents: {},
  };
});

// Mock drizzle constructor to return a tx with insert/update/select
vi.mock('drizzle-orm/node-postgres', () => ({
  drizzle: vi.fn(() => ({
    insert: mockTxInsert,
    update: mockTxUpdate,
    select: mockTxSelect,
  })),
}));

vi.mock('../services/audit.service.js', () => ({
  auditService: { log: mockAuditLog },
}));

// Mock ioredis
vi.mock('ioredis', () => {
  const RedisMock = vi.fn().mockImplementation(() => ({
    connect: vi.fn().mockResolvedValue(undefined),
    eval: mockRedisEval,
    quit: mockRedisQuit,
    status: 'ready',
  }));
  return { default: RedisMock };
});

import { registerZitadelWebhooks } from './zitadel.webhook.js';

const WEBHOOK_SECRET = 'test-webhook-secret';

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
  WEBHOOK_TIMESTAMP_MAX_AGE_SECONDS: 300,
  WEBHOOK_RATE_LIMIT_MAX: 100,
  S3_ENDPOINT: 'http://localhost:9000',
  S3_BUCKET: 'submissions',
  S3_QUARANTINE_BUCKET: 'quarantine',
  S3_ACCESS_KEY: 'minioadmin',
  S3_SECRET_KEY: 'minioadmin',
  S3_REGION: 'us-east-1',
  TUS_ENDPOINT: 'http://localhost:1080',
  ZITADEL_WEBHOOK_SECRET: WEBHOOK_SECRET,
  CLAMAV_HOST: 'localhost',
  CLAMAV_PORT: 3310,
  VIRUS_SCAN_ENABLED: true,
  DEV_AUTH_BYPASS: false,
};

function signPayload(body: string): string {
  return createHmac('sha256', WEBHOOK_SECRET).update(body).digest('hex');
}

function makePayload(overrides: Record<string, unknown> = {}) {
  return {
    eventId: 'evt-001',
    eventType: 'user.created',
    creationDate: new Date().toISOString(),
    user: {
      userId: 'zitadel-user-1',
      email: 'alice@example.com',
      emailVerified: true,
      displayName: 'Alice',
    },
    ...overrides,
  };
}

describe('Zitadel webhook handler', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = Fastify({ logger: false });
    await app.register(async (scope) => {
      await registerZitadelWebhooks(scope, { env: testEnv });
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
    mockTxUpdate.mockClear();
    mockTxSelect.mockClear();
    mockAuditLog.mockClear().mockResolvedValue(undefined);
    mockRedisEval.mockClear().mockResolvedValue([1, 60000]);
    mockRedisQuit.mockClear();

    // Default: insert returns 1 row (new event), not a duplicate
    mockPoolConnect.mockResolvedValue({
      query: mockClientQuery,
      release: mockClientRelease,
    });
    mockClientQuery.mockImplementation((sql: string) => {
      if (
        typeof sql === 'string' &&
        sql.includes('INSERT INTO zitadel_webhook_events')
      ) {
        return { rows: [{ id: 'webhook-evt-id' }] };
      }
      if (
        typeof sql === 'string' &&
        sql.includes('UPDATE zitadel_webhook_events')
      ) {
        return { rows: [{ id: 'webhook-evt-id' }] };
      }
      return { rows: [] };
    });

    // Reset tx mocks to default behavior
    const onConflictDoUpdate = vi.fn().mockResolvedValue({ rowCount: 1 });
    const values = vi.fn(() => ({ onConflictDoUpdate }));
    mockTxInsert.mockImplementation(() => ({ values }));
    const where = vi.fn().mockResolvedValue({ rowCount: 1 });
    const set = vi.fn(() => ({ where }));
    mockTxUpdate.mockImplementation(() => ({ set }));
    const limit = vi.fn().mockResolvedValue([{ id: 'existing-user-id' }]);
    const selectWhere = vi.fn(() => ({ limit }));
    const selectFrom = vi.fn(() => ({ where: selectWhere }));
    mockTxSelect.mockImplementation(() => ({ from: selectFrom }));
  });

  it('rejects missing signature', async () => {
    const body = JSON.stringify(makePayload());
    const response = await app.inject({
      method: 'POST',
      url: '/webhooks/zitadel',
      headers: { 'content-type': 'application/json' },
      payload: body,
    });
    expect(response.statusCode).toBe(401);
    expect(response.json().error).toBe('invalid_signature');
  });

  it('rejects invalid signature', async () => {
    const body = JSON.stringify(makePayload());
    const response = await app.inject({
      method: 'POST',
      url: '/webhooks/zitadel',
      headers: {
        'content-type': 'application/json',
        'x-zitadel-signature': 'deadbeef',
      },
      payload: body,
    });
    expect(response.statusCode).toBe(401);
    expect(response.json().error).toBe('invalid_signature');
  });

  it('accepts valid signature and processes event', async () => {
    const body = JSON.stringify(makePayload());
    const sig = signPayload(body);

    const response = await app.inject({
      method: 'POST',
      url: '/webhooks/zitadel',
      headers: {
        'content-type': 'application/json',
        'x-zitadel-signature': sig,
      },
      payload: body,
    });
    expect(response.statusCode).toBe(200);
    expect(response.json().status).toBe('processed');
  });

  it('returns 200 for duplicate event (idempotency)', async () => {
    // Simulate: INSERT returns no rows (conflict = already seen)
    mockClientQuery.mockImplementation((sql: string) => {
      if (
        typeof sql === 'string' &&
        sql.includes('INSERT INTO zitadel_webhook_events')
      ) {
        return { rows: [] }; // No rows = already exists
      }
      return { rows: [] };
    });

    const body = JSON.stringify(makePayload({ eventId: 'evt-duplicate' }));
    const sig = signPayload(body);

    const response = await app.inject({
      method: 'POST',
      url: '/webhooks/zitadel',
      headers: {
        'content-type': 'application/json',
        'x-zitadel-signature': sig,
      },
      payload: body,
    });
    expect(response.statusCode).toBe(200);
    expect(response.json().status).toBe('already_processed');
    expect(mockClientRelease).toHaveBeenCalledOnce();
  });

  it('rejects invalid payload (missing eventId)', async () => {
    const body = JSON.stringify({ eventType: 'user.created' });
    const sig = signPayload(body);

    const response = await app.inject({
      method: 'POST',
      url: '/webhooks/zitadel',
      headers: {
        'content-type': 'application/json',
        'x-zitadel-signature': sig,
      },
      payload: body,
    });
    expect(response.statusCode).toBe(400);
    expect(response.json().error).toBe('invalid_payload');
  });

  it.each([
    ['array', []],
    ['string', 'not-json-object'],
    ['number', 123],
  ])('rejects non-object body (%s)', async (_label, payload) => {
    const body = JSON.stringify(payload);
    const sig = signPayload(body);

    const response = await app.inject({
      method: 'POST',
      url: '/webhooks/zitadel',
      headers: {
        'content-type': 'application/json',
        'x-zitadel-signature': sig,
      },
      payload: body,
    });
    expect(response.statusCode).toBe(400);
    expect(response.json().error).toBe('invalid_payload');
  });

  it('rejects payload with empty eventType', async () => {
    const body = JSON.stringify({
      eventId: 'evt-empty-type',
      eventType: '',
      creationDate: new Date().toISOString(),
    });
    const sig = signPayload(body);

    const response = await app.inject({
      method: 'POST',
      url: '/webhooks/zitadel',
      headers: {
        'content-type': 'application/json',
        'x-zitadel-signature': sig,
      },
      payload: body,
    });
    expect(response.statusCode).toBe(400);
    expect(response.json().error).toBe('invalid_payload');
  });

  it('accepts unknown eventType without user mutations or audit', async () => {
    const body = JSON.stringify(
      makePayload({ eventType: 'org.created', eventId: 'evt-unknown-type' }),
    );
    const sig = signPayload(body);

    const response = await app.inject({
      method: 'POST',
      url: '/webhooks/zitadel',
      headers: {
        'content-type': 'application/json',
        'x-zitadel-signature': sig,
      },
      payload: body,
    });
    expect(response.statusCode).toBe(200);
    expect(response.json().status).toBe('processed');
    expect(mockTxInsert).not.toHaveBeenCalled();
    expect(mockTxUpdate).not.toHaveBeenCalled();
    expect(mockAuditLog).not.toHaveBeenCalled();
  });

  it('accepts payload with no user field without mutations or audit', async () => {
    const body = JSON.stringify({
      eventId: 'evt-no-user',
      eventType: 'user.created',
      creationDate: new Date().toISOString(),
    });
    const sig = signPayload(body);

    const response = await app.inject({
      method: 'POST',
      url: '/webhooks/zitadel',
      headers: {
        'content-type': 'application/json',
        'x-zitadel-signature': sig,
      },
      payload: body,
    });
    expect(response.statusCode).toBe(200);
    expect(response.json().status).toBe('processed');
    expect(mockTxInsert).not.toHaveBeenCalled();
    expect(mockTxUpdate).not.toHaveBeenCalled();
    expect(mockAuditLog).not.toHaveBeenCalled();
  });

  it('logs audit event for user.created', async () => {
    const body = JSON.stringify(makePayload());
    const sig = signPayload(body);

    await app.inject({
      method: 'POST',
      url: '/webhooks/zitadel',
      headers: {
        'content-type': 'application/json',
        'x-zitadel-signature': sig,
      },
      payload: body,
    });

    expect(mockAuditLog).toHaveBeenCalledOnce();
    const params = mockAuditLog.mock.calls[0][1];
    expect(params.action).toBe('USER_CREATED');
    expect(params.resource).toBe('user');
    expect(params.actorId).toBeUndefined();
    expect(params.organizationId).toBeUndefined();
    expect(params.newValue).toEqual({
      zitadelUserId: 'zitadel-user-1',
      email: 'alice@example.com',
      emailVerified: true,
    });
  });

  it('logs audit event for user.deactivated', async () => {
    const body = JSON.stringify(
      makePayload({ eventType: 'user.deactivated', eventId: 'evt-deact' }),
    );
    const sig = signPayload(body);

    await app.inject({
      method: 'POST',
      url: '/webhooks/zitadel',
      headers: {
        'content-type': 'application/json',
        'x-zitadel-signature': sig,
      },
      payload: body,
    });

    expect(mockAuditLog).toHaveBeenCalledOnce();
    const params = mockAuditLog.mock.calls[0][1];
    expect(params.action).toBe('USER_DEACTIVATED');
    expect(params.resource).toBe('user');
  });

  it('logs USER_UPDATED audit for user.changed', async () => {
    const body = JSON.stringify(
      makePayload({ eventType: 'user.changed', eventId: 'evt-changed' }),
    );
    const sig = signPayload(body);

    await app.inject({
      method: 'POST',
      url: '/webhooks/zitadel',
      headers: {
        'content-type': 'application/json',
        'x-zitadel-signature': sig,
      },
      payload: body,
    });

    expect(mockAuditLog).toHaveBeenCalledOnce();
    const params = mockAuditLog.mock.calls[0][1];
    expect(params.action).toBe('USER_UPDATED');
  });

  it('does not log audit for duplicate webhook delivery', async () => {
    mockClientQuery.mockImplementation((sql: string) => {
      if (
        typeof sql === 'string' &&
        sql.includes('INSERT INTO zitadel_webhook_events')
      ) {
        return { rows: [] }; // duplicate
      }
      return { rows: [] };
    });

    const body = JSON.stringify(makePayload({ eventId: 'evt-dup-audit' }));
    const sig = signPayload(body);

    await app.inject({
      method: 'POST',
      url: '/webhooks/zitadel',
      headers: {
        'content-type': 'application/json',
        'x-zitadel-signature': sig,
      },
      payload: body,
    });

    expect(mockAuditLog).not.toHaveBeenCalled();
  });

  it('returns 500 on processing error and rolls back', async () => {
    // Make tx.insert throw to simulate a DB error during event processing
    mockTxInsert.mockImplementation(() => ({
      values: vi.fn(() => ({
        onConflictDoUpdate: vi.fn().mockRejectedValue(new Error('DB error')),
      })),
    }));

    mockClientQuery.mockImplementation((sql: string) => {
      if (
        typeof sql === 'string' &&
        sql.includes('INSERT INTO zitadel_webhook_events')
      ) {
        return { rows: [{ id: 'webhook-evt-id' }] };
      }
      return { rows: [] };
    });

    const body = JSON.stringify(makePayload({ eventId: 'evt-error' }));
    const sig = signPayload(body);

    const response = await app.inject({
      method: 'POST',
      url: '/webhooks/zitadel',
      headers: {
        'content-type': 'application/json',
        'x-zitadel-signature': sig,
      },
      payload: body,
    });
    expect(response.statusCode).toBe(500);
    expect(response.json().error).toBe('processing_failed');
  });

  // === Timestamp freshness tests ===

  describe('timestamp freshness', () => {
    it('rejects event with timestamp too old', async () => {
      const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
      const body = JSON.stringify(
        makePayload({
          eventId: 'evt-old',
          creationDate: tenMinutesAgo,
        }),
      );
      const sig = signPayload(body);

      const response = await app.inject({
        method: 'POST',
        url: '/webhooks/zitadel',
        headers: {
          'content-type': 'application/json',
          'x-zitadel-signature': sig,
        },
        payload: body,
      });
      expect(response.statusCode).toBe(400);
      expect(response.json().error).toBe('event_too_old');
    });

    it('rejects event with timestamp in the future', async () => {
      const fiveMinutesAhead = new Date(
        Date.now() + 5 * 60 * 1000,
      ).toISOString();
      const body = JSON.stringify(
        makePayload({
          eventId: 'evt-future',
          creationDate: fiveMinutesAhead,
        }),
      );
      const sig = signPayload(body);

      const response = await app.inject({
        method: 'POST',
        url: '/webhooks/zitadel',
        headers: {
          'content-type': 'application/json',
          'x-zitadel-signature': sig,
        },
        payload: body,
      });
      expect(response.statusCode).toBe(400);
      expect(response.json().error).toBe('event_from_future');
    });

    it('accepts fresh event (30s ago)', async () => {
      const thirtySecondsAgo = new Date(Date.now() - 30 * 1000).toISOString();
      const body = JSON.stringify(
        makePayload({
          eventId: 'evt-fresh',
          creationDate: thirtySecondsAgo,
        }),
      );
      const sig = signPayload(body);

      const response = await app.inject({
        method: 'POST',
        url: '/webhooks/zitadel',
        headers: {
          'content-type': 'application/json',
          'x-zitadel-signature': sig,
        },
        payload: body,
      });
      expect(response.statusCode).toBe(200);
      expect(response.json().status).toBe('processed');
    });
  });

  // === Rate limiting tests ===

  describe('webhook rate limiting', () => {
    it('returns 429 when rate limit exceeded', async () => {
      // Simulate over-limit: count = 101, ttl = 30000ms
      mockRedisEval.mockResolvedValueOnce([101, 30000]);

      const body = JSON.stringify(makePayload({ eventId: 'evt-rate-limited' }));
      const sig = signPayload(body);

      const response = await app.inject({
        method: 'POST',
        url: '/webhooks/zitadel',
        headers: {
          'content-type': 'application/json',
          'x-zitadel-signature': sig,
        },
        payload: body,
      });
      expect(response.statusCode).toBe(429);
      expect(response.json().error).toBe('rate_limit_exceeded');
      expect(response.headers['retry-after']).toBeDefined();
    });

    it('allows request when under rate limit', async () => {
      mockRedisEval.mockResolvedValueOnce([5, 60000]);

      const body = JSON.stringify(makePayload({ eventId: 'evt-under-limit' }));
      const sig = signPayload(body);

      const response = await app.inject({
        method: 'POST',
        url: '/webhooks/zitadel',
        headers: {
          'content-type': 'application/json',
          'x-zitadel-signature': sig,
        },
        payload: body,
      });
      expect(response.statusCode).toBe(200);
    });

    it('allows request when Redis errors (graceful degradation)', async () => {
      mockRedisEval.mockRejectedValueOnce(new Error('Redis connection failed'));

      const body = JSON.stringify(makePayload({ eventId: 'evt-redis-err' }));
      const sig = signPayload(body);

      const response = await app.inject({
        method: 'POST',
        url: '/webhooks/zitadel',
        headers: {
          'content-type': 'application/json',
          'x-zitadel-signature': sig,
        },
        payload: body,
      });
      expect(response.statusCode).toBe(200);
      expect(response.json().status).toBe('processed');
    });
  });

  // === Out-of-order event guard tests ===

  describe('out-of-order event guard', () => {
    it('skips stale upsert when setWhere rejects (rowCount: 0)', async () => {
      // Upsert returns rowCount: 0 (setWhere rejected the stale update)
      const onConflictDoUpdate = vi.fn().mockResolvedValue({ rowCount: 0 });
      const values = vi.fn(() => ({ onConflictDoUpdate }));
      mockTxInsert.mockImplementation(() => ({ values }));

      const body = JSON.stringify(makePayload({ eventId: 'evt-stale-upsert' }));
      const sig = signPayload(body);

      const response = await app.inject({
        method: 'POST',
        url: '/webhooks/zitadel',
        headers: {
          'content-type': 'application/json',
          'x-zitadel-signature': sig,
        },
        payload: body,
      });
      expect(response.statusCode).toBe(200);
      expect(response.json().status).toBe('processed');
      // No audit should be logged for stale upsert
      expect(mockAuditLog).not.toHaveBeenCalled();
    });

    it('applies fresh upsert normally', async () => {
      const onConflictDoUpdate = vi.fn().mockResolvedValue({ rowCount: 1 });
      const values = vi.fn(() => ({ onConflictDoUpdate }));
      mockTxInsert.mockImplementation(() => ({ values }));

      const body = JSON.stringify(makePayload({ eventId: 'evt-fresh-upsert' }));
      const sig = signPayload(body);

      const response = await app.inject({
        method: 'POST',
        url: '/webhooks/zitadel',
        headers: {
          'content-type': 'application/json',
          'x-zitadel-signature': sig,
        },
        payload: body,
      });
      expect(response.statusCode).toBe(200);
      expect(response.json().status).toBe('processed');
      expect(mockAuditLog).toHaveBeenCalledOnce();
    });

    it('skips stale update-only event when user exists', async () => {
      // update returns rowCount: 0 (ordering condition rejected)
      const where = vi.fn().mockResolvedValue({ rowCount: 0 });
      const set = vi.fn(() => ({ where }));
      mockTxUpdate.mockImplementation(() => ({ set }));

      // select finds the user (exists check)
      const limit = vi.fn().mockResolvedValue([{ id: 'existing-user-id' }]);
      const selectWhere = vi.fn(() => ({ limit }));
      const selectFrom = vi.fn(() => ({ where: selectWhere }));
      mockTxSelect.mockImplementation(() => ({ from: selectFrom }));

      const body = JSON.stringify(
        makePayload({
          eventType: 'user.deactivated',
          eventId: 'evt-stale-update',
        }),
      );
      const sig = signPayload(body);

      const response = await app.inject({
        method: 'POST',
        url: '/webhooks/zitadel',
        headers: {
          'content-type': 'application/json',
          'x-zitadel-signature': sig,
        },
        payload: body,
      });
      expect(response.statusCode).toBe(200);
      expect(response.json().status).toBe('processed');
      // Select should have been called for existence check
      expect(mockTxSelect).toHaveBeenCalled();
    });

    it('processes event with invalid creationDate without crash', async () => {
      const body = JSON.stringify(
        makePayload({
          eventId: 'evt-bad-date',
          creationDate: 'not-a-date',
        }),
      );
      const sig = signPayload(body);

      const response = await app.inject({
        method: 'POST',
        url: '/webhooks/zitadel',
        headers: {
          'content-type': 'application/json',
          'x-zitadel-signature': sig,
        },
        payload: body,
      });
      // Unparseable creationDate falls through freshness check and processing
      expect(response.statusCode).toBe(200);
      expect(response.json().status).toBe('processed');
    });
  });
});
