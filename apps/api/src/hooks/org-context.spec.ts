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

const { mockFindOrg, mockFindMember } = vi.hoisted(() => {
  const mockFindOrg = vi.fn();
  const mockFindMember = vi.fn();
  return { mockFindOrg, mockFindMember };
});

vi.mock('@colophony/db', () => ({
  db: {
    query: {
      users: { findFirst: vi.fn() },
      organizations: { findFirst: mockFindOrg },
      organizationMembers: { findFirst: mockFindMember },
    },
  },
  eq: vi.fn((_col: unknown, val: unknown) => val),
  and: vi.fn((...args: unknown[]) => args),
  users: { zitadelUserId: 'zitadel_user_id' },
  organizations: { id: 'id' },
  organizationMembers: { organizationId: 'organization_id', userId: 'user_id' },
  pool: {
    query: vi.fn().mockResolvedValue({ rows: [{ '?column?': 1 }] }),
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
    mockFindOrg.mockReset();
    mockFindMember.mockReset();
  });

  it('skips when no auth context', async () => {
    const response = await app.inject({ method: 'GET', url: '/test' });
    expect(response.statusCode).toBe(200);
    expect(response.json().authContext).toBeNull();
    expect(mockFindOrg).not.toHaveBeenCalled();
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
    mockFindOrg.mockResolvedValueOnce(undefined);

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
    mockFindOrg.mockResolvedValueOnce({ id: VALID_ORG_ID, name: 'Test Org' });
    mockFindMember.mockResolvedValueOnce(undefined);

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
    mockFindOrg.mockResolvedValueOnce({ id: VALID_ORG_ID, name: 'Test Org' });
    mockFindMember.mockResolvedValueOnce({
      id: 'member-1',
      organizationId: VALID_ORG_ID,
      userId: 'user-1',
      role: 'EDITOR',
    });

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
  });
});
