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
  appPool: {
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

// `log` is mocked, but `principalFromAuthContext` is deliberately the real
// implementation — the principal-derivation tests below would assert nothing
// against a stub.
vi.mock('../services/audit.service.js', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('../services/audit.service.js')>();
  return {
    auditService: { log: mockAuditLog },
    principalFromAuthContext: actual.principalFromAuthContext,
  };
});

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
        string | undefined;
      if (testUserId) {
        // `x-test-api-key-id` and `x-test-auth-method` let a case stand in for
        // key auth (and for a credential whose authMethod is not 'apikey').
        const apiKeyId = request.headers['x-test-api-key-id'] as
          string | undefined;
        const authMethod = (request.headers['x-test-auth-method'] ??
          'test') as AuthContext['authMethod'];
        request.authContext = {
          userId: testUserId,
          zitadelUserId: testUserId,
          email: 'test@example.com',
          emailVerified: true,
          authMethod,
          ...(apiKeyId ? { apiKeyId } : {}),
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
    expect(params.requestId).toBeDefined();
    expect(params.method).toBe('GET');
    expect(params.route).toBe('/test');
    await app.close();
  });

  // -------------------------------------------------------------------------
  // Principal attribution — the acting credential, distinct from the actor
  // -------------------------------------------------------------------------

  /** Register a route that logs one audit event, then call it. */
  async function auditOnce(
    headers: Record<string, string>,
  ): Promise<Record<string, unknown>> {
    const app = await buildApp();
    app.get('/test', async (request) => {
      await request.audit({ resource: 'user', action: 'USER_CREATED' });
      return { ok: true };
    });
    const response = await app.inject({ method: 'GET', url: '/test', headers });
    expect(response.statusCode).toBe(200);
    expect(mockAuditLog).toHaveBeenCalledOnce();
    const params = mockAuditLog.mock.calls[0][1] as Record<string, unknown>;
    await app.close();
    return params;
  }

  it('records the acting credential when the request is authenticated by an API key', async () => {
    const params = await auditOnce({
      'x-test-user-id': 'creator-1',
      'x-test-api-key-id': 'key-abc',
      'x-test-auth-method': 'apikey',
    });

    // The whole point: the key and its creator are now distinguishable.
    expect(params.principalId).toBe('key-abc');
    expect(params.principalType).toBe('api_key');
    expect(params.actorId).toBe('creator-1');
  });

  it('records no principal when a user acts directly', async () => {
    const params = await auditOnce({ 'x-test-user-id': 'user-42' });

    expect(params.principalId).toBeUndefined();
    expect(params.principalType).toBeUndefined();
    expect(params.actorId).toBe('user-42');
  });

  /**
   * Pins the discriminator: presence of `apiKeyId`, never
   * `authMethod === 'apikey'`. An implementation keyed on `authMethod` passes
   * every other case here and fails only this one — which is the point. The
   * planned `col_svc_` service principal will carry a different `authMethod`
   * while still being a credential, and must not silently lose attribution.
   */
  it('records the principal from apiKeyId even when authMethod is not apikey', async () => {
    const params = await auditOnce({
      'x-test-user-id': 'creator-1',
      'x-test-api-key-id': 'key-xyz',
      'x-test-auth-method': 'test',
    });

    expect(params.principalId).toBe('key-xyz');
    expect(params.principalType).toBe('api_key');
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
