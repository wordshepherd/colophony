import {
  describe,
  it,
  expect,
  vi,
  beforeEach,
  beforeAll,
  afterAll,
} from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';

// vi.hoisted for mock functions used in vi.mock factories
const { mockRedisEval, mockRedisQuit } = vi.hoisted(() => {
  const mockRedisEval = vi.fn().mockResolvedValue([1, 60000]);
  const mockRedisQuit = vi.fn().mockResolvedValue('OK');
  return { mockRedisEval, mockRedisQuit };
});

// Mock ioredis
vi.mock('ioredis', () => {
  const RedisMock = vi.fn().mockImplementation(function () {
    return {
      connect: vi.fn().mockResolvedValue(undefined),
      eval: mockRedisEval,
      quit: mockRedisQuit,
      status: 'ready',
    };
  });
  return { default: RedisMock };
});

// Mock @colophony/db
const mockWithRls = vi.fn();
const mockFindFirstUser = vi.fn();
vi.mock('@colophony/db', () => ({
  pool: { query: vi.fn(), connect: vi.fn() },
  db: {
    query: {
      users: { findFirst: (...args: unknown[]) => mockFindFirstUser(...args) },
    },
  },
  withRls: (...args: unknown[]) => mockWithRls(...args),
  manuscriptVersions: { id: 'id', manuscriptId: 'manuscriptId' },
  manuscripts: { id: 'id' },
  users: { zitadelUserId: 'zitadelUserId' },
  eq: vi.fn((_col: unknown, _val: unknown) => ({})),
  and: vi.fn(),
  sql: vi.fn(),
}));

// Mock file service
vi.mock('../services/file.service.js', () => ({
  fileService: {
    listByManuscriptVersion: vi.fn(),
    getById: vi.fn(),
    getByStorageKey: vi.fn(),
    create: vi.fn(),
    updateScanStatus: vi.fn(),
    delete: vi.fn(),
    countByManuscriptVersion: vi.fn(),
    totalSizeByManuscriptVersion: vi.fn(),
    validateMimeType: vi.fn(),
    validateFileSize: vi.fn(),
    validateLimits: vi.fn(),
  },
  FileNotFoundError: class extends Error {
    name = 'FileNotFoundError';
  },
  FileLimitExceededError: class extends Error {
    name = 'FileLimitExceededError';
  },
  InvalidMimeTypeError: class extends Error {
    name = 'InvalidMimeTypeError';
  },
}));

// Mock audit service
vi.mock('../services/audit.service.js', () => ({
  auditService: {
    log: vi.fn(),
    logDirect: vi.fn(),
  },
}));

// Mock queue
const mockEnqueueFileScan = vi.fn();
vi.mock('../queues/file-scan.queue.js', () => ({
  enqueueFileScan: (...args: unknown[]) => mockEnqueueFileScan(...args),
}));

// Mock S3 service
const mockCopyObject = vi.fn();
const mockDeleteS3Object = vi.fn();
vi.mock('../services/s3.js', () => ({
  createS3Client: vi.fn().mockReturnValue({}),
  copyObject: (...args: unknown[]) => mockCopyObject(...args),
  deleteS3Object: (...args: unknown[]) => mockDeleteS3Object(...args),
}));

// Mock API key service
const mockVerifyKey = vi.fn();
const mockTouchLastUsed = vi.fn();
vi.mock('../services/api-key.service.js', () => ({
  apiKeyService: {
    verifyKey: (...args: unknown[]) => mockVerifyKey(...args),
    touchLastUsed: (...args: unknown[]) => mockTouchLastUsed(...args),
  },
}));

// Mock embed token service
const mockVerifyEmbedToken = vi.fn();
vi.mock('../services/embed-token.service.js', () => ({
  embedTokenService: {
    verifyToken: (...args: unknown[]) => mockVerifyEmbedToken(...args),
  },
}));

// Mock auth-client
vi.mock('@colophony/auth-client', () => ({
  createJwksVerifier: vi.fn(),
  verifyZitadelSignature: vi.fn(),
  zitadelWebhookPayloadSchema: { safeParse: vi.fn() },
}));

import { registerTusdWebhooks } from './tusd.webhook.js';
import { fileService } from '../services/file.service.js';
import { auditService } from '../services/audit.service.js';
import type { Env } from '../config/env.js';

const mockFileService = vi.mocked(fileService);
const mockAuditService = vi.mocked(auditService);

