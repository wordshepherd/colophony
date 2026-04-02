import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';
import type { Env } from '../config/env.js';

// Mock federation service
const mockGetInstanceMetadata = vi.fn();
const mockResolveWebFinger = vi.fn();

vi.mock('../services/federation.service.js', () => ({
  federationService: {
    getInstanceMetadata: (...args: unknown[]) =>
      mockGetInstanceMetadata(...args),
    resolveWebFinger: (...args: unknown[]) => mockResolveWebFinger(...args),
  },
  FederationDisabledError: class extends Error {
    override name = 'FederationDisabledError' as const;
  },
  FederationNotConfiguredError: class extends Error {
    override name = 'FederationNotConfiguredError' as const;
  },
  WebFingerUserNotFoundError: class extends Error {
    override name = 'WebFingerUserNotFoundError' as const;
  },
  WebFingerDomainMismatchError: class extends Error {
    override name = 'WebFingerDomainMismatchError' as const;
  },
}));

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
  DEMO_MODE: false,
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
  WEBHOOK_HEALTH_ZITADEL_STALE_SECONDS: 3600,
  WEBHOOK_HEALTH_STRIPE_STALE_SECONDS: 86400,
  WEBHOOK_HEALTH_DOCUMENSO_STALE_SECONDS: 86400,
};

describe('Federation Discovery Routes', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    const { registerFederationDiscoveryRoutes } =
      await import('./discovery.routes.js');
    app = Fastify({ logger: false });
    await registerFederationDiscoveryRoutes(app, { env: testEnv });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /.well-known/colophony', () => {
    it('returns 200 with instance metadata', async () => {
      mockGetInstanceMetadata.mockResolvedValueOnce({
        software: 'colophony',
        version: '2.0.0-dev',
        domain: 'magazine.example',
        publicKey: 'pub-key',
        keyId: 'magazine.example#main',
        capabilities: ['identity'],
        mode: 'allowlist',
        contactEmail: null,
        publications: [],
        trustedPeers: [],
      });

      const response = await app.inject({
        method: 'GET',
        url: '/.well-known/colophony',
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.software).toBe('colophony');
      expect(body.domain).toBe('magazine.example');
    });

    it('returns 503 when federation is disabled in DB', async () => {
      const { FederationDisabledError } =
        await import('../services/federation.service.js');
      mockGetInstanceMetadata.mockRejectedValueOnce(
        new FederationDisabledError(),
      );

      const response = await app.inject({
        method: 'GET',
        url: '/.well-known/colophony',
      });

      expect(response.statusCode).toBe(503);
      expect(response.json().error).toBe('federation_disabled');
    });

    it('returns Cache-Control header', async () => {
      mockGetInstanceMetadata.mockResolvedValueOnce({
        software: 'colophony',
        version: '2.0.0-dev',
        domain: 'magazine.example',
        publicKey: 'pub-key',
        keyId: 'magazine.example#main',
        capabilities: ['identity'],
        mode: 'allowlist',
        contactEmail: null,
        publications: [],
        trustedPeers: [],
      });

      const response = await app.inject({
        method: 'GET',
        url: '/.well-known/colophony',
      });

      expect(response.headers['cache-control']).toBe('public, max-age=3600');
    });

    it('returns trustedPeers in response', async () => {
      mockGetInstanceMetadata.mockResolvedValueOnce({
        software: 'colophony',
        version: '2.0.0-dev',
        domain: 'magazine.example',
        publicKey: 'pub-key',
        keyId: 'magazine.example#main',
        capabilities: ['identity'],
        mode: 'allowlist',
        contactEmail: null,
        publications: [],
        trustedPeers: ['peer.example'],
      });

      const response = await app.inject({
        method: 'GET',
        url: '/.well-known/colophony',
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.trustedPeers).toEqual(['peer.example']);
    });
  });

  describe('GET /.well-known/webfinger', () => {
    it('returns 200 with JRD for valid resource', async () => {
      mockResolveWebFinger.mockResolvedValueOnce({
        subject: 'acct:alice@magazine.example',
        aliases: ['did:web:magazine.example:users:alice'],
        links: [
          {
            rel: 'self',
            type: 'application/activity+json',
            href: 'https://magazine.example/users/alice',
          },
        ],
      });

      const response = await app.inject({
        method: 'GET',
        url: '/.well-known/webfinger?resource=acct:alice@magazine.example',
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers['content-type']).toContain(
        'application/jrd+json',
      );
      const body = response.json();
      expect(body.subject).toBe('acct:alice@magazine.example');
    });

    it('returns 400 for missing resource param', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/.well-known/webfinger',
      });

      expect(response.statusCode).toBe(400);
    });

    it('returns 400 for invalid resource format', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/.well-known/webfinger?resource=',
      });

      expect(response.statusCode).toBe(400);
    });

    it('returns 404 for unknown user', async () => {
      const { WebFingerUserNotFoundError } =
        await import('../services/federation.service.js');
      mockResolveWebFinger.mockRejectedValueOnce(
        new WebFingerUserNotFoundError('acct:nobody@magazine.example'),
      );

      const response = await app.inject({
        method: 'GET',
        url: '/.well-known/webfinger?resource=acct:nobody@magazine.example',
      });

      expect(response.statusCode).toBe(404);
    });

    it('returns 404 for wrong domain', async () => {
      const { WebFingerDomainMismatchError } =
        await import('../services/federation.service.js');
      mockResolveWebFinger.mockRejectedValueOnce(
        new WebFingerDomainMismatchError('other.example'),
      );

      const response = await app.inject({
        method: 'GET',
        url: '/.well-known/webfinger?resource=acct:alice@other.example',
      });

      expect(response.statusCode).toBe(404);
    });

    it('returns 503 when federation is disabled in DB', async () => {
      const { FederationDisabledError } =
        await import('../services/federation.service.js');
      mockResolveWebFinger.mockRejectedValueOnce(new FederationDisabledError());

      const response = await app.inject({
        method: 'GET',
        url: '/.well-known/webfinger?resource=acct:alice@magazine.example',
      });

      expect(response.statusCode).toBe(503);
      expect(response.json().error).toBe('federation_disabled');
    });

    it('includes CORS header', async () => {
      mockResolveWebFinger.mockResolvedValueOnce({
        subject: 'acct:alice@magazine.example',
        aliases: [],
        links: [],
      });

      const response = await app.inject({
        method: 'GET',
        url: '/.well-known/webfinger?resource=acct:alice@magazine.example',
      });

      expect(response.headers['access-control-allow-origin']).toBe('*');
    });
  });
});
