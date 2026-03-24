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
import { Readable } from 'node:stream';
import type { Env } from '../config/env.js';

// Mock migration service
const mockHandleMigrationRequest = vi.fn();
const mockHandleBundleDelivery = vi.fn();
const mockHandleMigrationComplete = vi.fn();
const mockHandleMigrationBroadcast = vi.fn();
const mockVerifyMigrationToken = vi.fn();
const mockGetFileStream = vi.fn();

vi.mock('../services/migration.service.js', () => ({
  migrationService: {
    handleMigrationRequest: (...args: unknown[]) =>
      mockHandleMigrationRequest(...args),
    handleBundleDelivery: (...args: unknown[]) =>
      mockHandleBundleDelivery(...args),
    handleMigrationComplete: (...args: unknown[]) =>
      mockHandleMigrationComplete(...args),
    handleMigrationBroadcast: (...args: unknown[]) =>
      mockHandleMigrationBroadcast(...args),
    verifyMigrationToken: (...args: unknown[]) =>
      mockVerifyMigrationToken(...args),
    getFileStream: (...args: unknown[]) => mockGetFileStream(...args),
  },
  MigrationTokenError: class MigrationTokenError extends Error {
    override name = 'MigrationTokenError' as const;
  },
  MigrationCapabilityError: class MigrationCapabilityError extends Error {
    override name = 'MigrationCapabilityError' as const;
  },
  MigrationAlreadyActiveError: class MigrationAlreadyActiveError extends Error {
    override name = 'MigrationAlreadyActiveError' as const;
  },
  MigrationUserNotFoundError: class MigrationUserNotFoundError extends Error {
    override name = 'MigrationUserNotFoundError' as const;
  },
  MigrationNotFoundError: class MigrationNotFoundError extends Error {
    override name = 'MigrationNotFoundError' as const;
  },
  MigrationInvalidStateError: class MigrationInvalidStateError extends Error {
    override name = 'MigrationInvalidStateError' as const;
  },
}));

// Mock audit service
vi.mock('../services/audit.service.js', () => ({
  auditService: {
    logDirect: vi.fn().mockResolvedValue(undefined),
  },
}));

// Mock federation-auth plugin
let federationPeerOverride: any = null;
vi.mock('./federation-auth.js', () => ({
  default: Object.assign(
    async (app: FastifyInstance) => {
      if (!app.hasDecorator('federationPeer')) {
        app.decorateRequest('federationPeer', null);
      }
      app.addHook('preHandler', async (request) => {
        request.federationPeer = federationPeerOverride;
      });
    },
    {
      [Symbol.for('fastify.display-name')]: 'federation-auth-mock',
      [Symbol.for('skip-override')]: true,
    },
  ),
}));

const validUuid = '00000000-0000-4000-a000-000000000001';
const validUuid2 = '00000000-0000-4000-a000-000000000002';
const validUuid3 = '00000000-0000-4000-a000-000000000003';

const testEnv: Env = {
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
  WEBHOOK_HEALTH_ZITADEL_STALE_SECONDS: 3600,
  WEBHOOK_HEALTH_STRIPE_STALE_SECONDS: 86400,
  WEBHOOK_HEALTH_DOCUMENSO_STALE_SECONDS: 86400,
};

