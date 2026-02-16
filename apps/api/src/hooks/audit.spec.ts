import { describe, it, expect, vi, beforeEach } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';
import type { AuthContext } from '@colophony/types';

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

import fp from 'fastify-plugin';
import orgContextPlugin from './org-context.js';
import dbContextPlugin from './db-context.js';
import auditPlugin from './audit.js';

/** Minimal auth stub — satisfies colophony-auth dependency without real auth logic. */
const fakeAuthPlugin = fp(
  async function fakeAuth(app: FastifyInstance) {
    app.decorateRequest('authContext', null);
    app.addHook('onRequest', async (request) => {
      const testUserId = request.headers['x-test-user-id'] as
        | string
        | undefined;
      if (testUserId) {
        request.authContext = {
          userId: testUserId,
          zitadelUserId: testUserId,
          email: 'test@example.com',
          emailVerified: true,
          authMethod: 'test',
        } satisfies AuthContext;
      }
    });
  },
  { name: 'colophony-auth', fastify: '5.x' },
);

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
    await app.register(fakeAuthPlugin);
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
