import {
  describe,
  it,
  expect,
  beforeAll,
  beforeEach,
  afterAll,
  vi,
} from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';
import authPlugin from './auth.js';
import type { Env } from '../config/env.js';

// Mock @colophony/db
vi.mock('@colophony/db', () => ({
  db: {
    query: {
      users: {
        findFirst: vi.fn(),
      },
    },
  },
  eq: vi.fn((_col: unknown, val: unknown) => val),
  users: { zitadelUserId: 'zitadel_user_id' },
  pool: {
    query: vi.fn().mockResolvedValue({ rows: [{ '?column?': 1 }] }),
  },
}));

// Mock audit service
const mockLogDirect = vi.fn().mockResolvedValue(undefined);
vi.mock('../services/audit.service.js', () => ({
  auditService: {
    logDirect: (...args: unknown[]) => mockLogDirect(...args),
  },
}));

// Mock @colophony/auth-client
const mockVerifyToken = vi.fn();
vi.mock('@colophony/auth-client', () => ({
  createJwksVerifier: vi.fn(() => mockVerifyToken),
}));

// Mock api-key service
const mockVerifyKey = vi.fn();
const mockTouchLastUsed = vi.fn().mockResolvedValue(undefined);
vi.mock('../services/api-key.service.js', () => ({
  apiKeyService: {
    verifyKey: (...args: unknown[]) => mockVerifyKey(...args),
    touchLastUsed: (...args: unknown[]) => mockTouchLastUsed(...args),
  },
}));

const baseEnv: Env = {
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
};

