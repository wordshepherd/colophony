import { describe, it, expect, afterEach, vi, beforeEach } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';
import RedisMock from 'ioredis-mock';
import type { AuthContext } from '@colophony/types';
import type { Env } from '../config/env.js';

// Mock @colophony/db
vi.mock('@colophony/db', () => ({
  db: {
    query: {
      users: { findFirst: vi.fn() },
      organizations: { findFirst: vi.fn() },
      organizationMembers: { findFirst: vi.fn() },
    },
  },
  eq: vi.fn((_col: unknown, val: unknown) => val),
  users: { zitadelUserId: 'zitadel_user_id' },
  organizations: { id: 'id' },
  organizationMembers: {
    organizationId: 'organization_id',
    userId: 'user_id',
  },
  pool: {
    query: vi.fn().mockResolvedValue({ rows: [{ '?column?': 1 }] }),
  },
}));

// Mock @colophony/auth-client
vi.mock('@colophony/auth-client', () => ({
  createJwksVerifier: vi.fn(),
}));

import fp from 'fastify-plugin';
import rateLimitPlugin from './rate-limit.js';
import rateLimitAuthPlugin from './rate-limit-auth.js';

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
          email:
            (request.headers['x-test-email'] as string) ?? 'test@example.com',
          emailVerified: true,
          authMethod: 'test',
        } satisfies AuthContext;
      }
    });
  },
  { name: 'colophony-auth', fastify: '5.x' },
);

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
  RATE_LIMIT_DEFAULT_MAX: 5,
  RATE_LIMIT_AUTH_MAX: 10,
  RATE_LIMIT_WINDOW_SECONDS: 60,
  RATE_LIMIT_KEY_PREFIX: 'test:rl',
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
};

async function buildApp(
  envOverrides: Partial<Env> = {},
): Promise<{ app: FastifyInstance; redis: InstanceType<typeof RedisMock> }> {
  const app = Fastify({ logger: false });
  const redis = new RedisMock();
  await redis.flushall();
  const env = { ...testEnv, ...envOverrides };

  // Register both rate limit plugins with auth in between (mirrors main.ts order)
  await app.register(rateLimitPlugin, { env, redis: redis as never });
  await app.register(fakeAuthPlugin);
  await app.register(rateLimitAuthPlugin, { env });

  // Test route
  app.get('/api/test', async (request) => ({
    authContext: request.authContext,
  }));

  return { app, redis };
}