const TEST_ENV = {
  DATABASE_URL: 'postgresql://test:test@localhost/test',
  PORT: 4000,
  HOST: '0.0.0.0',
  NODE_ENV: 'test' as const,
  LOG_LEVEL: 'error' as const,
  REDIS_HOST: 'localhost',
  REDIS_PORT: 6379,
  REDIS_PASSWORD: '',
  CORS_ORIGIN: 'http://localhost:3000',
  RATE_LIMIT_DEFAULT_MAX: 60,
  RATE_LIMIT_AUTH_MAX: 200,
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
  VIRUS_SCAN_ENABLED: true,
  CLAMAV_HOST: 'localhost',
  CLAMAV_PORT: 3310,
} as unknown as Env;

const MANUSCRIPT_VERSION_ID = 'a1111111-1111-1111-a111-111111111111';

/** Build a tusd v2 pre-create webhook payload: { Type, Event: { Upload, HTTPRequest } } */
function makePreCreateBody(overrides: Record<string, unknown> = {}) {
  return {
    Type: 'pre-create',
    Event: {
      Upload: {
        Size: 1024,
        MetaData: {
          'manuscript-version-id': MANUSCRIPT_VERSION_ID,
          filetype: 'application/pdf',
          filename: 'poem.pdf',
        },
        ...overrides,
      },
      HTTPRequest: {
        Method: 'POST',
        URI: '/files/',
        RemoteAddr: '127.0.0.1',
        Header: {
          Authorization: ['Bearer test-token'],
          'X-Test-User-Id': ['user-1'],
        },
      },
    },
  };
}

/** Build a tusd v2 post-finish webhook payload: { Type, Event: { Upload, HTTPRequest } } */
function makePostFinishBody(overrides: Record<string, unknown> = {}) {
  return {
    Type: 'post-finish',
    Event: {
      Upload: {
        ID: 'upload-abc123',
        Size: 1024,
        Offset: 1024,
        MetaData: {
          'manuscript-version-id': MANUSCRIPT_VERSION_ID,
          filetype: 'application/pdf',
          filename: 'poem.pdf',
        },
        Storage: {
          Key: 'quarantine/upload-abc123',
          Bucket: 'quarantine',
          Type: 's3store',
        },
        ...overrides,
      },
      HTTPRequest: {
        Method: 'POST',
        URI: '/files/upload-abc123',
        RemoteAddr: '127.0.0.1',
        Header: {
          Authorization: ['Bearer test-token'],
          'X-Organization-Id': ['org-1'],
          'X-Test-User-Id': ['user-1'],
        },
      },
    },
  };
}

