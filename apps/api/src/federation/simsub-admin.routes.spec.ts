import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';
import type { Env } from '../config/env.js';

// Mock withRls and simSubChecks
const mockWithRls = vi.fn();

vi.mock('@colophony/db', () => ({
  withRls: (...args: unknown[]) => mockWithRls(...args),
  simSubChecks: {
    submissionId: 'submission_id',
    createdAt: 'created_at',
  },
  eq: vi.fn(),
}));

vi.mock('drizzle-orm', () => ({
  desc: vi.fn(),
}));

// Mock simsub service
const mockGrantOverride = vi.fn();

vi.mock('../services/simsub.service.js', () => ({
  simsubService: {
    grantOverride: (...args: unknown[]) => mockGrantOverride(...args),
  },
}));

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
  FEDERATION_ENABLED: true,
  FEDERATION_DOMAIN: 'local.example.com',
  INNGEST_DEV: false,
};

const validUuid = '00000000-0000-4000-a000-000000000001';

describe('simsub-admin.routes', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = Fastify({ logger: false });

    // Simulate auth context on requests
    app.decorateRequest('authContext', null);

    const { registerSimSubAdminRoutes } =
      await import('./simsub-admin.routes.js');
    await registerSimSubAdminRoutes(app, { env: testEnv });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /federation/sim-sub/checks/:submissionId', () => {
    it('returns 403 for non-admin', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/federation/sim-sub/checks/${validUuid}`,
        headers: {},
      });

      expect(res.statusCode).toBe(403);
    });

    it('returns check history for submission', async () => {
      const checkData = [
        {
          id: validUuid,
          submissionId: validUuid,
          fingerprint: 'a'.repeat(64),
          result: 'CLEAR',
          createdAt: '2026-01-01T00:00:00Z',
        },
      ];

      mockWithRls.mockImplementation(async (_ctx: any, fn: any) => {
        return fn({
          select: () => ({
            from: () => ({
              where: () => ({
                orderBy: () => Promise.resolve(checkData),
              }),
            }),
          }),
        });
      });

      // Create a request with admin auth context
      const adminApp = Fastify({ logger: false });
      adminApp.decorateRequest('authContext', null);
      adminApp.addHook('preHandler', async (request) => {
        request.authContext = {
          userId: 'admin-user',
          orgId: 'org-1',
          role: 'ADMIN',
          authMethod: 'oidc',
        } as any;
      });

      const { registerSimSubAdminRoutes } =
        await import('./simsub-admin.routes.js');
      await registerSimSubAdminRoutes(adminApp, { env: testEnv });
      await adminApp.ready();

      const res = await adminApp.inject({
        method: 'GET',
        url: `/federation/sim-sub/checks/${validUuid}`,
      });

      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual(checkData);
      await adminApp.close();
    });
  });

  describe('POST /federation/sim-sub/override/:submissionId', () => {
    it('returns 403 for non-admin', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/federation/sim-sub/override/${validUuid}`,
      });

      expect(res.statusCode).toBe(403);
    });

    it('grants override and returns success', async () => {
      mockGrantOverride.mockResolvedValue(undefined);

      const adminApp = Fastify({ logger: false });
      adminApp.decorateRequest('authContext', null);
      adminApp.addHook('preHandler', async (request) => {
        request.authContext = {
          userId: 'admin-user',
          orgId: 'org-1',
          role: 'ADMIN',
          authMethod: 'oidc',
        } as any;
      });

      const { registerSimSubAdminRoutes } =
        await import('./simsub-admin.routes.js');
      await registerSimSubAdminRoutes(adminApp, { env: testEnv });
      await adminApp.ready();

      const res = await adminApp.inject({
        method: 'POST',
        url: `/federation/sim-sub/override/${validUuid}`,
      });

      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual({ status: 'override_granted' });
      expect(mockGrantOverride).toHaveBeenCalledWith(
        'org-1',
        validUuid,
        'admin-user',
      );
      await adminApp.close();
    });
  });
});
