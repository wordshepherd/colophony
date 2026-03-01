import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';
import type { Env } from '../config/env.js';

// Mock federation service
const mockGetInstanceDidDocument = vi.fn();
const mockGetUserDidDocument = vi.fn();

vi.mock('../services/federation.service.js', () => ({
  federationService: {
    getInstanceDidDocument: (...args: unknown[]) =>
      mockGetInstanceDidDocument(...args),
    getUserDidDocument: (...args: unknown[]) => mockGetUserDidDocument(...args),
  },
  FederationDisabledError: class extends Error {
    override name = 'FederationDisabledError' as const;
  },
  FederationNotConfiguredError: class extends Error {
    override name = 'FederationNotConfiguredError' as const;
  },
  UserDidNotFoundError: class extends Error {
    override name = 'UserDidNotFoundError' as const;
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
  FEDERATION_RATE_LIMIT_MAX: 60,
  FEDERATION_RATE_LIMIT_WINDOW_SECONDS: 60,
  FEDERATION_DOMAIN: 'magazine.example',
  INNGEST_DEV: false,
  EMAIL_PROVIDER: 'none' as const,
  SMTP_SECURE: false,
  SENTRY_ENVIRONMENT: 'test',
  SENTRY_TRACES_SAMPLE_RATE: 0,
  METRICS_ENABLED: false,
  STATUS_TOKEN_TTL_DAYS: 90,
  FEDERATION_RATE_LIMIT_FAIL_MODE: 'open' as const,
};

const sampleInstanceDoc = {
  '@context': [
    'https://www.w3.org/ns/did/v1',
    'https://w3id.org/security/suites/jws-2020/v1',
  ],
  id: 'did:web:magazine.example',
  verificationMethod: [
    {
      id: 'did:web:magazine.example#main',
      type: 'JsonWebKey2020',
      controller: 'did:web:magazine.example',
      publicKeyJwk: { kty: 'OKP', crv: 'Ed25519', x: 'test-x-value' },
    },
  ],
  authentication: ['did:web:magazine.example#main'],
  assertionMethod: ['did:web:magazine.example#main'],
  service: [
    {
      id: 'did:web:magazine.example#federation',
      type: 'ColophonyFederation',
      serviceEndpoint: 'https://magazine.example/.well-known/colophony',
    },
  ],
};

const sampleUserDoc = {
  '@context': [
    'https://www.w3.org/ns/did/v1',
    'https://w3id.org/security/suites/jws-2020/v1',
  ],
  id: 'did:web:magazine.example:users:alice',
  verificationMethod: [
    {
      id: 'did:web:magazine.example:users:alice#key-1',
      type: 'JsonWebKey2020',
      controller: 'did:web:magazine.example:users:alice',
      publicKeyJwk: { kty: 'OKP', crv: 'Ed25519', x: 'user-x-value' },
    },
  ],
  authentication: ['did:web:magazine.example:users:alice#key-1'],
  assertionMethod: ['did:web:magazine.example:users:alice#key-1'],
  service: [
    {
      id: 'did:web:magazine.example:users:alice#submitter',
      type: 'ColophonySubmitter',
      serviceEndpoint: 'https://magazine.example/users/alice',
    },
  ],
};

describe('Federation DID Routes', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    const { registerFederationDidRoutes } = await import('./did.routes.js');
    app = Fastify({ logger: false });
    await registerFederationDidRoutes(app, { env: testEnv });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /.well-known/did.json', () => {
    it('returns 200 with valid instance DID document', async () => {
      mockGetInstanceDidDocument.mockResolvedValueOnce(sampleInstanceDoc);

      const response = await app.inject({
        method: 'GET',
        url: '/.well-known/did.json',
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body['@context']).toContain('https://www.w3.org/ns/did/v1');
      expect(body.id).toBe('did:web:magazine.example');
      expect(body.verificationMethod[0].type).toBe('JsonWebKey2020');
    });

    it('instance DID has Cache-Control max-age=3600', async () => {
      mockGetInstanceDidDocument.mockResolvedValueOnce(sampleInstanceDoc);

      const response = await app.inject({
        method: 'GET',
        url: '/.well-known/did.json',
      });

      expect(response.headers['cache-control']).toBe('public, max-age=3600');
    });

    it('instance DID returns 503 when federation disabled', async () => {
      const { FederationDisabledError } =
        await import('../services/federation.service.js');
      mockGetInstanceDidDocument.mockRejectedValueOnce(
        new FederationDisabledError(),
      );

      const response = await app.inject({
        method: 'GET',
        url: '/.well-known/did.json',
      });

      expect(response.statusCode).toBe(503);
      expect(response.json().error).toBe('federation_unavailable');
    });

    it('instance DID returns 503 when federation not configured', async () => {
      const { FederationNotConfiguredError } =
        await import('../services/federation.service.js');
      mockGetInstanceDidDocument.mockRejectedValueOnce(
        new FederationNotConfiguredError(),
      );

      const response = await app.inject({
        method: 'GET',
        url: '/.well-known/did.json',
      });

      expect(response.statusCode).toBe(503);
      expect(response.json().error).toBe('federation_unavailable');
    });

    it('instance DID includes CORS headers', async () => {
      mockGetInstanceDidDocument.mockResolvedValueOnce(sampleInstanceDoc);

      const response = await app.inject({
        method: 'GET',
        url: '/.well-known/did.json',
        headers: { origin: 'https://other.example' },
      });

      expect(response.headers['access-control-allow-origin']).toBe(
        'https://other.example',
      );
    });
  });

  describe('GET /users/:localPart/did.json', () => {
    it('returns 200 with valid user DID document', async () => {
      mockGetUserDidDocument.mockResolvedValueOnce(sampleUserDoc);

      const response = await app.inject({
        method: 'GET',
        url: '/users/alice/did.json',
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.id).toBe('did:web:magazine.example:users:alice');
      expect(body.verificationMethod[0].publicKeyJwk.kty).toBe('OKP');
      expect(body.service[0].type).toBe('ColophonySubmitter');
    });

    it('user DID has Cache-Control max-age=300', async () => {
      mockGetUserDidDocument.mockResolvedValueOnce(sampleUserDoc);

      const response = await app.inject({
        method: 'GET',
        url: '/users/alice/did.json',
      });

      expect(response.headers['cache-control']).toBe('public, max-age=300');
    });

    it('user DID returns 404 for unknown user', async () => {
      const { UserDidNotFoundError } =
        await import('../services/federation.service.js');
      mockGetUserDidDocument.mockRejectedValueOnce(
        new UserDidNotFoundError('nobody'),
      );

      const response = await app.inject({
        method: 'GET',
        url: '/users/nobody/did.json',
      });

      expect(response.statusCode).toBe(404);
      expect(response.json().error).toBe('not_found');
    });

    it('user DID returns 503 when federation disabled', async () => {
      const { FederationDisabledError } =
        await import('../services/federation.service.js');
      mockGetUserDidDocument.mockRejectedValueOnce(
        new FederationDisabledError(),
      );

      const response = await app.inject({
        method: 'GET',
        url: '/users/alice/did.json',
      });

      expect(response.statusCode).toBe(503);
    });

    it('sanitizes localPart parameter', async () => {
      const callsBefore = mockGetUserDidDocument.mock.calls.length;

      const response = await app.inject({
        method: 'GET',
        url: '/users/..%2F..%2Fetc/did.json',
      });

      expect(response.statusCode).toBe(400);
      expect(response.json().error).toBe('invalid_local_part');
      // No new calls to getUserDidDocument after this request
      expect(mockGetUserDidDocument.mock.calls.length).toBe(callsBefore);
    });
  });
});