describe('rate-limit-auth plugin (second-pass)', () => {
  describe('authenticated user headers', () => {
    let app: FastifyInstance;
    let redis: InstanceType<typeof RedisMock>;

    beforeEach(async () => {
      const result = await buildApp();
      app = result.app;
      redis = result.redis;
    });

    afterEach(async () => {
      await app.close();
      await redis.flushall();
    });

    it('overrides headers with AUTH_MAX for authenticated requests', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/test',
        headers: {
          'x-test-user-id': 'user-123',
          'x-test-email': 'test@example.com',
        },
      });
      expect(response.statusCode).toBe(200);
      // Second-pass should override with AUTH_MAX
      expect(Number(response.headers['x-ratelimit-limit'])).toBe(
        testEnv.RATE_LIMIT_AUTH_MAX,
      );
    });

    it('keeps DEFAULT_MAX headers for unauthenticated requests', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/test',
      });
      expect(response.statusCode).toBe(200);
      // No auth → second-pass skips → first-pass headers remain
      expect(Number(response.headers['x-ratelimit-limit'])).toBe(
        testEnv.RATE_LIMIT_DEFAULT_MAX,
      );
    });
  });

  describe('authenticated rate limit enforcement', () => {
    let app: FastifyInstance;
    let redis: InstanceType<typeof RedisMock>;

    beforeEach(async () => {
      const result = await buildApp({
        RATE_LIMIT_DEFAULT_MAX: 20, // High IP limit so first-pass doesn't block
        RATE_LIMIT_AUTH_MAX: 3,
      });
      app = result.app;
      redis = result.redis;
    });

    afterEach(async () => {
      await app.close();
      await redis.flushall();
    });

    it('returns 429 when auth limit exceeded', async () => {
      const authHeaders = {
        'x-test-user-id': 'user-rate-test',
        'x-test-email': 'test@example.com',
      };

      // Make 3 allowed authenticated requests
      for (let i = 0; i < 3; i++) {
        const response = await app.inject({
          method: 'GET',
          url: '/api/test',
          headers: authHeaders,
        });
        expect(response.statusCode).toBe(200);
      }

      // 4th request should be rate limited
      const response = await app.inject({
        method: 'GET',
        url: '/api/test',
        headers: authHeaders,
      });
      expect(response.statusCode).toBe(429);
      expect(response.json().error).toBe('rate_limit_exceeded');
    });

    it('different users have independent limits', async () => {
      // Exhaust user-1 limit
      for (let i = 0; i < 3; i++) {
        await app.inject({
          method: 'GET',
          url: '/api/test',
          headers: { 'x-test-user-id': 'user-1' },
        });
      }
      const blocked = await app.inject({
        method: 'GET',
        url: '/api/test',
        headers: { 'x-test-user-id': 'user-1' },
      });
      expect(blocked.statusCode).toBe(429);

      // user-2 should still have capacity
      const response = await app.inject({
        method: 'GET',
        url: '/api/test',
        headers: { 'x-test-user-id': 'user-2' },
      });
      expect(response.statusCode).toBe(200);
    });
  });

  describe('two-tier interaction', () => {
    let app: FastifyInstance;
    let redis: InstanceType<typeof RedisMock>;

    beforeEach(async () => {
      const result = await buildApp({
        RATE_LIMIT_DEFAULT_MAX: 2, // Low IP limit
        RATE_LIMIT_AUTH_MAX: 10, // High user limit
      });
      app = result.app;
      redis = result.redis;
    });

    afterEach(async () => {
      await app.close();
      await redis.flushall();
    });

    it('IP limit blocks before auth limit is reached', async () => {
      const authHeaders = {
        'x-test-user-id': 'user-1',
        'x-test-email': 'test@example.com',
      };

      // First 2 requests succeed (within IP limit of 2)
      for (let i = 0; i < 2; i++) {
        const response = await app.inject({
          method: 'GET',
          url: '/api/test',
          headers: authHeaders,
        });
        expect(response.statusCode).toBe(200);
      }

      // 3rd request blocked by IP limit (first-pass), even though user limit is 10
      const response = await app.inject({
        method: 'GET',
        url: '/api/test',
        headers: authHeaders,
      });
      expect(response.statusCode).toBe(429);
    });
  });

  describe('graceful degradation', () => {
    it('allows authenticated request when Redis throws on second-pass', async () => {
      const app = Fastify({ logger: false });
      const redis = new RedisMock();
      await redis.flushall();

      await app.register(rateLimitPlugin, {
        env: testEnv,
        redis: redis as never,
      });
      await app.register(fakeAuthPlugin);
      await app.register(rateLimitAuthPlugin, { env: testEnv });

      app.get('/api/test', async () => ({ ok: true }));

      // Spy on eval and make it succeed on first call (first-pass), fail on second (second-pass)
      let callCount = 0;
      vi.spyOn(redis, 'eval').mockImplementation(async () => {
        callCount++;
        if (callCount > 1) throw new Error('Redis down');
        return [1, 0]; // sliding window returns [count, oldestMs]
      });

      const response = await app.inject({
        method: 'GET',
        url: '/api/test',
        headers: { 'x-test-user-id': 'user-1' },
      });
      expect(response.statusCode).toBe(200);

      vi.restoreAllMocks();
      await app.close();
    });
  });

  describe('skip paths', () => {
    let app: FastifyInstance;
    let redis: InstanceType<typeof RedisMock>;

    beforeEach(async () => {
      const result = await buildApp({ RATE_LIMIT_AUTH_MAX: 1 });
      app = result.app;
      redis = result.redis;

      app.get('/health', async () => ({ status: 'ok' }));
    });

    afterEach(async () => {
      await app.close();
      await redis.flushall();
    });

    it('skips /health for second-pass', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/health',
        headers: { 'x-test-user-id': 'user-1' },
      });
      expect(response.statusCode).toBe(200);
      // No rate limit headers from second-pass since it's skipped
      // (first-pass also skips /health)
    });
  });

  describe('sliding window behavior (auth)', () => {
    it('stays blocked at half window (entries still within window)', async () => {
      const { app: testApp, redis: testRedis } = await buildApp({
        RATE_LIMIT_DEFAULT_MAX: 20, // High IP limit so first-pass doesn't block
        RATE_LIMIT_AUTH_MAX: 3,
      });

      const authHeaders = {
        'x-test-user-id': 'user-sw-1',
        'x-test-email': 'test@example.com',
      };

      // Send max requests
      for (let i = 0; i < 3; i++) {
        const r = await testApp.inject({
          method: 'GET',
          url: '/api/test',
          headers: authHeaders,
        });
        expect(r.statusCode).toBe(200);
      }

      // Advance clock by half window (30s) — entries still within 60s window
      vi.useFakeTimers();
      vi.setSystemTime(Date.now() + 30_000);

      const response = await testApp.inject({
        method: 'GET',
        url: '/api/test',
        headers: authHeaders,
      });
      expect(response.statusCode).toBe(429);

      vi.useRealTimers();
      await testApp.close();
      await testRedis.flushall();
    });

    it('allows requests after full window expires', async () => {
      const { app: testApp, redis: testRedis } = await buildApp({
        RATE_LIMIT_DEFAULT_MAX: 20,
        RATE_LIMIT_AUTH_MAX: 3,
        RATE_LIMIT_WINDOW_SECONDS: 1, // 1-second window for faster test
      });

      const authHeaders = {
        'x-test-user-id': 'user-sw-2',
        'x-test-email': 'test@example.com',
      };

      // Send max requests at t=0
      for (let i = 0; i < 3; i++) {
        const r = await testApp.inject({
          method: 'GET',
          url: '/api/test',
          headers: authHeaders,
        });
        expect(r.statusCode).toBe(200);
      }

      // Verify 4th is blocked
      const blocked = await testApp.inject({
        method: 'GET',
        url: '/api/test',
        headers: authHeaders,
      });
      expect(blocked.statusCode).toBe(429);

      // Advance past full window (1.1s > 1s window)
      vi.useFakeTimers();
      vi.setSystemTime(Date.now() + 1100);

      const response = await testApp.inject({
        method: 'GET',
        url: '/api/test',
        headers: authHeaders,
      });
      expect(response.statusCode).toBe(200);

      vi.useRealTimers();
      await testApp.close();
      await testRedis.flushall();
    });

    it('burst at boundary does not allow 2x rate (sliding window fix)', async () => {
      const { app: testApp, redis: testRedis } = await buildApp({
        RATE_LIMIT_DEFAULT_MAX: 20,
        RATE_LIMIT_AUTH_MAX: 3,
        RATE_LIMIT_WINDOW_SECONDS: 60,
      });

      const authHeaders = {
        'x-test-user-id': 'user-sw-3',
        'x-test-email': 'test@example.com',
      };

      // Send max requests at t=55s (simulate late-window burst)
      vi.useFakeTimers({ now: 55_000 });

      for (let i = 0; i < 3; i++) {
        const r = await testApp.inject({
          method: 'GET',
          url: '/api/test',
          headers: authHeaders,
        });
        expect(r.statusCode).toBe(200);
      }

      // Advance to t=61s — sliding window keeps entries from t=55s
      vi.setSystemTime(61_000);

      const response = await testApp.inject({
        method: 'GET',
        url: '/api/test',
        headers: authHeaders,
      });
      expect(response.statusCode).toBe(429);

      vi.useRealTimers();
      await testApp.close();
      await testRedis.flushall();
    });
  });
});