describe('migration.routes (S2S)', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = Fastify({ logger: false });

    const { registerMigrationRoutes } = await import('./migration.routes.js');
    await app.register(async (scope) => {
      await registerMigrationRoutes(scope, { env: testEnv });
    });

    await app.ready();
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterAll(async () => {
    await app.close();
  });

  // ─── POST /federation/v1/migrations/request ───

  describe('POST /federation/v1/migrations/request', () => {
    it('returns 503 when federation disabled', async () => {
      const disabledEnv = { ...testEnv, FEDERATION_ENABLED: false };
      const disabledApp = Fastify({ logger: false });
      const { registerMigrationRoutes } = await import('./migration.routes.js');
      await disabledApp.register(async (scope) => {
        await registerMigrationRoutes(scope, { env: disabledEnv });
      });
      await disabledApp.ready();

      federationPeerOverride = { domain: 'peer.com', keyId: 'peer.com#main' };
      const res = await disabledApp.inject({
        method: 'POST',
        url: '/federation/v1/migrations/request',
        payload: {
          userEmail: 'test@peer.com',
          destinationDomain: 'peer.com',
          destinationUserDid: null,
          callbackUrl: 'https://peer.com/cb',
        },
      });

      expect(res.statusCode).toBe(503);
      await disabledApp.close();
    });

    it('returns 401 without federation peer', async () => {
      federationPeerOverride = null;

      const res = await app.inject({
        method: 'POST',
        url: '/federation/v1/migrations/request',
        payload: {
          userEmail: 'test@peer.com',
          destinationDomain: 'peer.com',
          destinationUserDid: null,
          callbackUrl: 'https://peer.com/cb',
        },
      });

      expect(res.statusCode).toBe(401);
    });

    it('returns 400 for invalid body', async () => {
      federationPeerOverride = { domain: 'peer.com', keyId: 'peer.com#main' };

      const res = await app.inject({
        method: 'POST',
        url: '/federation/v1/migrations/request',
        payload: { invalid: true },
      });

      expect(res.statusCode).toBe(400);
    });

    it('returns 202 on success', async () => {
      federationPeerOverride = { domain: 'peer.com', keyId: 'peer.com#main' };
      mockHandleMigrationRequest.mockResolvedValue({
        migrationId: validUuid,
        status: 'pending_approval',
      });

      const res = await app.inject({
        method: 'POST',
        url: '/federation/v1/migrations/request',
        payload: {
          userEmail: 'test@peer.com',
          destinationDomain: 'peer.com',
          destinationUserDid: null,
          callbackUrl: 'https://peer.com/cb',
        },
      });

      expect(res.statusCode).toBe(202);
      expect(JSON.parse(res.body)).toEqual({
        migrationId: validUuid,
        status: 'pending_approval',
      });
    });

    it('returns 409 for duplicate migration', async () => {
      federationPeerOverride = { domain: 'peer.com', keyId: 'peer.com#main' };
      const { MigrationAlreadyActiveError } =
        await import('../services/migration.service.js');
      mockHandleMigrationRequest.mockRejectedValue(
        new MigrationAlreadyActiveError(),
      );

      const res = await app.inject({
        method: 'POST',
        url: '/federation/v1/migrations/request',
        payload: {
          userEmail: 'test@peer.com',
          destinationDomain: 'peer.com',
          destinationUserDid: null,
          callbackUrl: 'https://peer.com/cb',
        },
      });

      expect(res.statusCode).toBe(409);
    });
  });

  // ─── POST /federation/v1/migrations/bundle-delivery ───

  describe('POST /federation/v1/migrations/bundle-delivery', () => {
    it('returns 202 with valid bundle', async () => {
      federationPeerOverride = { domain: 'peer.com', keyId: 'peer.com#main' };
      mockHandleBundleDelivery.mockResolvedValue({
        migrationId: validUuid,
        status: 'accepted',
      });

      const res = await app.inject({
        method: 'POST',
        url: '/federation/v1/migrations/bundle-delivery',
        payload: {
          migrationId: validUuid,
          bundle: {
            protocolVersion: '1.0',
            originDomain: 'peer.com',
            userDid: 'did:web:peer.com:users:test',
            destinationDomain: 'local.example.com',
            destinationUserDid: null,
            identity: {
              email: 'test@peer.com',
              alsoKnownAs: [],
            },
            submissionHistory: [],
            activeSubmissions: [],
            bundleToken: 'mock.jwt',
            createdAt: new Date().toISOString(),
          },
        },
      });

      expect(res.statusCode).toBe(202);
    });
  });

  // ─── GET file serving ───

  describe('GET /federation/v1/migrations/:migrationId/submissions/:submissionId/files/:fileId', () => {
    it('returns 401 without bearer token', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/federation/v1/migrations/${validUuid}/submissions/${validUuid2}/files/${validUuid3}`,
      });

      expect(res.statusCode).toBe(401);
    });

    it('returns 200 with stream on valid token', async () => {
      mockVerifyMigrationToken.mockResolvedValue({ userId: validUuid2 });
      mockGetFileStream.mockResolvedValue({
        stream: Readable.from(Buffer.from('file content')),
        filename: 'story.docx',
        mimeType:
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        size: 12,
      });

      const res = await app.inject({
        method: 'GET',
        url: `/federation/v1/migrations/${validUuid}/submissions/${validUuid2}/files/${validUuid3}`,
        headers: {
          authorization: 'Bearer valid.jwt.token',
        },
      });

      expect(res.statusCode).toBe(200);
      expect(res.headers['content-type']).toContain(
        'application/vnd.openxmlformats',
      );
    });
  });
});
