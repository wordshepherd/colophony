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
import type { Env } from '../config/env.js';

// Mock transfer service
const mockListTransfersForOrg = vi.fn();
const mockGetTransferById = vi.fn();
const mockCancelTransfer = vi.fn();

vi.mock('../services/transfer.service.js', () => ({
  transferService: {
    listTransfersForOrg: (...args: unknown[]) =>
      mockListTransfersForOrg(...args),
    getTransferById: (...args: unknown[]) => mockGetTransferById(...args),
    cancelTransfer: (...args: unknown[]) => mockCancelTransfer(...args),
  },
  TransferNotFoundError: class TransferNotFoundError extends Error {
    override name = 'TransferNotFoundError' as const;
  },
  TransferInvalidStateError: class TransferInvalidStateError extends Error {
    override name = 'TransferInvalidStateError' as const;
  },
}));

const validUuid = '00000000-0000-4000-a000-000000000001';

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
  FEDERATION_RATE_LIMIT_MAX: 60,
  FEDERATION_RATE_LIMIT_WINDOW_SECONDS: 60,
  FEDERATION_DOMAIN: 'local.example.com',
  INNGEST_DEV: false,
  EMAIL_PROVIDER: 'none' as const,
  SMTP_SECURE: false,
  SENTRY_ENVIRONMENT: 'test',
  SENTRY_TRACES_SAMPLE_RATE: 0,
  METRICS_ENABLED: false,
  STATUS_TOKEN_TTL_DAYS: 90,
  FEDERATION_RATE_LIMIT_FAIL_MODE: 'open' as const,
};

function buildApp(authContext: any): FastifyInstance {
  const app = Fastify({ logger: false });

  // Simulate auth hook
  app.decorateRequest('authContext', null);
  app.addHook('preHandler', async (request) => {
    (request as any).authContext = authContext;
  });

  return app;
}

describe('transfer-admin.routes', () => {
  let adminApp: FastifyInstance;
  let readerApp: FastifyInstance;

  const adminAuthContext = {
    userId: validUuid,
    orgId: validUuid,
    role: 'ADMIN' as const,
    authMethod: 'oidc' as const,
  };

  const readerAuthContext = {
    userId: validUuid,
    orgId: validUuid,
    role: 'READER' as const,
    authMethod: 'oidc' as const,
  };

  beforeAll(async () => {
    adminApp = buildApp(adminAuthContext);
    const { registerTransferAdminRoutes } =
      await import('./transfer-admin.routes.js');
    await adminApp.register(async (scope) => {
      await registerTransferAdminRoutes(scope, { env: testEnv });
    });
    await adminApp.ready();

    readerApp = buildApp(readerAuthContext);
    await readerApp.register(async (scope) => {
      await registerTransferAdminRoutes(scope, { env: testEnv });
    });
    await readerApp.ready();
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterAll(async () => {
    await adminApp.close();
    await readerApp.close();
  });

  // ─── GET /federation/transfers ───

  describe('GET /federation/transfers', () => {
    it('lists transfers (200)', async () => {
      mockListTransfersForOrg.mockResolvedValue({
        transfers: [],
        total: 0,
      });

      const res = await adminApp.inject({
        method: 'GET',
        url: '/federation/transfers',
      });

      expect(res.statusCode).toBe(200);
      expect(res.json().transfers).toEqual([]);
    });

    it('requires ADMIN role (403)', async () => {
      const res = await readerApp.inject({
        method: 'GET',
        url: '/federation/transfers',
      });

      expect(res.statusCode).toBe(403);
    });
  });

  // ─── GET /federation/transfers/:id ───

  describe('GET /federation/transfers/:id', () => {
    it('returns transfer detail (200)', async () => {
      mockGetTransferById.mockResolvedValue({
        id: validUuid,
        status: 'PENDING',
        targetDomain: 'peer.example.com',
      });

      const res = await adminApp.inject({
        method: 'GET',
        url: `/federation/transfers/${validUuid}`,
      });

      expect(res.statusCode).toBe(200);
      expect(res.json().id).toBe(validUuid);
    });

    it('returns 404 for unknown transfer', async () => {
      const { TransferNotFoundError } =
        await import('../services/transfer.service.js');
      mockGetTransferById.mockRejectedValue(
        new TransferNotFoundError(validUuid),
      );

      const res = await adminApp.inject({
        method: 'GET',
        url: `/federation/transfers/${validUuid}`,
      });

      expect(res.statusCode).toBe(404);
    });
  });

  // ─── POST /federation/transfers/:id/cancel ───

  describe('POST /federation/transfers/:id/cancel', () => {
    it('cancels transfer (200)', async () => {
      mockCancelTransfer.mockResolvedValue(undefined);

      const res = await adminApp.inject({
        method: 'POST',
        url: `/federation/transfers/${validUuid}/cancel`,
      });

      expect(res.statusCode).toBe(200);
      expect(res.json().status).toBe('cancelled');
    });

    it('returns 409 for invalid state', async () => {
      const { TransferInvalidStateError } =
        await import('../services/transfer.service.js');
      mockCancelTransfer.mockRejectedValue(
        new TransferInvalidStateError('Cannot cancel COMPLETED transfer'),
      );

      const res = await adminApp.inject({
        method: 'POST',
        url: `/federation/transfers/${validUuid}/cancel`,
      });

      expect(res.statusCode).toBe(409);
    });
  });
});