describe('tusd webhook handler', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = Fastify({ logger: false });
    await app.register(async (scope) => {
      await registerTusdWebhooks(scope, { env: TEST_ENV });
    });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    // Restore default: below rate limit
    mockRedisEval.mockResolvedValue([1, 60000]);
    mockRedisQuit.mockResolvedValue('OK');
    mockVerifyKey.mockResolvedValue(null);
    mockVerifyEmbedToken.mockResolvedValue(null);
  });

  // -------------------------------------------------------------------------
  // Pre-create
  // -------------------------------------------------------------------------

  describe('pre-create', () => {
    it('allows valid upload', async () => {
      // withRls resolves successfully (validation passes)
      mockWithRls.mockImplementation(
        async (_ctx: unknown, fn: (tx: unknown) => Promise<void>) => {
          const mockTx = {
            select: () => ({
              from: () => ({
                innerJoin: () => ({
                  where: () => ({
                    limit: () =>
                      Promise.resolve([
                        {
                          id: MANUSCRIPT_VERSION_ID,
                          manuscriptId: 'manuscript-1',
                        },
                      ]),
                  }),
                }),
              }),
            }),
          };
          return fn(mockTx);
        },
      );
      mockFileService.validateLimits.mockResolvedValueOnce(undefined);

      const response = await app.inject({
        method: 'POST',
        url: '/webhooks/tusd',
        headers: {},
        payload: makePreCreateBody(),
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.RejectUpload).toBeUndefined();
    });

    it('rejects when missing auth', async () => {
      const body = makePreCreateBody();
      body.Event.HTTPRequest.Header = {
        'X-Organization-Id': ['org-1'],
      } as never;

      const response = await app.inject({
        method: 'POST',
        url: '/webhooks/tusd',
        headers: {},
        payload: body,
      });

      expect(response.statusCode).toBe(200);
      const result = JSON.parse(response.payload);
      expect(result.RejectUpload).toBe(true);
    });

    it('rejects invalid MIME type', async () => {
      mockFileService.validateMimeType.mockImplementationOnce(() => {
        throw new Error('invalid');
      });

      const response = await app.inject({
        method: 'POST',
        url: '/webhooks/tusd',
        headers: {},
        payload: makePreCreateBody(),
      });

      expect(response.statusCode).toBe(200);
      const result = JSON.parse(response.payload);
      expect(result.RejectUpload).toBe(true);
    });

    it('rejects when manuscript version not found', async () => {
      mockWithRls.mockImplementation(
        async (_ctx: unknown, fn: (tx: unknown) => Promise<void>) => {
          const mockTx = {
            select: () => ({
              from: () => ({
                innerJoin: () => ({
                  where: () => ({
                    limit: () => Promise.resolve([]),
                  }),
                }),
              }),
            }),
          };
          return fn(mockTx);
        },
      );

      const response = await app.inject({
        method: 'POST',
        url: '/webhooks/tusd',
        headers: {},
        payload: makePreCreateBody(),
      });

      expect(response.statusCode).toBe(200);
      const result = JSON.parse(response.payload);
      expect(result.RejectUpload).toBe(true);
      expect(result.HTTPResponse.Body).toContain(
        'manuscript_version_not_found',
      );
    });

    it('rejects missing manuscript-version-id in metadata', async () => {
      const body = makePreCreateBody({
        MetaData: { filetype: 'application/pdf' },
      });

      const response = await app.inject({
        method: 'POST',
        url: '/webhooks/tusd',
        headers: {},
        payload: body,
      });

      expect(response.statusCode).toBe(200);
      const result = JSON.parse(response.payload);
      expect(result.RejectUpload).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // Post-finish
  // -------------------------------------------------------------------------

  describe('post-finish', () => {
    it('creates file record on new upload', async () => {
      mockWithRls.mockImplementation(
        async (_ctx: unknown, fn: (tx: unknown) => Promise<void>) => {
          return fn({});
        },
      );
      mockFileService.getByStorageKey.mockResolvedValueOnce(null as never);
      mockFileService.create.mockResolvedValueOnce({
        id: 'file-1',
        manuscriptVersionId: MANUSCRIPT_VERSION_ID,
        filename: 'poem.pdf',
        mimeType: 'application/pdf',
        size: 1024,
        storageKey: 'quarantine/upload-abc123',
        scanStatus: 'PENDING',
        scannedAt: null,
        uploadedAt: new Date(),
      } as never);
      mockAuditService.log.mockResolvedValueOnce(undefined);

      const response = await app.inject({
        method: 'POST',
        url: '/webhooks/tusd',
        headers: {},
        payload: makePostFinishBody(),
      });

      expect(response.statusCode).toBe(200);
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(mockFileService.create).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          manuscriptVersionId: MANUSCRIPT_VERSION_ID,
          filename: 'poem.pdf',
          mimeType: 'application/pdf',
          storageKey: 'quarantine/upload-abc123',
        }),
      );
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(mockAuditService.log).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          action: 'FILE_UPLOADED',
          resource: 'file',
        }),
      );
    });

    it('is idempotent — skips if storageKey already exists', async () => {
      mockWithRls.mockImplementation(
        async (_ctx: unknown, fn: (tx: unknown) => Promise<void>) => {
          return fn({});
        },
      );
      mockFileService.getByStorageKey.mockResolvedValueOnce({
        id: 'existing-file',
        storageKey: 'quarantine/upload-abc123',
      } as never);

      const response = await app.inject({
        method: 'POST',
        url: '/webhooks/tusd',
        headers: {},
        payload: makePostFinishBody(),
      });

      expect(response.statusCode).toBe(200);
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(mockFileService.create).not.toHaveBeenCalled();
    });

    it('rejects when auth is missing (fail closed)', async () => {
      const body = makePostFinishBody();
      body.Event.HTTPRequest.Header = {
        'X-Organization-Id': ['org-1'],
      } as never;

      const response = await app.inject({
        method: 'POST',
        url: '/webhooks/tusd',
        headers: {},
        payload: body,
      });

      expect(response.statusCode).toBe(401);
      const result = JSON.parse(response.payload);
      expect(result.error).toBe('no_auth_configured');
    });

    it('succeeds without org id (orgId is optional)', async () => {
      mockWithRls.mockImplementation(
        async (_ctx: unknown, fn: (tx: unknown) => Promise<void>) => {
          return fn({});
        },
      );
      mockFileService.getByStorageKey.mockResolvedValueOnce(null as never);
      mockFileService.create.mockResolvedValueOnce({
        id: 'file-1',
        manuscriptVersionId: MANUSCRIPT_VERSION_ID,
        filename: 'poem.pdf',
        mimeType: 'application/pdf',
        size: 1024,
        storageKey: 'quarantine/upload-abc123',
        scanStatus: 'PENDING',
        scannedAt: null,
        uploadedAt: new Date(),
      } as never);
      mockAuditService.log.mockResolvedValueOnce(undefined);
      mockEnqueueFileScan.mockResolvedValueOnce(undefined);

      const body = makePostFinishBody();
      body.Event.HTTPRequest.Header = {
        Authorization: ['Bearer test-token'],
        'X-Test-User-Id': ['user-1'],
      } as never;

      const response = await app.inject({
        method: 'POST',
        url: '/webhooks/tusd',
        headers: {},
        payload: body,
      });

      expect(response.statusCode).toBe(200);
      // withRls called with userId only (no orgId)
      expect(mockWithRls).toHaveBeenCalledWith(
        { userId: 'user-1' },
        expect.any(Function),
      );
    });

    it('enqueues scan job after commit when VIRUS_SCAN_ENABLED', async () => {
      mockWithRls.mockImplementation(
        async (_ctx: unknown, fn: (tx: unknown) => Promise<void>) => {
          return fn({});
        },
      );
      mockFileService.getByStorageKey.mockResolvedValueOnce(null as never);
      mockFileService.create.mockResolvedValueOnce({
        id: 'file-1',
        manuscriptVersionId: MANUSCRIPT_VERSION_ID,
        filename: 'poem.pdf',
        mimeType: 'application/pdf',
        size: 1024,
        storageKey: 'quarantine/upload-abc123',
        scanStatus: 'PENDING',
        scannedAt: null,
        uploadedAt: new Date(),
      } as never);
      mockAuditService.log.mockResolvedValueOnce(undefined);
      mockEnqueueFileScan.mockResolvedValueOnce(undefined);

      const response = await app.inject({
        method: 'POST',
        url: '/webhooks/tusd',
        headers: {},
        payload: makePostFinishBody(),
      });

      expect(response.statusCode).toBe(200);
      expect(mockEnqueueFileScan).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          fileId: 'file-1',
          storageKey: 'quarantine/upload-abc123',
          userId: 'user-1',
          organizationId: 'org-1',
        }),
      );
    });

    it('does not enqueue scan when idempotent (file already processed)', async () => {
      mockWithRls.mockImplementation(
        async (_ctx: unknown, fn: (tx: unknown) => Promise<void>) => {
          return fn({});
        },
      );
      mockFileService.getByStorageKey.mockResolvedValueOnce({
        id: 'existing-file',
        storageKey: 'quarantine/upload-abc123',
        scanStatus: 'CLEAN',
      } as never);

      await app.inject({
        method: 'POST',
        url: '/webhooks/tusd',
        headers: {},
        payload: makePostFinishBody(),
      });

      expect(mockEnqueueFileScan).not.toHaveBeenCalled();
    });

    it('re-enqueues scan for PENDING file on retry (prior enqueue failed)', async () => {
      mockWithRls.mockImplementation(
        async (_ctx: unknown, fn: (tx: unknown) => Promise<void>) => {
          return fn({});
        },
      );
      mockFileService.getByStorageKey.mockResolvedValueOnce({
        id: 'existing-file',
        storageKey: 'quarantine/upload-abc123',
        scanStatus: 'PENDING',
      } as never);
      mockEnqueueFileScan.mockResolvedValueOnce(undefined);

      const response = await app.inject({
        method: 'POST',
        url: '/webhooks/tusd',
        headers: {},
        payload: makePostFinishBody(),
      });

      expect(response.statusCode).toBe(200);
      expect(mockEnqueueFileScan).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          fileId: 'existing-file',
          storageKey: 'quarantine/upload-abc123',
        }),
      );
    });

    it('returns 500 on processing error', async () => {
      mockWithRls.mockRejectedValueOnce(new Error('DB connection failed'));

      const response = await app.inject({
        method: 'POST',
        url: '/webhooks/tusd',
        headers: {},
        payload: makePostFinishBody(),
      });

      expect(response.statusCode).toBe(500);
    });
  });

  // -------------------------------------------------------------------------
  // API key auth
  // -------------------------------------------------------------------------

  describe('API key auth', () => {
    const VALID_API_KEY_RESULT = {
      apiKey: {
        id: 'key-1',
        organizationId: 'org-from-key',
        createdBy: 'user-1',
        name: 'test-key',
        scopes: ['files:read', 'files:write'],
        expiresAt: null,
        revokedAt: null,
        lastUsedAt: null,
        createdAt: new Date(),
      },
      creator: {
        id: 'user-1',
        email: 'test@example.com',
        emailVerified: true,
        deletedAt: null,
      },
    };

    function makeApiKeyPreCreateBody() {
      return {
        Type: 'pre-create',
        Event: {
          Upload: {
            Size: 1024,
            MetaData: {
              'manuscript-version-id': MANUSCRIPT_VERSION_ID,
              filetype: 'application/pdf',
              filename: 'poem.pdf',
            },
          },
          HTTPRequest: {
            Method: 'POST',
            URI: '/files/',
            RemoteAddr: '127.0.0.1',
            Header: {
              'X-Api-Key': ['col_test_abc123'],
              'X-Organization-Id': ['org-from-header-should-be-ignored'],
            },
          },
        },
      };
    }

    function makeApiKeyPostFinishBody() {
      return {
        Type: 'post-finish',
        Event: {
          Upload: {
            ID: 'upload-abc123',
            Size: 1024,
            Offset: 1024,
            MetaData: {
              'manuscript-version-id': MANUSCRIPT_VERSION_ID,
              filetype: 'application/pdf',
              filename: 'poem.pdf',
            },
            Storage: {
              Key: 'quarantine/upload-abc123',
              Bucket: 'quarantine',
              Type: 's3store',
            },
          },
          HTTPRequest: {
            Method: 'POST',
            URI: '/files/upload-abc123',
            RemoteAddr: '127.0.0.1',
            Header: {
              'X-Api-Key': ['col_test_abc123'],
              'X-Organization-Id': ['org-from-header-should-be-ignored'],
            },
          },
        },
      };
    }

    it('pre-create: allows upload with valid API key', async () => {
      mockVerifyKey.mockResolvedValueOnce(VALID_API_KEY_RESULT);
      mockWithRls.mockImplementation(
        async (_ctx: unknown, fn: (tx: unknown) => Promise<void>) => {
          const mockTx = {
            select: () => ({
              from: () => ({
                innerJoin: () => ({
                  where: () => ({
                    limit: () =>
                      Promise.resolve([
                        {
                          id: MANUSCRIPT_VERSION_ID,
                          manuscriptId: 'manuscript-1',
                        },
                      ]),
                  }),
                }),
              }),
            }),
          };
          return fn(mockTx);
        },
      );
      mockFileService.validateLimits.mockResolvedValueOnce(undefined);

      const response = await app.inject({
        method: 'POST',
        url: '/webhooks/tusd',
        headers: {},
        payload: makeApiKeyPreCreateBody(),
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.RejectUpload).toBeUndefined();
      // Pre-create uses withRls({ userId }) — user-scoped, no orgId
      expect(mockWithRls).toHaveBeenCalledWith(
        { userId: 'user-1' },
        expect.any(Function),
      );
    });

    it('pre-create: rejects invalid API key', async () => {
      mockVerifyKey.mockResolvedValueOnce(null);

      const response = await app.inject({
        method: 'POST',
        url: '/webhooks/tusd',
        headers: {},
        payload: makeApiKeyPreCreateBody(),
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.RejectUpload).toBe(true);
      expect(body.HTTPResponse.Body).toContain('invalid_key');
    });

    it('pre-create: rejects expired API key', async () => {
      mockVerifyKey.mockResolvedValueOnce({
        ...VALID_API_KEY_RESULT,
        apiKey: {
          ...VALID_API_KEY_RESULT.apiKey,
          expiresAt: new Date('2020-01-01'),
        },
      });

      const response = await app.inject({
        method: 'POST',
        url: '/webhooks/tusd',
        headers: {},
        payload: makeApiKeyPreCreateBody(),
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.RejectUpload).toBe(true);
      expect(body.HTTPResponse.Body).toContain('key_expired');
    });

    it('pre-create: rejects revoked API key', async () => {
      mockVerifyKey.mockResolvedValueOnce({
        ...VALID_API_KEY_RESULT,
        apiKey: {
          ...VALID_API_KEY_RESULT.apiKey,
          revokedAt: new Date(),
        },
      });

      const response = await app.inject({
        method: 'POST',
        url: '/webhooks/tusd',
        headers: {},
        payload: makeApiKeyPreCreateBody(),
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.RejectUpload).toBe(true);
      expect(body.HTTPResponse.Body).toContain('key_revoked');
    });

    it('pre-create: rejects when creator is deactivated', async () => {
      mockVerifyKey.mockResolvedValueOnce({
        ...VALID_API_KEY_RESULT,
        creator: {
          ...VALID_API_KEY_RESULT.creator,
          deletedAt: new Date(),
        },
      });

      const response = await app.inject({
        method: 'POST',
        url: '/webhooks/tusd',
        headers: {},
        payload: makeApiKeyPreCreateBody(),
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.RejectUpload).toBe(true);
      expect(body.HTTPResponse.Body).toContain('creator_deactivated');
    });

    it('pre-create: rejects API key without files:write scope', async () => {
      mockVerifyKey.mockResolvedValueOnce({
        ...VALID_API_KEY_RESULT,
        apiKey: {
          ...VALID_API_KEY_RESULT.apiKey,
          scopes: ['files:read'],
        },
      });

      const response = await app.inject({
        method: 'POST',
        url: '/webhooks/tusd',
        headers: {},
        payload: makeApiKeyPreCreateBody(),
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.RejectUpload).toBe(true);
      expect(body.HTTPResponse.Body).toContain('insufficient_scopes');
    });

    it('post-finish: creates file record with valid API key', async () => {
      mockVerifyKey.mockResolvedValueOnce(VALID_API_KEY_RESULT);
      mockWithRls.mockImplementation(
        async (_ctx: unknown, fn: (tx: unknown) => Promise<void>) => {
          return fn({});
        },
      );
      mockFileService.getByStorageKey.mockResolvedValueOnce(null as never);
      mockFileService.create.mockResolvedValueOnce({
        id: 'file-1',
        manuscriptVersionId: MANUSCRIPT_VERSION_ID,
        filename: 'poem.pdf',
        mimeType: 'application/pdf',
        size: 1024,
        storageKey: 'quarantine/upload-abc123',
        scanStatus: 'PENDING',
        scannedAt: null,
        uploadedAt: new Date(),
      } as never);
      mockAuditService.log.mockResolvedValueOnce(undefined);

      const response = await app.inject({
        method: 'POST',
        url: '/webhooks/tusd',
        headers: {},
        payload: makeApiKeyPostFinishBody(),
      });

      expect(response.statusCode).toBe(200);
      // Post-finish uses withRls({ userId }) — user-scoped, no orgId
      expect(mockWithRls).toHaveBeenCalledWith(
        { userId: 'user-1' },
        expect.any(Function),
      );
    });

    it('post-finish: rejects API key without files:write scope', async () => {
      mockVerifyKey.mockResolvedValueOnce({
        ...VALID_API_KEY_RESULT,
        apiKey: {
          ...VALID_API_KEY_RESULT.apiKey,
          scopes: ['files:read'],
        },
      });

      const response = await app.inject({
        method: 'POST',
        url: '/webhooks/tusd',
        headers: {},
        payload: makeApiKeyPostFinishBody(),
      });

      expect(response.statusCode).toBe(403);
      const body = JSON.parse(response.payload);
      expect(body.error).toBe('insufficient_scopes');
    });

    it('post-finish: rejects invalid API key', async () => {
      mockVerifyKey.mockResolvedValueOnce(null);

      const response = await app.inject({
        method: 'POST',
        url: '/webhooks/tusd',
        headers: {},
        payload: makeApiKeyPostFinishBody(),
      });

      expect(response.statusCode).toBe(401);
      const body = JSON.parse(response.payload);
      expect(body.error).toBe('invalid_key');
    });
  });

  // -------------------------------------------------------------------------
  // Embed token auth
  // -------------------------------------------------------------------------

  describe('embed token auth', () => {
    const VALID_EMBED_TOKEN = {
      id: 'embed-token-1',
      organizationId: 'org-1',
      submissionPeriodId: 'period-1',
      allowedOrigins: [],
      themeConfig: null,
      active: true,
      expiresAt: null,
      period: {
        name: 'Fall 2026',
        opensAt: new Date(Date.now() - 86400000),
        closesAt: new Date(Date.now() + 86400000),
        formDefinitionId: null,
        maxSubmissions: null,
        fee: null,
      },
    };

    function makeEmbedPreCreateBody() {
      return {
        Type: 'pre-create',
        Event: {
          Upload: {
            Size: 1024,
            MetaData: {
              'manuscript-version-id': MANUSCRIPT_VERSION_ID,
              'guest-user-id': 'guest-user-1',
              filetype: 'application/pdf',
              filename: 'poem.pdf',
            },
          },
          HTTPRequest: {
            Method: 'POST',
            URI: '/files/',
            RemoteAddr: '127.0.0.1',
            Header: {
              'X-Embed-Token': ['col_emb_abc123def456'],
            },
          },
        },
      };
    }

    function makeEmbedPostFinishBody() {
      return {
        Type: 'post-finish',
        Event: {
          Upload: {
            ID: 'upload-embed-123',
            Size: 1024,
            Offset: 1024,
            MetaData: {
              'manuscript-version-id': MANUSCRIPT_VERSION_ID,
              'guest-user-id': 'guest-user-1',
              filetype: 'application/pdf',
              filename: 'poem.pdf',
            },
            Storage: {
              Key: 'quarantine/upload-embed-123',
              Bucket: 'quarantine',
              Type: 's3store',
            },
          },
          HTTPRequest: {
            Method: 'POST',
            URI: '/files/upload-embed-123',
            RemoteAddr: '127.0.0.1',
            Header: {
              'X-Embed-Token': ['col_emb_abc123def456'],
            },
          },
        },
      };
    }

    it('pre-create allows upload with valid embed token + guest-user-id', async () => {
      mockVerifyEmbedToken.mockResolvedValueOnce(VALID_EMBED_TOKEN);
      mockWithRls.mockImplementation(
        async (_ctx: unknown, fn: (tx: unknown) => Promise<void>) => {
          const mockTx = {
            select: () => ({
              from: () => ({
                innerJoin: () => ({
                  where: () => ({
                    limit: () =>
                      Promise.resolve([
                        {
                          id: MANUSCRIPT_VERSION_ID,
                          manuscriptId: 'manuscript-1',
                        },
                      ]),
                  }),
                }),
              }),
            }),
          };
          return fn(mockTx);
        },
      );
      mockFileService.validateLimits.mockResolvedValueOnce(undefined);

      const response = await app.inject({
        method: 'POST',
        url: '/webhooks/tusd',
        headers: {},
        payload: makeEmbedPreCreateBody(),
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.RejectUpload).toBeUndefined();
      // Verify withRls was called with the guest user ID
      expect(mockWithRls).toHaveBeenCalledWith(
        { userId: 'guest-user-1' },
        expect.any(Function),
      );
    });

    it('pre-create rejects invalid embed token', async () => {
      mockVerifyEmbedToken.mockResolvedValueOnce(null);

      const response = await app.inject({
        method: 'POST',
        url: '/webhooks/tusd',
        headers: {},
        payload: makeEmbedPreCreateBody(),
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.RejectUpload).toBe(true);
      expect(body.HTTPResponse.Body).toContain('invalid_embed_token');
    });

    it('pre-create rejects expired embed token', async () => {
      mockVerifyEmbedToken.mockResolvedValueOnce({
        ...VALID_EMBED_TOKEN,
        expiresAt: new Date('2020-01-01'),
      });

      const response = await app.inject({
        method: 'POST',
        url: '/webhooks/tusd',
        headers: {},
        payload: makeEmbedPreCreateBody(),
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.RejectUpload).toBe(true);
      expect(body.HTTPResponse.Body).toContain('embed_token_expired');
    });

    it('pre-create rejects missing guest-user-id metadata', async () => {
      mockVerifyEmbedToken.mockResolvedValueOnce(VALID_EMBED_TOKEN);

      const body = makeEmbedPreCreateBody();
      delete (body.Event.Upload.MetaData as Record<string, string>)[
        'guest-user-id'
      ];

      const response = await app.inject({
        method: 'POST',
        url: '/webhooks/tusd',
        headers: {},
        payload: body,
      });

      expect(response.statusCode).toBe(200);
      const result = JSON.parse(response.payload);
      expect(result.RejectUpload).toBe(true);
      expect(result.HTTPResponse.Body).toContain('missing_guest_user_id');
    });

    it('pre-create rejects when manuscript version not owned by guest user', async () => {
      mockVerifyEmbedToken.mockResolvedValueOnce(VALID_EMBED_TOKEN);
      mockWithRls.mockImplementation(
        async (_ctx: unknown, fn: (tx: unknown) => Promise<void>) => {
          const mockTx = {
            select: () => ({
              from: () => ({
                innerJoin: () => ({
                  where: () => ({
                    limit: () => Promise.resolve([]),
                  }),
                }),
              }),
            }),
          };
          return fn(mockTx);
        },
      );

      const response = await app.inject({
        method: 'POST',
        url: '/webhooks/tusd',
        headers: {},
        payload: makeEmbedPreCreateBody(),
      });

      expect(response.statusCode).toBe(200);
      const result = JSON.parse(response.payload);
      expect(result.RejectUpload).toBe(true);
      expect(result.HTTPResponse.Body).toContain(
        'manuscript_version_not_found',
      );
    });

    it('post-finish creates file record for embed upload', async () => {
      mockVerifyEmbedToken.mockResolvedValueOnce(VALID_EMBED_TOKEN);
      mockWithRls.mockImplementation(
        async (_ctx: unknown, fn: (tx: unknown) => Promise<void>) => {
          return fn({});
        },
      );
      mockFileService.getByStorageKey.mockResolvedValueOnce(null as never);
      mockFileService.create.mockResolvedValueOnce({
        id: 'file-embed-1',
        manuscriptVersionId: MANUSCRIPT_VERSION_ID,
        filename: 'poem.pdf',
        mimeType: 'application/pdf',
        size: 1024,
        storageKey: 'quarantine/upload-embed-123',
        scanStatus: 'PENDING',
        scannedAt: null,
        uploadedAt: new Date(),
      } as never);
      mockAuditService.log.mockResolvedValueOnce(undefined);
      mockEnqueueFileScan.mockResolvedValueOnce(undefined);

      const response = await app.inject({
        method: 'POST',
        url: '/webhooks/tusd',
        headers: {},
        payload: makeEmbedPostFinishBody(),
      });

      expect(response.statusCode).toBe(200);
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(mockFileService.create).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          manuscriptVersionId: MANUSCRIPT_VERSION_ID,
          filename: 'poem.pdf',
          storageKey: 'quarantine/upload-embed-123',
        }),
      );
      expect(mockEnqueueFileScan).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          fileId: 'file-embed-1',
          userId: 'guest-user-1',
        }),
      );
    });

    it('post-finish is idempotent for embed uploads', async () => {
      mockVerifyEmbedToken.mockResolvedValueOnce(VALID_EMBED_TOKEN);
      mockWithRls.mockImplementation(
        async (_ctx: unknown, fn: (tx: unknown) => Promise<void>) => {
          return fn({});
        },
      );
      mockFileService.getByStorageKey.mockResolvedValueOnce({
        id: 'existing-file',
        storageKey: 'quarantine/upload-embed-123',
        scanStatus: 'CLEAN',
      } as never);

      const response = await app.inject({
        method: 'POST',
        url: '/webhooks/tusd',
        headers: {},
        payload: makeEmbedPostFinishBody(),
      });

      expect(response.statusCode).toBe(200);
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(mockFileService.create).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // Unknown hook
  // -------------------------------------------------------------------------

  describe('unknown hook', () => {
    it('returns 200 for unknown hook type (v2 format)', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/webhooks/tusd',
        headers: {},
        payload: { Type: 'post-create', Event: {} },
      });

      expect(response.statusCode).toBe(200);
    });

    it('returns 200 for unknown hook name (v1 format)', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/webhooks/tusd',
        headers: { 'hook-name': 'post-create' },
        payload: {},
      });

      expect(response.statusCode).toBe(200);
    });
  });

  // -------------------------------------------------------------------------
  // Rate limiting
  // -------------------------------------------------------------------------

  describe('rate limiting', () => {
    it('returns 429 when webhook rate limit exceeded', async () => {
      mockRedisEval.mockResolvedValueOnce([101, 30000]);

      const response = await app.inject({
        method: 'POST',
        url: '/webhooks/tusd',
        headers: {},
        payload: makePreCreateBody(),
      });

      expect(response.statusCode).toBe(429);
      const body = JSON.parse(response.payload);
      expect(body.error).toBe('rate_limit_exceeded');
    });

    it('sets Retry-After header on 429', async () => {
      mockRedisEval.mockResolvedValueOnce([101, 30000]);

      const response = await app.inject({
        method: 'POST',
        url: '/webhooks/tusd',
        headers: {},
        payload: makePreCreateBody(),
      });

      expect(response.statusCode).toBe(429);
      const retryAfter = Number(response.headers['retry-after']);
      expect(retryAfter).toBeGreaterThan(0);
      expect(retryAfter).toBeLessThanOrEqual(60);
    });

    it('allows requests when Redis is unavailable (graceful degradation)', async () => {
      mockRedisEval.mockRejectedValueOnce(new Error('Redis connection failed'));
      // withRls resolves successfully (validation passes)
      mockWithRls.mockImplementation(
        async (_ctx: unknown, fn: (tx: unknown) => Promise<void>) => {
          const mockTx = {
            select: () => ({
              from: () => ({
                innerJoin: () => ({
                  where: () => ({
                    limit: () =>
                      Promise.resolve([
                        {
                          id: MANUSCRIPT_VERSION_ID,
                          manuscriptId: 'manuscript-1',
                        },
                      ]),
                  }),
                }),
              }),
            }),
          };
          return fn(mockTx);
        },
      );
      mockFileService.validateLimits.mockResolvedValueOnce(undefined);

      const response = await app.inject({
        method: 'POST',
        url: '/webhooks/tusd',
        headers: {},
        payload: makePreCreateBody(),
      });

      // Request should be allowed through despite Redis failure
      expect(response.statusCode).toBe(200);
    });
  });
});
