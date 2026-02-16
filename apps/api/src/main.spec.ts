import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { type FastifyInstance } from 'fastify';
import { buildApp } from './main.js';
import { type Env } from './config/env.js';

// Mock @colophony/db to avoid needing a real database for unit tests
vi.mock('@colophony/db', () => ({
  pool: {
    query: vi.fn().mockResolvedValue({ rows: [{ '?column?': 1 }] }),
    connect: vi.fn().mockResolvedValue({
      query: vi.fn().mockResolvedValue({ rows: [] }),
      release: vi.fn(),
    }),
  },
  db: {
    query: {
      users: { findFirst: vi.fn() },
      organizations: { findFirst: vi.fn() },
      organizationMembers: { findFirst: vi.fn() },
    },
    insert: vi.fn(() => ({
      values: vi.fn(() => ({
        onConflictDoUpdate: vi.fn().mockResolvedValue({ rowCount: 1 }),
      })),
    })),
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn().mockResolvedValue({ rowCount: 1 }),
      })),
    })),
  },
  eq: vi.fn(),
  and: vi.fn(),
  users: { zitadelUserId: 'zitadel_user_id' },
  organizations: { id: 'id' },
  organizationMembers: { organizationId: 'organization_id', userId: 'user_id' },
  zitadelWebhookEvents: {},
}));

vi.mock('@colophony/auth-client', () => ({
  createJwksVerifier: vi.fn(),
  verifyZitadelSignature: vi.fn(() => false),
}));

vi.mock('drizzle-orm/node-postgres', () => ({
  drizzle: vi.fn(() => ({ __mock: true })),
}));

// Mock ioredis so rate-limit plugin doesn't connect to real Redis
vi.mock('ioredis', () => {
  const RedisMock = vi.fn().mockImplementation(() => ({
    connect: vi.fn().mockResolvedValue(undefined),
    eval: vi.fn().mockResolvedValue([1, 60000]),
    quit: vi.fn().mockResolvedValue('OK'),
    status: 'ready',
  }));
  return { default: RedisMock };
});

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

describe('Fastify app', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp(testEnv);
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /health returns 200 with status ok', async () => {
    const response = await app.inject({ method: 'GET', url: '/health' });
    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.status).toBe('ok');
    expect(body.timestamp).toBeDefined();
  });

  it('GET /ready returns 200 when DB is reachable', async () => {
    const response = await app.inject({ method: 'GET', url: '/ready' });
    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.status).toBe('ready');
  });

  it('GET /ready returns 503 when DB is unreachable', async () => {
    const dbModule = await import('@colophony/db');
    // eslint-disable-next-line @typescript-eslint/unbound-method
    (dbModule.pool.query as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error('connection refused'),
    );

    const response = await app.inject({ method: 'GET', url: '/ready' });
    expect(response.statusCode).toBe(503);
    const body = response.json();
    expect(body.status).toBe('unavailable');
    expect(body.error).toBe('database_unreachable');
  });

  it('GET / returns 200 with API info', async () => {
    const response = await app.inject({ method: 'GET', url: '/' });
    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.name).toBe('Colophony API');
    expect(body.version).toBe('2.0.0-dev');
  });

  it('GET /nonexistent returns 401 (default-deny auth)', async () => {
    const response = await app.inject({ method: 'GET', url: '/nonexistent' });
    expect(response.statusCode).toBe(401);
  });

  it('includes CORS headers for allowed origins', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/health',
      headers: { origin: 'http://localhost:3000' },
    });
    expect(response.headers['access-control-allow-origin']).toBe(
      'http://localhost:3000',
    );
  });

  it('includes permissions-policy header on responses', async () => {
    const response = await app.inject({ method: 'GET', url: '/health' });
    expect(response.headers['permissions-policy']).toBe(
      'camera=(), microphone=(), geolocation=(), interest-cohort=()',
    );
  });

  it('sets cache-control: no-store on authenticated responses', async () => {
    // Build a separate app instance so we can add a test route before ready
    const authApp = await buildApp(testEnv);
    authApp.get('/test-auth-cache', async (_request, reply) => {
      return reply.send({ ok: true });
    });

    const response = await authApp.inject({
      method: 'GET',
      url: '/test-auth-cache',
      headers: {
        'x-test-user-id': '00000000-0000-0000-0000-000000000001',
        'x-test-email': 'test@example.com',
      },
    });
    expect(response.headers['cache-control']).toBe('no-store');
    await authApp.close();
  });

  it('does not set cache-control: no-store on unauthenticated responses', async () => {
    const response = await app.inject({ method: 'GET', url: '/health' });
    expect(response.headers['cache-control']).toBeUndefined();
  });
});
