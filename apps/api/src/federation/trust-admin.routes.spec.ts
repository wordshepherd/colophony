import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  vi,
  beforeEach,
} from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';
import type { Env } from '../config/env.js';

// Mock trust service
const mockFetchRemoteMetadata = vi.fn();
const mockInitiateTrust = vi.fn();
const mockListPeers = vi.fn();
const mockGetPeerById = vi.fn();
const mockAcceptInboundTrust = vi.fn();
const mockRejectTrust = vi.fn();
const mockRevokeTrust = vi.fn();

vi.mock('../services/trust.service.js', () => ({
  trustService: {
    fetchRemoteMetadata: (...args: unknown[]) =>
      mockFetchRemoteMetadata(...args),
    initiateTrust: (...args: unknown[]) => mockInitiateTrust(...args),
    listPeers: (...args: unknown[]) => mockListPeers(...args),
    getPeerById: (...args: unknown[]) => mockGetPeerById(...args),
    acceptInboundTrust: (...args: unknown[]) => mockAcceptInboundTrust(...args),
    rejectTrust: (...args: unknown[]) => mockRejectTrust(...args),
    revokeTrust: (...args: unknown[]) => mockRevokeTrust(...args),
  },
  TrustPeerNotFoundError: class extends Error {
    override name = 'TrustPeerNotFoundError' as const;
    constructor(id: string) {
      super(`Trusted peer not found: ${id}`);
    }
  },
  TrustPeerAlreadyExistsError: class extends Error {
    override name = 'TrustPeerAlreadyExistsError' as const;
    constructor(domain: string) {
      super(`Trusted peer already exists for domain: ${domain}`);
    }
  },
  TrustPeerInvalidStateError: class extends Error {
    override name = 'TrustPeerInvalidStateError' as const;
    constructor(expected: string, actual: string) {
      super(`Invalid peer state: expected ${expected}, got ${actual}`);
    }
  },
  RemoteMetadataFetchError: class extends Error {
    override name = 'RemoteMetadataFetchError' as const;
    constructor(domain: string) {
      super(`Failed to fetch metadata from ${domain}`);
    }
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

const testOrgId = '10000000-0000-4000-a000-000000000010';
const testUserId = '10000000-0000-4000-a000-000000000020';
const testPeerId = '10000000-0000-4000-a000-000000000001';

const samplePeer = {
  id: testPeerId,
  organizationId: testOrgId,
  domain: 'remote.example.com',
  instanceUrl: 'https://remote.example.com',
  publicKey: '-----BEGIN PUBLIC KEY-----\ntest\n-----END PUBLIC KEY-----',
  keyId: 'remote.example.com#main',
  grantedCapabilities: {},
  status: 'pending_outbound',
  initiatedBy: 'local',
  protocolVersion: '1.0',
  lastVerifiedAt: null,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

const sampleMetadataPreview = {
  domain: 'remote.example.com',
  software: 'colophony',
  version: '2.0.0-dev',
  publicKey: '-----BEGIN PUBLIC KEY-----\ntest\n-----END PUBLIC KEY-----',
  keyId: 'remote.example.com#main',
  capabilities: ['identity'],
  mode: 'allowlist',
  contactEmail: null,
  publicationCount: 1,
};

describe('trust-admin.routes', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    const { registerFederationTrustAdminRoutes } =
      await import('./trust-admin.routes.js');
    app = Fastify({ logger: false });

    // Simulate auth context (as if auth hook already ran)
    app.decorateRequest('authContext', null);
    app.addHook('onRequest', async (request) => {
      request.authContext = {
        userId: testUserId,
        email: 'admin@test.com',
        emailVerified: true,
        authMethod: 'test',
        orgId: testOrgId,
        role: 'ADMIN',
      } as any;
    });

    await registerFederationTrustAdminRoutes(app, { env: testEnv });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /federation/metadata/:domain', () => {
    it('returns preview', async () => {
      mockFetchRemoteMetadata.mockResolvedValueOnce(sampleMetadataPreview);

      const response = await app.inject({
        method: 'GET',
        url: '/federation/metadata/remote.example.com',
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().domain).toBe('remote.example.com');
      expect(response.json().software).toBe('colophony');
    });

    it('returns 502 on fetch failure', async () => {
      const { RemoteMetadataFetchError } =
        await import('../services/trust.service.js');
      mockFetchRemoteMetadata.mockRejectedValueOnce(
        new RemoteMetadataFetchError('bad.example.com'),
      );

      const response = await app.inject({
        method: 'GET',
        url: '/federation/metadata/bad.example.com',
      });

      expect(response.statusCode).toBe(502);
      expect(response.json().error).toBe('remote_fetch_failed');
    });
  });

  describe('POST /federation/peers/initiate', () => {
    it('returns 201', async () => {
      mockInitiateTrust.mockResolvedValueOnce(samplePeer);

      const response = await app.inject({
        method: 'POST',
        url: '/federation/peers/initiate',
        headers: { 'content-type': 'application/json' },
        payload: {
          domain: 'remote.example.com',
          requestedCapabilities: {},
        },
      });

      expect(response.statusCode).toBe(201);
      expect(response.json().domain).toBe('remote.example.com');
    });

    it('returns 409 for duplicate', async () => {
      const { TrustPeerAlreadyExistsError } =
        await import('../services/trust.service.js');
      mockInitiateTrust.mockRejectedValueOnce(
        new TrustPeerAlreadyExistsError('remote.example.com'),
      );

      const response = await app.inject({
        method: 'POST',
        url: '/federation/peers/initiate',
        headers: { 'content-type': 'application/json' },
        payload: {
          domain: 'remote.example.com',
          requestedCapabilities: {},
        },
      });

      expect(response.statusCode).toBe(409);
      expect(response.json().error).toBe('peer_already_exists');
    });
  });

  describe('GET /federation/peers', () => {
    it('returns list', async () => {
      mockListPeers.mockResolvedValueOnce([samplePeer]);

      const response = await app.inject({
        method: 'GET',
        url: '/federation/peers',
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toHaveLength(1);
      expect(response.json()[0].domain).toBe('remote.example.com');
    });
  });

  describe('GET /federation/peers/:id', () => {
    it('returns peer', async () => {
      mockGetPeerById.mockResolvedValueOnce(samplePeer);

      const response = await app.inject({
        method: 'GET',
        url: `/federation/peers/${testPeerId}`,
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().id).toBe(testPeerId);
    });

    it('returns 404 for missing', async () => {
      const { TrustPeerNotFoundError } =
        await import('../services/trust.service.js');
      mockGetPeerById.mockRejectedValueOnce(
        new TrustPeerNotFoundError('missing-id'),
      );

      const response = await app.inject({
        method: 'GET',
        url: `/federation/peers/${testPeerId}`,
      });

      expect(response.statusCode).toBe(404);
      expect(response.json().error).toBe('peer_not_found');
    });
  });

  describe('POST /federation/peers/:id/accept', () => {
    it('returns updated peer', async () => {
      const activePeer = { ...samplePeer, status: 'active' };
      mockAcceptInboundTrust.mockResolvedValueOnce(activePeer);

      const response = await app.inject({
        method: 'POST',
        url: `/federation/peers/${testPeerId}/accept`,
        headers: { 'content-type': 'application/json' },
        payload: { grantedCapabilities: { 'identity.verify': true } },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().status).toBe('active');
    });

    it('returns 409 for wrong state', async () => {
      const { TrustPeerInvalidStateError } =
        await import('../services/trust.service.js');
      mockAcceptInboundTrust.mockRejectedValueOnce(
        new TrustPeerInvalidStateError('pending_inbound', 'active'),
      );

      const response = await app.inject({
        method: 'POST',
        url: `/federation/peers/${testPeerId}/accept`,
        headers: { 'content-type': 'application/json' },
        payload: {},
      });

      expect(response.statusCode).toBe(409);
      expect(response.json().error).toBe('invalid_peer_state');
    });
  });

  describe('POST /federation/peers/:id/reject', () => {
    it('returns updated peer', async () => {
      const rejectedPeer = { ...samplePeer, status: 'rejected' };
      mockRejectTrust.mockResolvedValueOnce(rejectedPeer);

      const response = await app.inject({
        method: 'POST',
        url: `/federation/peers/${testPeerId}/reject`,
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().status).toBe('rejected');
    });
  });

  describe('POST /federation/peers/:id/revoke', () => {
    it('returns updated peer', async () => {
      const revokedPeer = { ...samplePeer, status: 'revoked' };
      mockRevokeTrust.mockResolvedValueOnce(revokedPeer);

      const response = await app.inject({
        method: 'POST',
        url: `/federation/peers/${testPeerId}/revoke`,
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().status).toBe('revoked');
    });
  });
});
