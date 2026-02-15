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

    it('returns null authContext when no test headers', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/protected',
      });
      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.authContext).toBeNull();
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

    it('returns null authContext when no Authorization header', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/protected',
      });
      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.authContext).toBeNull();
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
});
