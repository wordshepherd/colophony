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
const mockHandleInboundTransfer = vi.fn();
const mockVerifyTransferToken = vi.fn();
const mockGetFileStream = vi.fn();

vi.mock('../services/transfer.service.js', () => ({
  transferService: {
    handleInboundTransfer: (...args: unknown[]) =>
      mockHandleInboundTransfer(...args),
    verifyTransferToken: (...args: unknown[]) =>
      mockVerifyTransferToken(...args),
    getFileStream: (...args: unknown[]) => mockGetFileStream(...args),
  },
  TransferTokenError: class TransferTokenError extends Error {
    override name = 'TransferTokenError' as const;
  },
  TransferFileNotFoundError: class TransferFileNotFoundError extends Error {
    override name = 'TransferFileNotFoundError' as const;
  },
  TransferCapabilityError: class TransferCapabilityError extends Error {
    override name = 'TransferCapabilityError' as const;
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

describe('transfer.routes (S2S)', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = Fastify({ logger: false });

    const { registerTransferRoutes } = await import('./transfer.routes.js');
    await app.register(async (scope) => {
      await registerTransferRoutes(scope, { env: testEnv });
    });

    await app.ready();
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterAll(async () => {
    await app.close();
  });

  // ─── POST /federation/v1/transfers/initiate ───

  describe('POST /federation/v1/transfers/initiate', () => {
    it('accepts valid transfer (202)', async () => {
      federationPeerOverride = { domain: 'peer.com', keyId: 'peer.com#main' };
      mockHandleInboundTransfer.mockResolvedValue({
        transferId: validUuid,
        status: 'accepted',
      });

      const res = await app.inject({
        method: 'POST',
        url: '/federation/v1/transfers/initiate',
        payload: {
          transferToken: 'mock.jwt.token',
          submitterDid: 'did:web:peer.com:users:alice',
          pieceMetadata: { title: 'Test' },
          fileManifest: [
            {
              fileId: validUuid,
              filename: 'test.pdf',
              mimeType: 'application/pdf',
              size: 1024,
            },
          ],
          protocolVersion: '1.0',
        },
      });

      expect(res.statusCode).toBe(202);
      expect(res.json().status).toBe('accepted');
    });

    it('returns 503 when federation disabled', async () => {
      federationPeerOverride = { domain: 'peer.com', keyId: 'peer.com#main' };

      const disabledApp = Fastify({ logger: false });
      const { registerTransferRoutes } = await import('./transfer.routes.js');
      await disabledApp.register(async (scope) => {
        await registerTransferRoutes(scope, {
          env: { ...testEnv, FEDERATION_ENABLED: false },
        });
      });
      await disabledApp.ready();

      const res = await disabledApp.inject({
        method: 'POST',
        url: '/federation/v1/transfers/initiate',
        payload: {
          transferToken: 'mock.jwt.token',
          submitterDid: 'did:web:peer.com:users:alice',
          pieceMetadata: { title: 'Test' },
          fileManifest: [
            {
              fileId: validUuid,
              filename: 'test.pdf',
              mimeType: 'application/pdf',
              size: 1024,
            },
          ],
        },
      });

      expect(res.statusCode).toBe(503);
      await disabledApp.close();
    });

    it('returns 401 without federation peer', async () => {
      federationPeerOverride = null;

      const res = await app.inject({
        method: 'POST',
        url: '/federation/v1/transfers/initiate',
        payload: {
          transferToken: 'mock.jwt.token',
          submitterDid: 'did:web:peer.com:users:alice',
          pieceMetadata: { title: 'Test' },
          fileManifest: [
            {
              fileId: validUuid,
              filename: 'test.pdf',
              mimeType: 'application/pdf',
              size: 1024,
            },
          ],
        },
      });

      expect(res.statusCode).toBe(401);
    });

    it('returns 400 on invalid body', async () => {
      federationPeerOverride = { domain: 'peer.com', keyId: 'peer.com#main' };

      const res = await app.inject({
        method: 'POST',
        url: '/federation/v1/transfers/initiate',
        payload: { invalid: true },
      });

      expect(res.statusCode).toBe(400);
    });
  });

  // ─── GET /federation/v1/transfers/:transferId/files/:fileId ───

  describe('GET /federation/v1/transfers/:transferId/files/:fileId', () => {
    it('streams file with valid token (200)', async () => {
      mockVerifyTransferToken.mockResolvedValue({
        submissionId: validUuid,
        manuscriptVersionId: validUuid2,
        orgId: validUuid,
      });

      const { Readable } = await import('node:stream');
      const stream = Readable.from(Buffer.from('file content'));
      mockGetFileStream.mockResolvedValue({
        stream,
        filename: 'test.pdf',
        mimeType: 'application/pdf',
        size: 12,
      });

      const res = await app.inject({
        method: 'GET',
        url: `/federation/v1/transfers/${validUuid}/files/${validUuid2}`,
        headers: { authorization: 'Bearer mock.jwt.token' },
      });

      expect(res.statusCode).toBe(200);
      expect(res.headers['content-type']).toBe('application/pdf');
    });

    it('returns 401 with invalid token', async () => {
      const { TransferTokenError } =
        await import('../services/transfer.service.js');
      mockVerifyTransferToken.mockRejectedValue(
        new TransferTokenError('invalid'),
      );

      const res = await app.inject({
        method: 'GET',
        url: `/federation/v1/transfers/${validUuid}/files/${validUuid2}`,
        headers: { authorization: 'Bearer bad.token' },
      });

      expect(res.statusCode).toBe(401);
    });

    it('returns 404 for unknown file', async () => {
      mockVerifyTransferToken.mockResolvedValue({
        submissionId: validUuid,
        manuscriptVersionId: validUuid2,
        orgId: validUuid,
      });

      const { TransferFileNotFoundError } =
        await import('../services/transfer.service.js');
      mockGetFileStream.mockRejectedValue(
        new TransferFileNotFoundError(validUuid2),
      );

      const res = await app.inject({
        method: 'GET',
        url: `/federation/v1/transfers/${validUuid}/files/${validUuid2}`,
        headers: { authorization: 'Bearer mock.jwt.token' },
      });

      expect(res.statusCode).toBe(404);
    });

    it('returns 401 without bearer token', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/federation/v1/transfers/${validUuid}/files/${validUuid2}`,
      });

      expect(res.statusCode).toBe(401);
    });
  });
});
