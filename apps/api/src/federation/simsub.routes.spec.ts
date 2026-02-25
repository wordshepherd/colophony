import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';
import type { Env } from '../config/env.js';

// Mock simsub service
const mockHandleInboundCheck = vi.fn();

vi.mock('../services/simsub.service.js', () => ({
  simsubService: {
    handleInboundCheck: (...args: unknown[]) => mockHandleInboundCheck(...args),
  },
}));

// Mock audit service
vi.mock('../services/audit.service.js', () => ({
  auditService: {
    logDirect: vi.fn().mockResolvedValue(undefined),
  },
}));

// Mock federation-auth plugin — stub it so we control federationPeer
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

describe('simsub.routes (S2S)', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = Fastify({ logger: false });

    const { registerSimSubRoutes } = await import('./simsub.routes.js');
    await app.register(async (scope) => {
      await registerSimSubRoutes(scope, { env: testEnv });
    });

    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('returns 503 when federation disabled', async () => {
    federationPeerOverride = { domain: 'peer.com', keyId: 'peer.com#main' };

    const disabledEnv = { ...testEnv, FEDERATION_ENABLED: false };
    const disabledApp = Fastify({ logger: false });

    const { registerSimSubRoutes } = await import('./simsub.routes.js');
    await disabledApp.register(async (scope) => {
      await registerSimSubRoutes(scope, { env: disabledEnv });
    });
    await disabledApp.ready();

    const res = await disabledApp.inject({
      method: 'POST',
      url: '/federation/v1/sim-sub/check',
      payload: {
        fingerprint: 'a'.repeat(64),
        submitterDid: 'did:web:x:users:a',
        requestingDomain: 'remote.com',
      },
    });

    expect(res.statusCode).toBe(503);
    await disabledApp.close();
  });

  it('returns 401 without valid signature', async () => {
    federationPeerOverride = null; // No verified peer

    const res = await app.inject({
      method: 'POST',
      url: '/federation/v1/sim-sub/check',
      payload: {
        fingerprint: 'a'.repeat(64),
        submitterDid: 'did:web:x:users:a',
        requestingDomain: 'remote.com',
      },
    });

    expect(res.statusCode).toBe(401);
  });

  it('returns 400 for invalid request body', async () => {
    federationPeerOverride = { domain: 'peer.com', keyId: 'peer.com#main' };

    const res = await app.inject({
      method: 'POST',
      url: '/federation/v1/sim-sub/check',
      payload: { fingerprint: 'too-short' }, // Invalid
    });

    expect(res.statusCode).toBe(400);
  });

  it('returns found: false when no matching submissions', async () => {
    federationPeerOverride = { domain: 'peer.com', keyId: 'peer.com#main' };
    mockHandleInboundCheck.mockResolvedValue({
      found: false,
      conflicts: [],
    });

    const res = await app.inject({
      method: 'POST',
      url: '/federation/v1/sim-sub/check',
      payload: {
        fingerprint: 'a'.repeat(64),
        submitterDid: 'did:web:peer.com:users:alice',
        requestingDomain: 'peer.com',
      },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().found).toBe(false);
  });

  it('returns found: true with conflict details', async () => {
    federationPeerOverride = { domain: 'peer.com', keyId: 'peer.com#main' };
    mockHandleInboundCheck.mockResolvedValue({
      found: true,
      conflicts: [
        {
          publicationName: 'Lit Mag A',
          submittedAt: '2026-01-01T00:00:00Z',
        },
      ],
    });

    const res = await app.inject({
      method: 'POST',
      url: '/federation/v1/sim-sub/check',
      payload: {
        fingerprint: 'b'.repeat(64),
        submitterDid: 'did:web:peer.com:users:bob',
        requestingDomain: 'peer.com',
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.found).toBe(true);
    expect(body.conflicts).toHaveLength(1);
    expect(body.conflicts[0].publicationName).toBe('Lit Mag A');
  });
});
