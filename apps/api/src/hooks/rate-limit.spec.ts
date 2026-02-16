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
};

async function buildApp(
  envOverrides: Partial<Env> = {},
): Promise<{ app: FastifyInstance; redis: InstanceType<typeof RedisMock> }> {
  const app = Fastify({ logger: false });
  const redis = new RedisMock();
  await redis.flushall();
  const env = { ...testEnv, ...envOverrides };

  await app.register(fakeAuthPlugin);
  await app.register(rateLimitPlugin, { env, redis: redis as never });

  // Test route
  app.get('/api/test', async (request) => ({
    authContext: request.authContext,
  }));

  return { app, redis };
}

describe('rate-limit plugin', () => {
  describe('skip paths', () => {
    let app: FastifyInstance;
    let redis: InstanceType<typeof RedisMock>;

    beforeEach(async () => {
      const result = await buildApp();
      app = result.app;
      redis = result.redis;

      app.get('/health', async () => ({ status: 'ok' }));
      app.get('/ready', async () => ({ status: 'ready' }));
      app.get('/', async () => ({ name: 'API' }));
      app.get('/.well-known/openid-configuration', async () => ({}));
    });

    afterEach(async () => {
      await app.close();
      await redis.flushall();
    });

    it('skips /health', async () => {
      const response = await app.inject({ method: 'GET', url: '/health' });
      expect(response.statusCode).toBe(200);
      expect(response.headers['x-ratelimit-limit']).toBeUndefined();
    });

    it('skips /ready', async () => {
      const response = await app.inject({ method: 'GET', url: '/ready' });
      expect(response.statusCode).toBe(200);
      expect(response.headers['x-ratelimit-limit']).toBeUndefined();
    });

    it('skips / (root)', async () => {
      const response = await app.inject({ method: 'GET', url: '/' });
      expect(response.statusCode).toBe(200);
      expect(response.headers['x-ratelimit-limit']).toBeUndefined();
    });

    it('skips /.well-known/* paths', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/.well-known/openid-configuration',
      });
      expect(response.statusCode).toBe(200);
      expect(response.headers['x-ratelimit-limit']).toBeUndefined();
    });

    it('skips OPTIONS preflight', async () => {
      const response = await app.inject({
        method: 'OPTIONS',
        url: '/api/test',
      });
      expect(response.headers['x-ratelimit-limit']).toBeUndefined();
    });
  });

  describe('rate limit headers', () => {
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

    it('sets X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset on normal response', async () => {
      const response = await app.inject({ method: 'GET', url: '/api/test' });
      expect(response.statusCode).toBe(200);
      expect(response.headers['x-ratelimit-limit']).toBeDefined();
      expect(response.headers['x-ratelimit-remaining']).toBeDefined();
      expect(response.headers['x-ratelimit-reset']).toBeDefined();
    });

    it('uses DEFAULT_MAX limit when unauthenticated', async () => {
      const response = await app.inject({ method: 'GET', url: '/api/test' });
      expect(Number(response.headers['x-ratelimit-limit'])).toBe(
        testEnv.RATE_LIMIT_DEFAULT_MAX,
      );
    });

    it('uses AUTH_MAX limit when authenticated', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/test',
        headers: {
          'x-test-user-id': 'user-123',
          'x-test-email': 'test@example.com',
        },
      });
      expect(Number(response.headers['x-ratelimit-limit'])).toBe(
        testEnv.RATE_LIMIT_AUTH_MAX,
      );
    });
  });

  describe('rate limit enforcement', () => {
    let app: FastifyInstance;
    let redis: InstanceType<typeof RedisMock>;

    beforeEach(async () => {
      const result = await buildApp({ RATE_LIMIT_DEFAULT_MAX: 3 });
      app = result.app;
      redis = result.redis;
    });

    afterEach(async () => {
      await app.close();
      await redis.flushall();
    });

    it('returns 429 when limit exceeded', async () => {
      // Make 3 allowed requests
      for (let i = 0; i < 3; i++) {
        const response = await app.inject({
          method: 'GET',
          url: '/api/test',
        });
        expect(response.statusCode).toBe(200);
      }

      // 4th request should be rate limited
      const response = await app.inject({ method: 'GET', url: '/api/test' });
      expect(response.statusCode).toBe(429);
      const body = response.json();
      expect(body.error).toBe('rate_limit_exceeded');
      expect(body.message).toBe('Too many requests');
    });

    it('sets Retry-After and Cache-Control on 429', async () => {
      for (let i = 0; i < 3; i++) {
        await app.inject({ method: 'GET', url: '/api/test' });
      }

      const response = await app.inject({ method: 'GET', url: '/api/test' });
      expect(response.statusCode).toBe(429);
      expect(response.headers['retry-after']).toBeDefined();
      expect(Number(response.headers['retry-after'])).toBeGreaterThan(0);
      expect(response.headers['cache-control']).toBe('no-store');
    });

    it('X-RateLimit-Remaining is never negative on 429', async () => {
      for (let i = 0; i < 3; i++) {
        await app.inject({ method: 'GET', url: '/api/test' });
      }

      const response = await app.inject({ method: 'GET', url: '/api/test' });
      expect(response.statusCode).toBe(429);
      expect(Number(response.headers['x-ratelimit-remaining'])).toBe(0);
    });

    it('does not set Retry-After on normal response', async () => {
      const response = await app.inject({ method: 'GET', url: '/api/test' });
      expect(response.statusCode).toBe(200);
      expect(response.headers['retry-after']).toBeUndefined();
    });
  });

  describe('authenticated vs unauthenticated limits', () => {
    let app: FastifyInstance;
    let redis: InstanceType<typeof RedisMock>;

    beforeEach(async () => {
      const result = await buildApp({
        RATE_LIMIT_DEFAULT_MAX: 2,
        RATE_LIMIT_AUTH_MAX: 5,
      });
      app = result.app;
      redis = result.redis;
    });

    afterEach(async () => {
      await app.close();
      await redis.flushall();
    });

    it('allows more requests for authenticated users', async () => {
      // Exhaust unauthenticated limit (2)
      for (let i = 0; i < 2; i++) {
        const response = await app.inject({
          method: 'GET',
          url: '/api/test',
        });
        expect(response.statusCode).toBe(200);
      }
      const blockedResponse = await app.inject({
        method: 'GET',
        url: '/api/test',
      });
      expect(blockedResponse.statusCode).toBe(429);

      // Authenticated user should still have capacity (separate key)
      for (let i = 0; i < 5; i++) {
        const response = await app.inject({
          method: 'GET',
          url: '/api/test',
          headers: {
            'x-test-user-id': 'user-auth-1',
            'x-test-email': 'auth@example.com',
          },
        });
        expect(response.statusCode).toBe(200);
      }

      // 6th authenticated request should be rate limited
      const authBlocked = await app.inject({
        method: 'GET',
        url: '/api/test',
        headers: {
          'x-test-user-id': 'user-auth-1',
          'x-test-email': 'auth@example.com',
        },
      });
      expect(authBlocked.statusCode).toBe(429);
    });
  });

  describe('graceful degradation', () => {
    it('allows request when Redis throws', async () => {
      const app = Fastify({ logger: false });
      const redis = new RedisMock();
      await redis.flushall();

      await app.register(fakeAuthPlugin);
      await app.register(rateLimitPlugin, {
        env: testEnv,
        redis: redis as never,
      });

      app.get('/api/test', async () => ({ ok: true }));

      // Force Redis eval to throw
      vi.spyOn(redis, 'eval').mockRejectedValue(new Error('Redis down'));

      const response = await app.inject({ method: 'GET', url: '/api/test' });
      expect(response.statusCode).toBe(200);
      expect(response.headers['x-ratelimit-limit']).toBeUndefined();

      vi.restoreAllMocks();
      await app.close();
    });
  });

  describe('window behavior', () => {
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

    it('first request in window sets count to 1', async () => {
      const response = await app.inject({ method: 'GET', url: '/api/test' });
      expect(response.statusCode).toBe(200);
      expect(Number(response.headers['x-ratelimit-remaining'])).toBe(
        testEnv.RATE_LIMIT_DEFAULT_MAX - 1,
      );
    });

    it('remaining decrements with each request', async () => {
      const r1 = await app.inject({ method: 'GET', url: '/api/test' });
      const r2 = await app.inject({ method: 'GET', url: '/api/test' });

      expect(Number(r1.headers['x-ratelimit-remaining'])).toBe(
        testEnv.RATE_LIMIT_DEFAULT_MAX - 1,
      );
      expect(Number(r2.headers['x-ratelimit-remaining'])).toBe(
        testEnv.RATE_LIMIT_DEFAULT_MAX - 2,
      );
    });
  });
});
