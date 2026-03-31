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

// Mock @colophony/db — use trampoline pattern to avoid hoisting issues
const mockReturning = vi.fn();
const mockOnConflict = vi.fn(() => ({ returning: mockReturning }));
const mockValues = vi.fn(() => ({ onConflictDoUpdate: mockOnConflict }));
const mockInsert = vi.fn(() => ({ values: mockValues }));
const mockUpdateReturning = vi.fn();
const mockUpdateWhere = vi.fn(() => ({ returning: mockUpdateReturning }));
const mockUpdateSet = vi.fn(() => ({ where: mockUpdateWhere }));
const mockUpdate = vi.fn(() => ({ set: mockUpdateSet }));

vi.mock('@colophony/db', () => ({
  db: {
    query: {
      users: {
        findFirst: vi.fn(),
      },
    },
    transaction: vi.fn((cb: (tx: unknown) => unknown) =>
      cb({
        insert: (...args: Parameters<typeof mockInsert>) => mockInsert(...args),
      }),
    ),
    update: (...args: Parameters<typeof mockUpdate>) => mockUpdate(...args),
  },
  eq: vi.fn((_col: unknown, val: unknown) => val),
  and: vi.fn((...conditions: unknown[]) => conditions),
  isNull: vi.fn((col: unknown) => col),
  sql: (...a: unknown[]) => a,
  users: {
    zitadelUserId: 'zitadel_user_id',
    email: 'email',
    isGuest: 'is_guest',
    deletedAt: 'deleted_at',
  },
  pool: {
    query: vi.fn().mockResolvedValue({ rows: [{ '?column?': 1 }] }),
  },
}));

