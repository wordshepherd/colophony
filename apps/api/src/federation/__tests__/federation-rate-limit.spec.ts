import { describe, it, expect, vi, beforeEach } from 'vitest';
import Fastify from 'fastify';
import type { FastifyInstance } from 'fastify';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('../../hooks/rate-limit.js', () => ({
  SLIDING_WINDOW_SCRIPT: 'mock-lua-script',
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const baseEnv = {
  FEDERATION_RATE_LIMIT_MAX: 60,
  FEDERATION_RATE_LIMIT_WINDOW_SECONDS: 60,
  RATE_LIMIT_KEY_PREFIX: 'test:rl',
} as any;

function createMockRedis(evalResult: [number, number] = [1, 0]) {
  return {
    eval: vi.fn().mockResolvedValue(evalResult),
  };
}

interface PeerConfig {
  type: 'federation' | 'hub';
  domain: string;
  keyId: string;
  instanceId?: string;
}

async function buildApp(
  redis: ReturnType<typeof createMockRedis> | null,
  env = baseEnv,
  peer?: PeerConfig,
  capability?: string,
): Promise<FastifyInstance> {
  const app = Fastify({ logger: false });

  // Decorate with federation/hub peer context (as done by federation-auth/hub-auth)
  app.decorateRequest('federationPeer', null);
  app.decorateRequest('hubPeer', null);

  // Decorate with rateLimitRedis (as done by rate-limit plugin)
  app.decorate('rateLimitRedis', redis as any);

  // Optionally set peer context before auth plugin runs
  if (peer) {
    app.addHook('onRequest', async (request) => {
      if (peer.type === 'federation') {
        request.federationPeer = {
          domain: peer.domain,
          keyId: peer.keyId,
        };
      } else {
        request.hubPeer = {
          domain: peer.domain,
          keyId: peer.keyId,
          instanceId: peer.instanceId ?? 'inst-1',
        };
      }
    });
  }

  // Register the plugin under test
  const mod = await import('../federation-rate-limit.js');
  await app.register(mod.default as any, { env, capability });

  // Test route
  app.get('/test', async (_request, reply) => {
    return reply.send({ ok: true });
  });

  await app.ready();
  return app;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('federation-rate-limit', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('allows requests under the limit', async () => {
    const redis = createMockRedis([5, Date.now() - 1000]);
    const app = await buildApp(redis, baseEnv, {
      type: 'federation',
      domain: 'peer.example.com',
      keyId: 'peer.example.com#main',
    });

    const res = await app.inject({ method: 'GET', url: '/test' });

    expect(res.statusCode).toBe(200);
    expect(redis.eval).toHaveBeenCalled();
    await app.close();
  });

  it('rejects requests over the limit', async () => {
    const redis = createMockRedis([61, Date.now() - 5000]);
    const app = await buildApp(redis, baseEnv, {
      type: 'federation',
      domain: 'evil.example.com',
      keyId: 'evil.example.com#main',
    });

    const res = await app.inject({ method: 'GET', url: '/test' });

    expect(res.statusCode).toBe(429);
    expect(res.headers['retry-after']).toBeDefined();
    expect(JSON.parse(res.body)).toEqual({
      error: 'rate_limit_exceeded',
      message: 'Too many requests',
    });
    await app.close();
  });

  it('uses federationPeer.domain as key', async () => {
    const redis = createMockRedis([1, 0]);
    const app = await buildApp(redis, baseEnv, {
      type: 'federation',
      domain: 'peer.example.com',
      keyId: 'peer.example.com#main',
    });

    await app.inject({ method: 'GET', url: '/test' });

    expect(redis.eval).toHaveBeenCalledWith(
      'mock-lua-script',
      1,
      'test:rl:fed:peer.example.com',
      expect.any(Number),
      expect.any(Number),
      expect.any(String),
      60_000,
      60,
    );
    await app.close();
  });

  it('uses hubPeer.domain when federationPeer is absent', async () => {
    const redis = createMockRedis([1, 0]);
    const app = await buildApp(redis, baseEnv, {
      type: 'hub',
      domain: 'hub-peer.example.com',
      keyId: 'hub-peer.example.com#main',
    });

    await app.inject({ method: 'GET', url: '/test' });

    expect(redis.eval).toHaveBeenCalledWith(
      'mock-lua-script',
      1,
      'test:rl:fed:hub-peer.example.com',
      expect.any(Number),
      expect.any(Number),
      expect.any(String),
      60_000,
      60,
    );
    await app.close();
  });

  it('skips when no peer context', async () => {
    const redis = createMockRedis();
    const app = await buildApp(redis);

    const res = await app.inject({ method: 'GET', url: '/test' });

    expect(res.statusCode).toBe(200);
    expect(redis.eval).not.toHaveBeenCalled();
    await app.close();
  });

  it('fails open on Redis error', async () => {
    const redis = createMockRedis();
    redis.eval.mockRejectedValueOnce(new Error('Redis connection lost'));
    const app = await buildApp(redis, baseEnv, {
      type: 'federation',
      domain: 'peer.example.com',
      keyId: 'peer.example.com#main',
    });

    const res = await app.inject({ method: 'GET', url: '/test' });

    expect(res.statusCode).toBe(200);
    await app.close();
  });

  it('sets X-RateLimit-* headers', async () => {
    const redis = createMockRedis([10, Date.now() - 30_000]);
    const app = await buildApp(redis, baseEnv, {
      type: 'federation',
      domain: 'peer.example.com',
      keyId: 'peer.example.com#main',
    });

    const res = await app.inject({ method: 'GET', url: '/test' });

    expect(res.statusCode).toBe(200);
    expect(res.headers['x-ratelimit-limit']).toBe('60');
    expect(res.headers['x-ratelimit-remaining']).toBe('50');
    expect(res.headers['x-ratelimit-reset']).toBeDefined();
    await app.close();
  });

  it('uses configurable limits from env', async () => {
    const customEnv = {
      ...baseEnv,
      FEDERATION_RATE_LIMIT_MAX: 10,
      FEDERATION_RATE_LIMIT_WINDOW_SECONDS: 30,
    };
    const redis = createMockRedis([1, 0]);
    const app = await buildApp(redis, customEnv, {
      type: 'federation',
      domain: 'peer.example.com',
      keyId: 'peer.example.com#main',
    });

    await app.inject({ method: 'GET', url: '/test' });

    expect(redis.eval).toHaveBeenCalledWith(
      'mock-lua-script',
      1,
      'test:rl:fed:peer.example.com',
      expect.any(Number),
      expect.any(Number),
      expect.any(String),
      30_000, // 30 seconds in ms
      10, // custom limit
    );
    await app.close();
  });

  it('uses capability in key when provided', async () => {
    const redis = createMockRedis([1, 0]);
    const app = await buildApp(
      redis,
      baseEnv,
      {
        type: 'federation',
        domain: 'peer.example.com',
        keyId: 'peer.example.com#main',
      },
      'simsub',
    );

    await app.inject({ method: 'GET', url: '/test' });

    expect(redis.eval).toHaveBeenCalledWith(
      'mock-lua-script',
      1,
      'test:rl:fed:simsub:peer.example.com',
      expect.any(Number),
      expect.any(Number),
      expect.any(String),
      60_000,
      60,
    );
    await app.close();
  });

  it('falls back to global key when capability omitted', async () => {
    const redis = createMockRedis([1, 0]);
    const app = await buildApp(redis, baseEnv, {
      type: 'federation',
      domain: 'peer.example.com',
      keyId: 'peer.example.com#main',
    });

    await app.inject({ method: 'GET', url: '/test' });

    expect(redis.eval).toHaveBeenCalledWith(
      'mock-lua-script',
      1,
      'test:rl:fed:peer.example.com',
      expect.any(Number),
      expect.any(Number),
      expect.any(String),
      60_000,
      60,
    );
    await app.close();
  });

  it('different capabilities produce different keys', async () => {
    const redisSimsub = createMockRedis([1, 0]);
    const appSimsub = await buildApp(
      redisSimsub,
      baseEnv,
      {
        type: 'federation',
        domain: 'peer.example.com',
        keyId: 'peer.example.com#main',
      },
      'simsub',
    );

    const redisTransfer = createMockRedis([1, 0]);
    const appTransfer = await buildApp(
      redisTransfer,
      baseEnv,
      {
        type: 'federation',
        domain: 'peer.example.com',
        keyId: 'peer.example.com#main',
      },
      'transfer',
    );

    await appSimsub.inject({ method: 'GET', url: '/test' });
    await appTransfer.inject({ method: 'GET', url: '/test' });

    const simsubKey = redisSimsub.eval.mock.calls[0][2];
    const transferKey = redisTransfer.eval.mock.calls[0][2];

    expect(simsubKey).toBe('test:rl:fed:simsub:peer.example.com');
    expect(transferKey).toBe('test:rl:fed:transfer:peer.example.com');
    expect(simsubKey).not.toBe(transferKey);

    await appSimsub.close();
    await appTransfer.close();
  });
});
