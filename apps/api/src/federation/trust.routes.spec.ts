import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';
import type { Env } from '../config/env.js';

// Mock trust service
const mockHandleInboundTrustRequest = vi.fn();
const mockHandleInboundTrustAccept = vi.fn();

vi.mock('../services/trust.service.js', () => ({
  trustService: {
    handleInboundTrustRequest: (...args: unknown[]) =>
      mockHandleInboundTrustRequest(...args),
    handleInboundTrustAccept: (...args: unknown[]) =>
      mockHandleInboundTrustAccept(...args),
  },
  TrustSignatureVerificationError: class extends Error {
    override name = 'TrustSignatureVerificationError' as const;
    constructor(reason: string) {
      super(`Signature verification failed: ${reason}`);
    }
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

describe('trust.routes (public S2S)', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    const { registerFederationTrustRoutes } = await import('./trust.routes.js');
    app = Fastify({ logger: false });
    await registerFederationTrustRoutes(app, { env: testEnv });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /federation/trust', () => {
    it('returns 202 for valid signed request', async () => {
      mockHandleInboundTrustRequest.mockResolvedValueOnce({
        orgIds: ['00000000-0000-0000-0000-000000000010'],
      });

      const response = await app.inject({
        method: 'POST',
        url: '/federation/trust',
        headers: {
          'content-type': 'application/json',
          signature: 'test-sig',
          'signature-input': 'test-sig-input',
          date: new Date().toUTCString(),
        },
        payload: {
          instanceUrl: 'https://remote.example.com',
          domain: 'remote.example.com',
          publicKey:
            '-----BEGIN PUBLIC KEY-----\ntest\n-----END PUBLIC KEY-----',
          keyId: 'remote.example.com#main',
          requestedCapabilities: {},
          protocolVersion: '1.0',
        },
      });

      expect(response.statusCode).toBe(202);
      expect(response.json().status).toBe('pending');
    });

    it('returns 400 for invalid body', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/federation/trust',
        headers: { 'content-type': 'application/json' },
        payload: { invalid: true },
      });

      expect(response.statusCode).toBe(400);
      expect(response.json().error).toBe('invalid_request');
    });

    it('returns 401 for invalid signature', async () => {
      const { TrustSignatureVerificationError } =
        await import('../services/trust.service.js');

      mockHandleInboundTrustRequest.mockRejectedValueOnce(
        new TrustSignatureVerificationError('bad sig'),
      );

      const response = await app.inject({
        method: 'POST',
        url: '/federation/trust',
        headers: { 'content-type': 'application/json' },
        payload: {
          instanceUrl: 'https://remote.example.com',
          domain: 'remote.example.com',
          publicKey:
            '-----BEGIN PUBLIC KEY-----\ntest\n-----END PUBLIC KEY-----',
          keyId: 'remote.example.com#main',
          requestedCapabilities: {},
          protocolVersion: '1.0',
        },
      });

      expect(response.statusCode).toBe(401);
      expect(response.json().error).toBe('signature_invalid');
    });
  });

  describe('POST /federation/trust/accept', () => {
    it('returns 200 for valid accept', async () => {
      mockHandleInboundTrustAccept.mockResolvedValueOnce(undefined);

      const response = await app.inject({
        method: 'POST',
        url: '/federation/trust/accept',
        headers: {
          'content-type': 'application/json',
          signature: 'test-sig',
          'signature-input': 'test-sig-input',
        },
        payload: {
          instanceUrl: 'https://remote.example.com',
          domain: 'remote.example.com',
          grantedCapabilities: { 'identity.verify': true },
          protocolVersion: '1.0',
        },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().status).toBe('accepted');
    });

    it('returns 503 when federation disabled', async () => {
      const disabledEnv = { ...testEnv, FEDERATION_ENABLED: false };
      const disabledApp = Fastify({ logger: false });
      const { registerFederationTrustRoutes } =
        await import('./trust.routes.js');
      await registerFederationTrustRoutes(disabledApp, { env: disabledEnv });
      await disabledApp.ready();

      const response = await disabledApp.inject({
        method: 'POST',
        url: '/federation/trust/accept',
        headers: { 'content-type': 'application/json' },
        payload: {
          instanceUrl: 'https://remote.example.com',
          domain: 'remote.example.com',
          grantedCapabilities: {},
          protocolVersion: '1.0',
        },
      });

      expect(response.statusCode).toBe(503);
      expect(response.json().error).toBe('federation_disabled');

      await disabledApp.close();
    });
  });
});
