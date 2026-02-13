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

const { mockPoolQuery, mockClientQuery, mockClientRelease, mockPoolConnect } =
  vi.hoisted(() => {
    const mockPoolQuery = vi.fn();
    const mockClientQuery = vi.fn();
    const mockClientRelease = vi.fn();
    const mockPoolConnect = vi.fn();
    return {
      mockPoolQuery,
      mockClientQuery,
      mockClientRelease,
      mockPoolConnect,
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
  organizationMembers: { organizationId: 'organization_id', userId: 'user_id' },
  pool: {
    query: mockPoolQuery,
    connect: mockPoolConnect,
  },
}));

vi.mock('@colophony/auth-client', () => ({
  createJwksVerifier: vi.fn(),
}));

import authPlugin from './auth.js';
import orgContextPlugin from './org-context.js';

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
};

const VALID_ORG_ID = '11111111-1111-1111-a111-111111111111';

describe('org-context plugin', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = Fastify({ logger: false });
    await app.register(authPlugin, { env: testEnv });
    await app.register(orgContextPlugin);

    app.get('/test', async (request) => ({
      authContext: request.authContext,
    }));
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    mockPoolQuery.mockReset();
    mockPoolConnect.mockReset();
    mockClientQuery.mockReset();
    mockClientRelease.mockReset();

    // Default: pool.connect returns a mock client
    mockPoolConnect.mockResolvedValue({
      query: mockClientQuery,
      release: mockClientRelease,
    });
  });

  it('skips when no auth context', async () => {
    const response = await app.inject({ method: 'GET', url: '/test' });
    expect(response.statusCode).toBe(200);
    expect(response.json().authContext).toBeNull();
    expect(mockPoolQuery).not.toHaveBeenCalled();
  });

  it('skips when no X-Organization-Id header', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/test',
      headers: {
        'x-test-user-id': 'user-1',
      },
    });
    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.authContext.userId).toBe('user-1');
    expect(body.authContext.orgId).toBeUndefined();
  });

  it('returns 400 for invalid UUID format', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/test',
      headers: {
        'x-test-user-id': 'user-1',
        'x-organization-id': 'not-a-uuid',
      },
    });
    expect(response.statusCode).toBe(400);
    expect(response.json().error).toBe('invalid_org');
  });

  it('returns 400 when org not found', async () => {
    mockPoolQuery.mockResolvedValueOnce({ rows: [] });

    const response = await app.inject({
      method: 'GET',
      url: '/test',
      headers: {
        'x-test-user-id': 'user-1',
        'x-organization-id': VALID_ORG_ID,
      },
    });
    expect(response.statusCode).toBe(400);
    expect(response.json().error).toBe('invalid_org');
    expect(response.json().message).toBe('Organization not found');
  });

  it('returns 403 when user is not a member', async () => {
    // pool.query for org existence check
    mockPoolQuery.mockResolvedValueOnce({ rows: [{ id: VALID_ORG_ID }] });
    // client.query calls: BEGIN, set_config x2, membership query, COMMIT
    mockClientQuery
      .mockResolvedValueOnce({}) // BEGIN READ ONLY
      .mockResolvedValueOnce({}) // set_config app.current_org
      .mockResolvedValueOnce({}) // set_config app.user_id
      .mockResolvedValueOnce({ rows: [] }) // membership query — not found
      .mockResolvedValueOnce({}); // COMMIT

    const response = await app.inject({
      method: 'GET',
      url: '/test',
      headers: {
        'x-test-user-id': 'user-1',
        'x-organization-id': VALID_ORG_ID,
      },
    });
    expect(response.statusCode).toBe(403);
    expect(response.json().error).toBe('not_a_member');
  });

  it('enriches authContext with orgId and role on valid membership', async () => {
    // pool.query for org existence check
    mockPoolQuery.mockResolvedValueOnce({ rows: [{ id: VALID_ORG_ID }] });
    // client.query calls: BEGIN, set_config x2, membership query, COMMIT
    mockClientQuery
      .mockResolvedValueOnce({}) // BEGIN READ ONLY
      .mockResolvedValueOnce({}) // set_config app.current_org
      .mockResolvedValueOnce({}) // set_config app.user_id
      .mockResolvedValueOnce({ rows: [{ role: 'EDITOR' }] }) // membership found
      .mockResolvedValueOnce({}); // COMMIT

    const response = await app.inject({
      method: 'GET',
      url: '/test',
      headers: {
        'x-test-user-id': 'user-1',
        'x-organization-id': VALID_ORG_ID,
      },
    });
    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.authContext.orgId).toBe(VALID_ORG_ID);
    expect(body.authContext.role).toBe('EDITOR');
    expect(mockClientRelease).toHaveBeenCalled();
  });

  it('returns 500 when membership bootstrap DB query fails', async () => {
    // pool.query for org existence check — succeeds
    mockPoolQuery.mockResolvedValueOnce({ rows: [{ id: VALID_ORG_ID }] });
    // client.query: BEGIN succeeds, then set_config throws DB error
    mockClientQuery
      .mockResolvedValueOnce({}) // BEGIN READ ONLY
      .mockRejectedValueOnce(new Error('connection reset')); // set_config fails

    const response = await app.inject({
      method: 'GET',
      url: '/test',
      headers: {
        'x-test-user-id': 'user-1',
        'x-organization-id': VALID_ORG_ID,
      },
    });
    // DB errors should propagate as 500, not be masked as 403
    expect(response.statusCode).toBe(500);
    expect(mockClientRelease).toHaveBeenCalled();
  });
});