describe('auth plugin', () => {
  describe('test mode (no ZITADEL_AUTHORITY)', () => {
    let app: FastifyInstance;

    beforeAll(async () => {
      app = Fastify({ logger: false });
      await app.register(authPlugin, {
        env: { ...baseEnv, NODE_ENV: 'test' as const },
      });

      // Add a protected test route
      app.get('/protected', async (request) => ({
        authContext: request.authContext,
      }));
    });

    afterAll(async () => {
      await app.close();
    });

    it('allows public routes without auth', async () => {
      const response = await app.inject({ method: 'GET', url: '/health' });
      expect(response.statusCode).toBe(404); // No route registered, but hook didn't block
    });

    it('allows test header injection in test mode', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/protected',
        headers: {
          'x-test-user-id': 'user-123',
          'x-test-email': 'test@example.com',
        },
      });
      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.authContext.userId).toBe('user-123');
      expect(body.authContext.email).toBe('test@example.com');
      expect(body.authContext.emailVerified).toBe(true);
    });

    it('returns 401 when no test headers on non-public route', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/protected',
      });
      expect(response.statusCode).toBe(401);
      expect(response.json().error).toBe('unauthorized');
    });

    it('allows /trpc/health without auth', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/trpc/health',
      });
      // 404 because no route registered, but auth hook didn't block
      expect(response.statusCode).toBe(404);
    });
  });

  describe('with ZITADEL_AUTHORITY', () => {
    let app: FastifyInstance;

    const envWithAuth: Env = {
      ...baseEnv,
      NODE_ENV: 'development' as const,
      ZITADEL_AUTHORITY: 'http://localhost:8080',
      ZITADEL_CLIENT_ID: 'my-client',
    };

    beforeAll(async () => {
      app = Fastify({ logger: false });
      await app.register(authPlugin, { env: envWithAuth });

      app.get('/protected', async (request) => ({
        authContext: request.authContext,
      }));
    });

    afterAll(async () => {
      await app.close();
    });

    it('skips auth for /health', async () => {
      const response = await app.inject({ method: 'GET', url: '/health' });
      // 404 because no route, but auth hook didn't block
      expect(response.statusCode).toBe(404);
    });

    it('skips auth for / (root)', async () => {
      const response = await app.inject({ method: 'GET', url: '/' });
      expect(response.statusCode).toBe(404);
    });

    it('skips auth for /webhooks/* paths', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/webhooks/zitadel',
      });
      expect(response.statusCode).toBe(404);
    });

    it('skips auth for /.well-known/* paths', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/.well-known/openid-configuration',
      });
      expect(response.statusCode).toBe(404);
    });

    it('skips auth for /trpc/health', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/trpc/health',
      });
      expect(response.statusCode).toBe(404);
    });

    it('skips auth for /v1/openapi.json', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/v1/openapi.json',
      });
      // 404 because no route registered in this test, but auth hook didn't block
      expect(response.statusCode).toBe(404);
    });

    it('skips auth for /v1/docs', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/v1/docs',
      });
      expect(response.statusCode).toBe(404);
    });

    it('returns 401 when no Authorization header', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/protected',
      });
      expect(response.statusCode).toBe(401);
      expect(response.json().error).toBe('unauthorized');
      expect(response.json().message).toBe('Missing Authorization header');
    });

    it('returns 401 for malformed Authorization header', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/protected',
        headers: { authorization: 'Basic dXNlcjpwYXNz' },
      });
      expect(response.statusCode).toBe(401);
      expect(response.json().error).toBe('unauthorized');
    });

    it('returns 401 for invalid token', async () => {
      mockVerifyToken.mockRejectedValueOnce(new Error('invalid signature'));

      const response = await app.inject({
        method: 'GET',
        url: '/protected',
        headers: { authorization: 'Bearer invalid-token' },
      });
      expect(response.statusCode).toBe(401);
      expect(response.json().error).toBe('token_invalid');
    });

    it('returns 401 for expired token', async () => {
      const expiredErr = new Error('"exp" claim timestamp check failed');
      expiredErr.name = 'JWTExpired';
      mockVerifyToken.mockRejectedValueOnce(expiredErr);

      const response = await app.inject({
        method: 'GET',
        url: '/protected',
        headers: { authorization: 'Bearer expired-token' },
      });
      expect(response.statusCode).toBe(401);
      expect(response.json().error).toBe('token_expired');
    });

    it('returns 403 when user not provisioned', async () => {
      mockVerifyToken.mockResolvedValueOnce({
        payload: { sub: 'zitadel-user-999' },
        header: { alg: 'RS256' },
      });

      const dbModule = await import('@colophony/db');
      // eslint-disable-next-line @typescript-eslint/unbound-method
      vi.mocked(dbModule.db.query.users.findFirst).mockResolvedValueOnce(
        undefined,
      );

      const response = await app.inject({
        method: 'GET',
        url: '/protected',
        headers: { authorization: 'Bearer valid-token' },
      });
      expect(response.statusCode).toBe(403);
      expect(response.json().error).toBe('user_not_provisioned');
    });

    it('returns 403 when user is deactivated', async () => {
      mockVerifyToken.mockResolvedValueOnce({
        payload: { sub: 'zitadel-user-1' },
        header: { alg: 'RS256' },
      });

      const dbModule = await import('@colophony/db');
      // eslint-disable-next-line @typescript-eslint/unbound-method
      vi.mocked(dbModule.db.query.users.findFirst).mockResolvedValueOnce({
        id: 'user-1',
        email: 'deleted@example.com',
        zitadelUserId: 'zitadel-user-1',
        emailVerified: true,
        emailVerifiedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: new Date(), // deactivated
        lastEventAt: null,
      });

      const response = await app.inject({
        method: 'GET',
        url: '/protected',
        headers: { authorization: 'Bearer valid-token' },
      });
      expect(response.statusCode).toBe(403);
      expect(response.json().error).toBe('user_deactivated');
    });

    it('populates authContext on valid token and active user', async () => {
      mockVerifyToken.mockResolvedValueOnce({
        payload: { sub: 'zitadel-user-1' },
        header: { alg: 'RS256' },
      });

      const dbModule = await import('@colophony/db');
      // eslint-disable-next-line @typescript-eslint/unbound-method
      vi.mocked(dbModule.db.query.users.findFirst).mockResolvedValueOnce({
        id: 'user-1',
        email: 'alice@example.com',
        zitadelUserId: 'zitadel-user-1',
        emailVerified: true,
        emailVerifiedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
        lastEventAt: null,
      });

      const response = await app.inject({
        method: 'GET',
        url: '/protected',
        headers: { authorization: 'Bearer valid-token' },
      });
      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.authContext.userId).toBe('user-1');
      expect(body.authContext.zitadelUserId).toBe('zitadel-user-1');
      expect(body.authContext.email).toBe('alice@example.com');
      expect(body.authContext.emailVerified).toBe(true);
    });
  });

  describe('DEV_AUTH_BYPASS', () => {
    it('allows unauthenticated requests when bypass is enabled in dev mode', async () => {
      const app = Fastify({ logger: false });
      await app.register(authPlugin, {
        env: {
          ...baseEnv,
          NODE_ENV: 'development' as const,
          DEV_AUTH_BYPASS: true,
        },
      });
      app.get('/protected', async (request) => ({
        authContext: request.authContext,
      }));

      const response = await app.inject({
        method: 'GET',
        url: '/protected',
      });
      expect(response.statusCode).toBe(200);
      expect(response.json().authContext).toBeNull();
      await app.close();
    });

    it('rejects unauthenticated requests when bypass is false in dev mode', async () => {
      const app = Fastify({ logger: false });
      await app.register(authPlugin, {
        env: {
          ...baseEnv,
          NODE_ENV: 'development' as const,
          DEV_AUTH_BYPASS: false,
        },
      });
      app.get('/protected', async (request) => ({
        authContext: request.authContext,
      }));

      const response = await app.inject({
        method: 'GET',
        url: '/protected',
      });
      expect(response.statusCode).toBe(401);
      expect(response.json().error).toBe('unauthorized');
      await app.close();
    });

    it('bypass is ignored when ZITADEL_AUTHORITY is set', async () => {
      const app = Fastify({ logger: false });
      await app.register(authPlugin, {
        env: {
          ...baseEnv,
          NODE_ENV: 'development' as const,
          DEV_AUTH_BYPASS: true,
          ZITADEL_AUTHORITY: 'http://localhost:8080',
          ZITADEL_CLIENT_ID: 'my-client',
        },
      });
      app.get('/protected', async (request) => ({
        authContext: request.authContext,
      }));

      const response = await app.inject({
        method: 'GET',
        url: '/protected',
      });
      // ZITADEL_AUTHORITY is set, so bypass doesn't apply — 401 for missing header
      expect(response.statusCode).toBe(401);
      await app.close();
    });
  });

  describe('production mode', () => {
    it('throws at registration if ZITADEL_AUTHORITY is missing', async () => {
      const app = Fastify({ logger: false });
      await expect(
        app.register(authPlugin, {
          env: { ...baseEnv, NODE_ENV: 'production' as const },
        }),
      ).rejects.toThrow('ZITADEL_AUTHORITY is required in production');
      await app.close();
    });
  });

  describe('auth failure auditing', () => {
    /** Flush microtasks so fire-and-forget audit writes complete. */
    const flushPromises = () => new Promise((r) => process.nextTick(r));

    let app: FastifyInstance;

    const envWithAuth: Env = {
      ...baseEnv,
      NODE_ENV: 'development' as const,
      ZITADEL_AUTHORITY: 'http://localhost:8080',
      ZITADEL_CLIENT_ID: 'my-client',
    };

    beforeAll(async () => {
      app = Fastify({ logger: false });
      await app.register(authPlugin, { env: envWithAuth });
      app.get('/protected', async (request) => ({
        authContext: request.authContext,
      }));
    });

    beforeEach(() => {
      mockLogDirect.mockClear().mockResolvedValue(undefined);
    });

    afterAll(async () => {
      await app.close();
    });

    it('audits malformed Authorization header as AUTH_TOKEN_INVALID', async () => {
      await app.inject({
        method: 'GET',
        url: '/protected',
        headers: { authorization: 'Basic dXNlcjpwYXNz' },
      });
      await flushPromises();

      expect(mockLogDirect).toHaveBeenCalledOnce();
      const params = mockLogDirect.mock.calls[0][0];
      expect(params.action).toBe('AUTH_TOKEN_INVALID');
      expect(params.resource).toBe('auth');
      expect(params.newValue).toEqual({ reason: 'invalid_header_format' });
      expect(params.actorId).toBeUndefined();
    });

    it('audits missing Authorization header as AUTH_TOKEN_INVALID', async () => {
      await app.inject({
        method: 'GET',
        url: '/protected',
      });
      await flushPromises();

      expect(mockLogDirect).toHaveBeenCalledOnce();
      const params = mockLogDirect.mock.calls[0][0];
      expect(params.action).toBe('AUTH_TOKEN_INVALID');
      expect(params.resource).toBe('auth');
      expect(params.newValue).toEqual({
        reason: 'missing_authorization_header',
      });
    });

    it('audits token validation failure as AUTH_TOKEN_INVALID', async () => {
      mockVerifyToken.mockRejectedValueOnce(new Error('invalid signature'));

      await app.inject({
        method: 'GET',
        url: '/protected',
        headers: { authorization: 'Bearer bad-token' },
      });
      await flushPromises();

      expect(mockLogDirect).toHaveBeenCalledOnce();
      const params = mockLogDirect.mock.calls[0][0];
      expect(params.action).toBe('AUTH_TOKEN_INVALID');
      expect(params.resource).toBe('auth');
      expect(params.newValue).toEqual({ reason: 'signature_failed' });
      expect(params.actorId).toBeUndefined();
    });

    it('audits expired token as AUTH_TOKEN_EXPIRED using error.name', async () => {
      const expiredErr = new Error('token expired');
      expiredErr.name = 'JWTExpired';
      mockVerifyToken.mockRejectedValueOnce(expiredErr);

      await app.inject({
        method: 'GET',
        url: '/protected',
        headers: { authorization: 'Bearer expired-token' },
      });
      await flushPromises();

      expect(mockLogDirect).toHaveBeenCalledOnce();
      const params = mockLogDirect.mock.calls[0][0];
      expect(params.action).toBe('AUTH_TOKEN_EXPIRED');
      expect(params.resource).toBe('auth');
      expect(params.newValue).toEqual({ reason: 'expired' });
      expect(params.actorId).toBeUndefined();
    });

    it('audits user not provisioned as AUTH_USER_NOT_PROVISIONED with zitadelUserId', async () => {
      mockVerifyToken.mockResolvedValueOnce({
        payload: { sub: 'zitadel-unknown-user' },
        header: { alg: 'RS256' },
      });

      const dbModule = await import('@colophony/db');
      // eslint-disable-next-line @typescript-eslint/unbound-method
      vi.mocked(dbModule.db.query.users.findFirst).mockResolvedValueOnce(
        undefined,
      );

      await app.inject({
        method: 'GET',
        url: '/protected',
        headers: { authorization: 'Bearer valid-token' },
      });
      await flushPromises();

      expect(mockLogDirect).toHaveBeenCalledOnce();
      const params = mockLogDirect.mock.calls[0][0];
      expect(params.action).toBe('AUTH_USER_NOT_PROVISIONED');
      expect(params.resource).toBe('auth');
      expect(params.newValue).toEqual({
        reason: 'not_provisioned',
        zitadelUserId: 'zitadel-unknown-user',
      });
      expect(params.actorId).toBeUndefined();
    });

    it('audits token missing sub claim as AUTH_TOKEN_INVALID', async () => {
      mockVerifyToken.mockResolvedValueOnce({
        payload: {},
        header: { alg: 'RS256' },
      });

      await app.inject({
        method: 'GET',
        url: '/protected',
        headers: { authorization: 'Bearer no-sub-token' },
      });
      await flushPromises();

      expect(mockLogDirect).toHaveBeenCalledOnce();
      const params = mockLogDirect.mock.calls[0][0];
      expect(params.action).toBe('AUTH_TOKEN_INVALID');
      expect(params.resource).toBe('auth');
      expect(params.newValue).toEqual({ reason: 'missing_sub_claim' });
      expect(params.actorId).toBeUndefined();
    });

    it('audits deactivated user as AUTH_USER_DEACTIVATED with actorId', async () => {
      mockVerifyToken.mockResolvedValueOnce({
        payload: { sub: 'zitadel-deactivated' },
        header: { alg: 'RS256' },
      });

      const dbModule = await import('@colophony/db');
      // eslint-disable-next-line @typescript-eslint/unbound-method
      vi.mocked(dbModule.db.query.users.findFirst).mockResolvedValueOnce({
        id: 'local-user-deactivated',
        email: 'deleted@example.com',
        zitadelUserId: 'zitadel-deactivated',
        emailVerified: true,
        emailVerifiedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: new Date(),
        lastEventAt: null,
      });

      await app.inject({
        method: 'GET',
        url: '/protected',
        headers: { authorization: 'Bearer valid-token' },
      });
      await flushPromises();

      expect(mockLogDirect).toHaveBeenCalledOnce();
      const params = mockLogDirect.mock.calls[0][0];
      expect(params.action).toBe('AUTH_USER_DEACTIVATED');
      expect(params.resource).toBe('auth');
      expect(params.newValue).toEqual({
        reason: 'deactivated',
        zitadelUserId: 'zitadel-deactivated',
      });
      expect(params.actorId).toBe('local-user-deactivated');
    });

    it('still returns correct error when audit service throws', async () => {
      mockLogDirect.mockRejectedValueOnce(new Error('DB unavailable'));

      const response = await app.inject({
        method: 'GET',
        url: '/protected',
        headers: { authorization: 'Basic dXNlcjpwYXNz' },
      });
      await flushPromises();

      expect(response.statusCode).toBe(401);
      expect(response.json().error).toBe('unauthorized');
    });

    it('never includes token or Authorization header in audit details', async () => {
      mockVerifyToken.mockRejectedValueOnce(new Error('invalid signature'));

      await app.inject({
        method: 'GET',
        url: '/protected',
        headers: { authorization: 'Bearer super-secret-token' },
      });
      await flushPromises();

      expect(mockLogDirect).toHaveBeenCalledOnce();
      const params = mockLogDirect.mock.calls[0][0];
      const serialized = JSON.stringify(params);
      expect(serialized).not.toContain('super-secret-token');
      expect(serialized).not.toContain('Bearer');
    });
  });

  describe('API key authentication', () => {
    const flushPromises = () => new Promise((r) => process.nextTick(r));

    let app: FastifyInstance;

    const envWithAuth: Env = {
      ...baseEnv,
      NODE_ENV: 'development' as const,
      ZITADEL_AUTHORITY: 'http://localhost:8080',
      ZITADEL_CLIENT_ID: 'my-client',
    };

    beforeAll(async () => {
      app = Fastify({ logger: false });
      await app.register(authPlugin, { env: envWithAuth });
      app.get('/protected', async (request) => ({
        authContext: request.authContext,
      }));
    });

    beforeEach(() => {
      mockVerifyKey.mockReset();
      mockTouchLastUsed.mockReset().mockResolvedValue(undefined);
      mockLogDirect.mockClear().mockResolvedValue(undefined);
    });

    afterAll(async () => {
      await app.close();
    });

    it('authenticates with valid X-Api-Key header', async () => {
      mockVerifyKey.mockResolvedValueOnce({
        apiKey: {
          id: 'key-1',
          organizationId: 'org-1',
          createdBy: 'user-1',
          name: 'Test Key',
          scopes: ['submissions:read'],
          expiresAt: null,
          revokedAt: null,
          lastUsedAt: null,
          createdAt: new Date(),
        },
        creator: {
          id: 'user-1',
          email: 'alice@example.com',
          emailVerified: true,
          deletedAt: null,
        },
      });

      const response = await app.inject({
        method: 'GET',
        url: '/protected',
        headers: { 'x-api-key': 'col_live_abcdef1234567890abcdef1234567890' },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.authContext.userId).toBe('user-1');
      expect(body.authContext.email).toBe('alice@example.com');
      expect(body.authContext.authMethod).toBe('apikey');
      expect(body.authContext.apiKeyId).toBe('key-1');
      expect(body.authContext.orgId).toBe('org-1');
    });

    it('sets authMethod to apikey', async () => {
      mockVerifyKey.mockResolvedValueOnce({
        apiKey: {
          id: 'key-1',
          organizationId: 'org-1',
          createdBy: 'user-1',
          name: 'Test Key',
          scopes: ['submissions:read'],
          expiresAt: null,
          revokedAt: null,
          lastUsedAt: null,
          createdAt: new Date(),
        },
        creator: {
          id: 'user-1',
          email: 'alice@example.com',
          emailVerified: true,
          deletedAt: null,
        },
      });

      const response = await app.inject({
        method: 'GET',
        url: '/protected',
        headers: { 'x-api-key': 'col_live_abcdef1234567890abcdef1234567890' },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().authContext.authMethod).toBe('apikey');
    });

    it('pre-sets orgId from API key', async () => {
      mockVerifyKey.mockResolvedValueOnce({
        apiKey: {
          id: 'key-1',
          organizationId: 'org-42',
          createdBy: 'user-1',
          name: 'Test Key',
          scopes: ['submissions:read'],
          expiresAt: null,
          revokedAt: null,
          lastUsedAt: null,
          createdAt: new Date(),
        },
        creator: {
          id: 'user-1',
          email: 'alice@example.com',
          emailVerified: true,
          deletedAt: null,
        },
      });

      const response = await app.inject({
        method: 'GET',
        url: '/protected',
        headers: { 'x-api-key': 'col_live_abcdef1234567890abcdef1234567890' },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().authContext.orgId).toBe('org-42');
    });

    it('rejects invalid API key', async () => {
      mockVerifyKey.mockResolvedValueOnce(null);

      const response = await app.inject({
        method: 'GET',
        url: '/protected',
        headers: { 'x-api-key': 'col_live_invalid' },
      });

      expect(response.statusCode).toBe(401);
      expect(response.json().message).toBe('Invalid API key');
    });

    it('rejects expired API key', async () => {
      mockVerifyKey.mockResolvedValueOnce({
        apiKey: {
          id: 'key-1',
          organizationId: 'org-1',
          createdBy: 'user-1',
          name: 'Test Key',
          scopes: ['submissions:read'],
          expiresAt: new Date('2020-01-01'), // expired
          revokedAt: null,
          lastUsedAt: null,
          createdAt: new Date(),
        },
        creator: {
          id: 'user-1',
          email: 'alice@example.com',
          emailVerified: true,
          deletedAt: null,
        },
      });

      const response = await app.inject({
        method: 'GET',
        url: '/protected',
        headers: { 'x-api-key': 'col_live_abcdef1234567890abcdef1234567890' },
      });

      expect(response.statusCode).toBe(401);
      expect(response.json().message).toBe('API key has expired');
    });

    it('rejects revoked API key', async () => {
      mockVerifyKey.mockResolvedValueOnce({
        apiKey: {
          id: 'key-1',
          organizationId: 'org-1',
          createdBy: 'user-1',
          name: 'Test Key',
          scopes: ['submissions:read'],
          expiresAt: null,
          revokedAt: new Date(), // revoked
          lastUsedAt: null,
          createdAt: new Date(),
        },
        creator: {
          id: 'user-1',
          email: 'alice@example.com',
          emailVerified: true,
          deletedAt: null,
        },
      });

      const response = await app.inject({
        method: 'GET',
        url: '/protected',
        headers: { 'x-api-key': 'col_live_abcdef1234567890abcdef1234567890' },
      });

      expect(response.statusCode).toBe(401);
      expect(response.json().message).toBe('API key has been revoked');
    });

    it('prefers Bearer token over X-Api-Key when both present', async () => {
      // When Authorization header is present, API key is not checked
      mockVerifyToken.mockResolvedValueOnce({
        payload: { sub: 'zitadel-user-1' },
        header: { alg: 'RS256' },
      });

      const dbModule = await import('@colophony/db');
      // eslint-disable-next-line @typescript-eslint/unbound-method
      vi.mocked(dbModule.db.query.users.findFirst).mockResolvedValueOnce({
        id: 'user-1',
        email: 'alice@example.com',
        zitadelUserId: 'zitadel-user-1',
        emailVerified: true,
        emailVerifiedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
        lastEventAt: null,
      });

      const response = await app.inject({
        method: 'GET',
        url: '/protected',
        headers: {
          authorization: 'Bearer valid-token',
          'x-api-key': 'col_live_abcdef1234567890abcdef1234567890',
        },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().authContext.authMethod).toBe('oidc');
      expect(mockVerifyKey).not.toHaveBeenCalled();
    });

    it('audits failed API key auth', async () => {
      mockVerifyKey.mockResolvedValueOnce(null);

      await app.inject({
        method: 'GET',
        url: '/protected',
        headers: { 'x-api-key': 'col_live_invalid_key_here' },
      });
      await flushPromises();

      expect(mockLogDirect).toHaveBeenCalledOnce();
      const params = mockLogDirect.mock.calls[0][0];
      expect(params.action).toBe('API_KEY_AUTH_FAILED');
    });

    it('updates lastUsedAt on successful auth', async () => {
      mockVerifyKey.mockResolvedValueOnce({
        apiKey: {
          id: 'key-1',
          organizationId: 'org-1',
          createdBy: 'user-1',
          name: 'Test Key',
          scopes: ['submissions:read'],
          expiresAt: null,
          revokedAt: null,
          lastUsedAt: null,
          createdAt: new Date(),
        },
        creator: {
          id: 'user-1',
          email: 'alice@example.com',
          emailVerified: true,
          deletedAt: null,
        },
      });

      await app.inject({
        method: 'GET',
        url: '/protected',
        headers: { 'x-api-key': 'col_live_abcdef1234567890abcdef1234567890' },
      });
      await flushPromises();

      expect(mockTouchLastUsed).toHaveBeenCalledWith('key-1');
    });
  });

  describe('per-IP auth failure throttle', () => {
    const flushPromises = () => new Promise((r) => process.nextTick(r));

    it('returns 429 after MAX failures from the same IP', async () => {
      const app = Fastify({ logger: false });
      await app.register(authPlugin, {
        env: {
          ...baseEnv,
          NODE_ENV: 'development' as const,
          ZITADEL_AUTHORITY: 'http://localhost:8080',
          ZITADEL_CLIENT_ID: 'my-client',
          AUTH_FAILURE_THROTTLE_MAX: 3,
          AUTH_FAILURE_THROTTLE_WINDOW_SECONDS: 300,
        },
      });
      app.get('/protected', async (request) => ({
        authContext: request.authContext,
      }));

      // Make 3 auth failures (missing header → each triggers logAuthFailure)
      for (let i = 0; i < 3; i++) {
        const response = await app.inject({
          method: 'GET',
          url: '/protected',
        });
        await flushPromises();
        expect(response.statusCode).toBe(401);
      }

      // 4th request should be throttled
      const response = await app.inject({
        method: 'GET',
        url: '/protected',
      });
      expect(response.statusCode).toBe(429);
      expect(response.json().error).toBe('too_many_auth_failures');

      await app.close();
    });

    it('allows requests from different IPs independently', async () => {
      const app = Fastify({ logger: false, trustProxy: true });
      await app.register(authPlugin, {
        env: {
          ...baseEnv,
          NODE_ENV: 'development' as const,
          ZITADEL_AUTHORITY: 'http://localhost:8080',
          ZITADEL_CLIENT_ID: 'my-client',
          AUTH_FAILURE_THROTTLE_MAX: 2,
          AUTH_FAILURE_THROTTLE_WINDOW_SECONDS: 300,
        },
      });
      app.get('/protected', async (request) => ({
        authContext: request.authContext,
      }));

      // Exhaust throttle for default IP (127.0.0.1)
      for (let i = 0; i < 2; i++) {
        await app.inject({ method: 'GET', url: '/protected' });
        await flushPromises();
      }
      const blocked = await app.inject({
        method: 'GET',
        url: '/protected',
      });
      expect(blocked.statusCode).toBe(429);

      // Different IP should still get 401 (not 429)
      const response = await app.inject({
        method: 'GET',
        url: '/protected',
        headers: { 'x-forwarded-for': '10.0.0.99' },
      });
      // Should be 401 not 429 — different IP
      expect(response.statusCode).toBe(401);

      await app.close();
    });

    it('resets after window expires', async () => {
      vi.useFakeTimers();
      try {
        const app = Fastify({ logger: false });
        await app.register(authPlugin, {
          env: {
            ...baseEnv,
            NODE_ENV: 'development' as const,
            ZITADEL_AUTHORITY: 'http://localhost:8080',
            ZITADEL_CLIENT_ID: 'my-client',
            AUTH_FAILURE_THROTTLE_MAX: 2,
            AUTH_FAILURE_THROTTLE_WINDOW_SECONDS: 60,
          },
        });
        app.get('/protected', async (request) => ({
          authContext: request.authContext,
        }));

        // Exhaust throttle
        for (let i = 0; i < 2; i++) {
          await app.inject({ method: 'GET', url: '/protected' });
          await flushPromises();
        }
        const blocked = await app.inject({
          method: 'GET',
          url: '/protected',
        });
        expect(blocked.statusCode).toBe(429);

        // Advance past window
        vi.advanceTimersByTime(61_000);

        // Should be allowed again (gets 401, not 429)
        const response = await app.inject({
          method: 'GET',
          url: '/protected',
        });
        expect(response.statusCode).toBe(401);

        await app.close();
      } finally {
        vi.useRealTimers();
      }
    });

    it('does not throttle public routes', async () => {
      const app = Fastify({ logger: false });
      await app.register(authPlugin, {
        env: {
          ...baseEnv,
          NODE_ENV: 'development' as const,
          ZITADEL_AUTHORITY: 'http://localhost:8080',
          ZITADEL_CLIENT_ID: 'my-client',
          AUTH_FAILURE_THROTTLE_MAX: 1,
          AUTH_FAILURE_THROTTLE_WINDOW_SECONDS: 300,
        },
      });
      app.get('/health', async () => ({ status: 'ok' }));
      app.get('/protected', async (request) => ({
        authContext: request.authContext,
      }));

      // Trigger throttle on protected route
      await app.inject({ method: 'GET', url: '/protected' });
      await flushPromises();
      const blocked = await app.inject({
        method: 'GET',
        url: '/protected',
      });
      expect(blocked.statusCode).toBe(429);

      // Public route should still work
      const healthResponse = await app.inject({
        method: 'GET',
        url: '/health',
      });
      expect(healthResponse.statusCode).toBe(200);

      await app.close();
    });
  });
});
