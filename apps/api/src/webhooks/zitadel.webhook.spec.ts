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
  mockAuditLog,
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
  const mockAuditLog = vi.fn().mockResolvedValue(undefined);

  return {
    mockPoolConnect,
    mockClientQuery,
    mockClientRelease,
    mockTxInsert,
    mockTxUpdate,
    mockAuditLog,
  };
});

vi.mock('@colophony/db', () => {
  return {
    eq: vi.fn((_col: unknown, val: unknown) => val),
    pool: {
      connect: mockPoolConnect,
      query: vi.fn().mockResolvedValue({ rows: [{ '?column?': 1 }] }),
    },
    users: { zitadelUserId: 'zitadel_user_id' },
    zitadelWebhookEvents: {},
  };
});

// Mock drizzle constructor to return a tx with insert/update
vi.mock('drizzle-orm/node-postgres', () => ({
  drizzle: vi.fn(() => ({
    insert: mockTxInsert,
    update: mockTxUpdate,
  })),
}));

vi.mock('../services/audit.service.js', () => ({
  auditService: { log: mockAuditLog },
}));

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
  ZITADEL_WEBHOOK_SECRET: WEBHOOK_SECRET,
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
    mockAuditLog.mockClear().mockResolvedValue(undefined);

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
});
