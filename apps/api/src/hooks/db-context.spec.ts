import { describe, it, expect, vi, beforeEach } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';
import type { AuthContext } from '@colophony/types';

// vi.hoisted runs before vi.mock hoisting — safe to reference in factories
const { mockClientQuery, mockClientRelease, mockPoolConnect } = vi.hoisted(
  () => {
    const mockClientQuery = vi.fn().mockResolvedValue({ rows: [] });
    const mockClientRelease = vi.fn();
    const mockPoolConnect = vi.fn().mockResolvedValue({
      query: mockClientQuery,
      release: mockClientRelease,
    });
    return { mockClientQuery, mockClientRelease, mockPoolConnect };
  },
);

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
  organizationMembers: { organizationId: 'organization_id', userId: 'user_id' },
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

// Import after mocks
import fp from 'fastify-plugin';
import orgContextPlugin from './org-context.js';
import dbContextPlugin from './db-context.js';

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

describe('db-context plugin', () => {
  beforeEach(() => {
    mockClientQuery.mockClear();
    mockClientRelease.mockClear();
    mockPoolConnect.mockClear();
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
    return app;
  }

  it('skips transaction when no auth context', async () => {
    const app = await buildApp();
    app.get('/test', async (request) => ({
      hasDbTx: request.dbTx !== null,
    }));

    const response = await app.inject({ method: 'GET', url: '/test' });
    expect(response.statusCode).toBe(200);
    expect(response.json().hasDbTx).toBe(false);
    expect(mockPoolConnect).not.toHaveBeenCalled();
    await app.close();
  });

  it('acquires client and begins transaction for authenticated request', async () => {
    const app = await buildApp();
    app.get('/test', async (request) => ({
      hasDbTx: request.dbTx !== null,
    }));

    const response = await app.inject({
      method: 'GET',
      url: '/test',
      headers: { 'x-test-user-id': 'user-1' },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json().hasDbTx).toBe(true);

    const calls = mockClientQuery.mock.calls.map((c: unknown[]) => c[0]);
    expect(calls).toContain('BEGIN');
    expect(calls).toContainEqual('SELECT set_config($1, $2, true)');
    expect(calls).toContain('COMMIT');
    expect(mockClientRelease).toHaveBeenCalled();
    await app.close();
  });

  it('sets app.user_id via set_config', async () => {
    const app = await buildApp();
    app.get('/test', async (request) => ({
      hasDbTx: request.dbTx !== null,
    }));

    await app.inject({
      method: 'GET',
      url: '/test',
      headers: { 'x-test-user-id': 'user-42' },
    });

    const setConfigCalls = mockClientQuery.mock.calls.filter(
      (c: unknown[]) => c[0] === 'SELECT set_config($1, $2, true)',
    );
    const userIdCall = setConfigCalls.find(
      (c: unknown[]) => (c as [string, string[]])[1]?.[0] === 'app.user_id',
    );
    expect(userIdCall).toBeDefined();
    expect((userIdCall as [string, string[]])[1][1]).toBe('user-42');
    await app.close();
  });

  it('rolls back transaction on route error', async () => {
    const app = await buildApp();
    app.get('/test', async () => {
      throw new Error('route error');
    });

    const response = await app.inject({
      method: 'GET',
      url: '/test',
      headers: { 'x-test-user-id': 'user-1' },
    });
    expect(response.statusCode).toBe(500);

    const calls = mockClientQuery.mock.calls.map((c: unknown[]) => c[0]);
    expect(calls).toContain('BEGIN');
    expect(calls).toContain('ROLLBACK');
    expect(calls).not.toContain('COMMIT');
    expect(mockClientRelease).toHaveBeenCalled();
    await app.close();
  });
});
