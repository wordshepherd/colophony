import { describe, it, expect, vi, beforeEach } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';
import type { Env } from '../config/env.js';

const { mockClientQuery, mockClientRelease, mockPoolConnect, mockAuditLog } =
  vi.hoisted(() => {
    const mockClientQuery = vi.fn().mockResolvedValue({ rows: [] });
    const mockClientRelease = vi.fn();
    const mockPoolConnect = vi.fn().mockResolvedValue({
      query: mockClientQuery,
      release: mockClientRelease,
    });
    const mockAuditLog = vi.fn().mockResolvedValue(undefined);
    return {
      mockClientQuery,
      mockClientRelease,
      mockPoolConnect,
      mockAuditLog,
    };
  });

vi.mock('@colophony/db', () => ({
  db: {
    query: {
      users: { findFirst: vi.fn() },
      organizations: { findFirst: vi.fn() },
      organizationMembers: { findFirst: vi.fn() },
    },
  },
  eq: vi.fn((_col: unknown, val: unknown) => val),
  and: vi.fn((...args: unknown[]) => args),
  users: { zitadelUserId: 'zitadel_user_id' },
  organizations: { id: 'id' },
  organizationMembers: {
    organizationId: 'organization_id',
    userId: 'user_id',
  },
  auditEvents: { _: 'audit_events_table_ref' },
  pool: {
    connect: mockPoolConnect,
    query: vi.fn().mockResolvedValue({ rows: [{ '?column?': 1 }] }),
  },
  DrizzleDb: {},
}));

vi.mock('@colophony/auth-client', () => ({
  createJwksVerifier: vi.fn(),
}));

vi.mock('drizzle-orm/node-postgres', () => ({
  drizzle: vi.fn(() => ({ __mock: true })),
}));

vi.mock('../services/audit.service.js', () => ({
  auditService: { log: mockAuditLog },
}));

import authPlugin from './auth.js';
import orgContextPlugin from './org-context.js';
import dbContextPlugin from './db-context.js';
import auditPlugin from './audit.js';

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
  CLAMAV_HOST: 'localhost',
  CLAMAV_PORT: 3310,
  VIRUS_SCAN_ENABLED: true,
};

describe('audit plugin', () => {
  beforeEach(() => {
    mockClientQuery.mockClear();
    mockClientRelease.mockClear();
    mockPoolConnect.mockClear();
    mockAuditLog.mockClear().mockResolvedValue(undefined);
    mockPoolConnect.mockResolvedValue({
      query: mockClientQuery,
      release: mockClientRelease,
    });
  });

  async function buildApp(): Promise<FastifyInstance> {
    const app = Fastify({ logger: false });
    await app.register(authPlugin, { env: testEnv });
    await app.register(orgContextPlugin);
    await app.register(dbContextPlugin);
    await app.register(auditPlugin);
    return app;
  }

  it('provides request.audit on unauthenticated requests (no-op)', async () => {
    const app = await buildApp();
    app.get('/test', async (request) => {
      await request.audit({
        resource: 'user',
        action: 'USER_CREATED',
      });
      return { ok: true };
    });

    const response = await app.inject({ method: 'GET', url: '/test' });
    expect(response.statusCode).toBe(200);
    // No dbTx → no-op, auditService.log should NOT be called
    expect(mockAuditLog).not.toHaveBeenCalled();
    await app.close();
  });

  it('calls auditService.log with correct context for authenticated requests', async () => {
    const app = await buildApp();
    app.get('/test', async (request) => {
      await request.audit({
        resource: 'user',
        action: 'USER_CREATED',
        resourceId: 'res-1',
        newValue: { email: 'test@example.com' },
      });
      return { ok: true };
    });

    const response = await app.inject({
      method: 'GET',
      url: '/test',
      headers: {
        'x-test-user-id': 'user-42',
        'user-agent': 'TestAgent/1.0',
      },
    });
    expect(response.statusCode).toBe(200);
    expect(mockAuditLog).toHaveBeenCalledOnce();

    const [tx, params] = mockAuditLog.mock.calls[0];
    expect(tx).toBeDefined();
    expect(params.action).toBe('USER_CREATED');
    expect(params.resource).toBe('user');
    expect(params.resourceId).toBe('res-1');
    expect(params.actorId).toBe('user-42');
    expect(params.ipAddress).toBe('127.0.0.1');
    expect(params.userAgent).toBe('TestAgent/1.0');
    expect(params.newValue).toEqual({ email: 'test@example.com' });
    await app.close();
  });

  it('propagates errors from auditService.log', async () => {
    mockAuditLog.mockRejectedValue(new Error('Audit write failed'));

    const app = await buildApp();
    app.get('/test', async (request) => {
      await request.audit({
        resource: 'user',
        action: 'USER_CREATED',
      });
      return { ok: true };
    });

    const response = await app.inject({
      method: 'GET',
      url: '/test',
      headers: { 'x-test-user-id': 'user-42' },
    });
    // Error propagates through the route handler → 500
    expect(response.statusCode).toBe(500);
    await app.close();
  });
});