// Mock audit service
const mockLogDirect = vi.fn().mockResolvedValue(undefined);
const mockAuditLog = vi.fn().mockResolvedValue(undefined);
vi.mock('../services/audit.service.js', () => ({
  auditService: {
    logDirect: function (...args: unknown[]) {
      return mockLogDirect(...args);
    },
    log: function (...args: unknown[]) {
      return mockAuditLog(...args);
    },
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
  DB_SSL: 'false' as const,
  DB_ADMIN_POOL_MAX: 5,
  DB_APP_POOL_MAX: 20,
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
  TUS_ENDPOINT: 'http://localhost:1080/files/',
  CLAMAV_HOST: 'localhost',
  CLAMAV_PORT: 3310,
  VIRUS_SCAN_ENABLED: true,
  DEV_AUTH_BYPASS: false,
  FEDERATION_ENABLED: false,
  FEDERATION_RATE_LIMIT_MAX: 60,
  FEDERATION_RATE_LIMIT_WINDOW_SECONDS: 60,
  INNGEST_DEV: false,
  EMAIL_PROVIDER: 'none' as const,
  SMTP_SECURE: false,
  SENTRY_ENVIRONMENT: 'test',
  SENTRY_TRACES_SAMPLE_RATE: 0,
  METRICS_ENABLED: false,
  STATUS_TOKEN_TTL_DAYS: 90,
  FEDERATION_RATE_LIMIT_FAIL_MODE: 'open' as const,
  WEBHOOK_HEALTH_ZITADEL_STALE_SECONDS: 3600,
  WEBHOOK_HEALTH_STRIPE_STALE_SECONDS: 86400,
  WEBHOOK_HEALTH_DOCUMENSO_STALE_SECONDS: 86400,
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

    it('allows /metrics without auth', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/metrics',
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

    beforeEach(() => {
      mockReturning.mockReset();
      mockAuditLog.mockReset().mockResolvedValue(undefined);
      mockUpdateReturning.mockReset();
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

    it('skips auth for /.well-known/did.json', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/.well-known/did.json',
      });
      // 404 because no route registered, but auth hook didn't block
      expect(response.statusCode).toBe(404);
    });

    it('skips auth for /users/alice/did.json', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/users/alice/did.json',
      });
      // 404 because no route registered, but auth hook didn't block
      expect(response.statusCode).toBe(404);
    });

    it('skips auth for /v1/public/* paths', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/v1/public/orgs/test-slug/response-time',
      });
      // 404 because no route registered, but auth hook didn't block
      expect(response.statusCode).toBe(404);
    });

    it('does not skip auth for /users/alice/profile', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/users/alice/profile',
      });
      expect(response.statusCode).toBe(401);
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

    it('skips auth for /v1/docs/ (trailing slash)', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/v1/docs/',
      });
      expect(response.statusCode).toBe(404);
    });

    it('skips auth for /v1/openapi.json/ (trailing slash)', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/v1/openapi.json/',
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

    it('JIT provisions user when not found in DB', async () => {
      mockVerifyToken.mockResolvedValueOnce({
        payload: {
          sub: 'zitadel-user-999',
          email: 'newuser@example.com',
          name: 'New User',
          email_verified: true,
        },
        header: { alg: 'RS256' },
      });

      const dbModule = await import('@colophony/db');
      // eslint-disable-next-line @typescript-eslint/unbound-method
      vi.mocked(dbModule.db.query.users.findFirst).mockResolvedValueOnce(
        undefined,
      );

      const jitUser = {
        id: 'jit-user-uuid',
        email: 'newuser@example.com',
        zitadelUserId: 'zitadel-user-999',
        displayName: 'New User',
        emailVerified: true,
        emailVerifiedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        isGuest: false,
        deletedAt: null,
        lastEventAt: null,
        migratedToDomain: null,
        migratedToDid: null,
        migratedAt: null,
      };
      mockReturning.mockResolvedValueOnce([jitUser]);

      const response = await app.inject({
        method: 'GET',
        url: '/protected',
        headers: { authorization: 'Bearer valid-token' },
      });
      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.authContext.userId).toBe('jit-user-uuid');
      expect(body.authContext.zitadelUserId).toBe('zitadel-user-999');
      expect(body.authContext.email).toBe('newuser@example.com');
      expect(mockAuditLog).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          action: 'USER_JIT_PROVISIONED',
          resource: 'user',
          resourceId: 'jit-user-uuid',
        }),
      );
    });

    it('JIT links to existing guest user on email conflict', async () => {
      mockVerifyToken.mockResolvedValueOnce({
        payload: {
          sub: 'zitadel-user-888',
          email: 'guest@example.com',
        },
        header: { alg: 'RS256' },
      });

      const dbModule = await import('@colophony/db');
      // eslint-disable-next-line @typescript-eslint/unbound-method
      vi.mocked(dbModule.db.query.users.findFirst).mockResolvedValueOnce(
        undefined,
      );

      // Simulate email uniqueness conflict from the transaction
      const conflictError = new Error('unique_violation') as Error & {
        code: string;
      };
      conflictError.code = '23505';
      // eslint-disable-next-line @typescript-eslint/unbound-method
      vi.mocked(dbModule.db.transaction).mockRejectedValueOnce(conflictError);

      const linkedUser = {
        id: 'guest-uuid',
        email: 'guest@example.com',
        zitadelUserId: 'zitadel-user-888',
        displayName: null,
        emailVerified: false,
        emailVerifiedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        isGuest: false,
        deletedAt: null,
        lastEventAt: null,
        migratedToDomain: null,
        migratedToDid: null,
        migratedAt: null,
      };
      mockUpdateReturning.mockResolvedValueOnce([linkedUser]);

      const response = await app.inject({
        method: 'GET',
        url: '/protected',
        headers: { authorization: 'Bearer valid-token' },
      });
      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.authContext.userId).toBe('guest-uuid');
      expect(body.authContext.zitadelUserId).toBe('zitadel-user-888');
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
        displayName: null,
        emailVerified: true,
        emailVerifiedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        isGuest: false,
        deletedAt: new Date(), // deactivated
        lastEventAt: null,
        migratedToDomain: null,
        migratedToDid: null,
        migratedAt: null,
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
        displayName: null,
        emailVerified: true,
        emailVerifiedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        isGuest: false,
        deletedAt: null,
        lastEventAt: null,
        migratedToDomain: null,
        migratedToDid: null,
        migratedAt: null,
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
      mockAuditLog.mockClear().mockResolvedValue(undefined);
      mockReturning.mockReset();
      mockUpdateReturning.mockReset();
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

    it('audits JIT provisioning as USER_JIT_PROVISIONED', async () => {
      mockVerifyToken.mockResolvedValueOnce({
        payload: { sub: 'zitadel-unknown-user', email: 'jit@example.com' },
        header: { alg: 'RS256' },
      });

      const dbModule = await import('@colophony/db');
      // eslint-disable-next-line @typescript-eslint/unbound-method
      vi.mocked(dbModule.db.query.users.findFirst).mockResolvedValueOnce(
        undefined,
      );

      mockReturning.mockResolvedValueOnce([
        {
          id: 'jit-audit-uuid',
          email: 'jit@example.com',
          zitadelUserId: 'zitadel-unknown-user',
          displayName: null,
          emailVerified: false,
          emailVerifiedAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          isGuest: false,
          deletedAt: null,
          lastEventAt: null,
          migratedToDomain: null,
          migratedToDid: null,
          migratedAt: null,
        },
      ]);

      await app.inject({
        method: 'GET',
        url: '/protected',
        headers: { authorization: 'Bearer valid-token' },
      });
      await flushPromises();

      expect(mockAuditLog).toHaveBeenCalledOnce();
      expect(mockAuditLog).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          action: 'USER_JIT_PROVISIONED',
          resource: 'user',
          resourceId: 'jit-audit-uuid',
          newValue: expect.objectContaining({
            zitadelUserId: 'zitadel-unknown-user',
            source: 'jit',
          }),
        }),
      );
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
        displayName: null,
        emailVerified: true,
        emailVerifiedAt: null,
        isGuest: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: new Date(),
        lastEventAt: null,
        migratedToDomain: null,
        migratedToDid: null,
        migratedAt: null,
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
      mockAuditLog.mockClear().mockResolvedValue(undefined);
      mockReturning.mockReset();
      mockUpdateReturning.mockReset();
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
        displayName: null,
        emailVerified: true,
        emailVerifiedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        isGuest: false,
        deletedAt: null,
        lastEventAt: null,
        migratedToDomain: null,
        migratedToDid: null,
        migratedAt: null,
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

    it('does not grow failureMap beyond 10,000 entries (fail-open for new IPs)', async () => {
      const app = Fastify({ logger: false, trustProxy: true });
      await app.register(authPlugin, {
        env: {
          ...baseEnv,
          NODE_ENV: 'development' as const,
          ZITADEL_AUTHORITY: 'http://localhost:8080',
          ZITADEL_CLIENT_ID: 'my-client',
          AUTH_FAILURE_THROTTLE_MAX: 100, // high enough that no IP gets throttled from a single failure
          AUTH_FAILURE_THROTTLE_WINDOW_SECONDS: 300,
        },
      });
      app.get('/protected', async (request) => ({
        authContext: request.authContext,
      }));

      // Warm up the map with 10,000 unique IPs (one failure each)
      for (let i = 0; i < 10_000; i++) {
        await app.inject({
          method: 'GET',
          url: '/protected',
          headers: {
            'x-forwarded-for': `10.${Math.floor(i / 65536) % 256}.${Math.floor(i / 256) % 256}.${i % 256}`,
          },
        });
      }

      // New IP beyond cap — should get 401 (not 429), meaning fail-open
      const response = await app.inject({
        method: 'GET',
        url: '/protected',
        headers: { 'x-forwarded-for': '192.168.1.1' },
      });
      expect(response.statusCode).toBe(401);

      await app.close();
    });

    it('still throttles existing IPs when map is at capacity', async () => {
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

      // Record an initial failure from a known IP
      await app.inject({
        method: 'GET',
        url: '/protected',
        headers: { 'x-forwarded-for': '10.0.0.1' },
      });
      await flushPromises();

      // Fill to 10k with other IPs
      for (let i = 1; i < 10_000; i++) {
        await app.inject({
          method: 'GET',
          url: '/protected',
          headers: {
            'x-forwarded-for': `10.${Math.floor(i / 65536) % 256}.${Math.floor(i / 256) % 256}.${i % 256}`,
          },
        });
      }

      // One more failure for known IP — should still increment (existing entry)
      await app.inject({
        method: 'GET',
        url: '/protected',
        headers: { 'x-forwarded-for': '10.0.0.1' },
      });
      await flushPromises();

      // Now known IP should be throttled (2 failures >= max of 2)
      const blocked = await app.inject({
        method: 'GET',
        url: '/protected',
        headers: { 'x-forwarded-for': '10.0.0.1' },
      });
      expect(blocked.statusCode).toBe(429);

      await app.close();
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
