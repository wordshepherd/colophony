import fp from 'fastify-plugin';
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import Redis from 'ioredis';
import type { Env } from '../config/env.js';

export interface RateLimitPluginOptions {
  env: Env;
  /** Override Redis instance for testing. */
  redis?: Redis;
}

/** Routes that skip rate limiting entirely. */
const SKIP_PREFIXES = ['/health', '/ready', '/webhooks/', '/.well-known/'];
const SKIP_EXACT = ['/', '/health', '/ready'];

function shouldSkip(request: FastifyRequest): boolean {
  if (request.method === 'OPTIONS') return true;
  const path = request.url.split('?')[0];
  if (SKIP_EXACT.includes(path)) return true;
  return SKIP_PREFIXES.some((prefix) => path.startsWith(prefix));
}

/**
 * Atomic Lua script: INCR key, set PEXPIRE on first hit, return [count, pttl].
 * Single round-trip, no race condition between INCR and EXPIRE.
 */
const LUA_SCRIPT = `
local current = redis.call('INCR', KEYS[1])
if current == 1 then
  redis.call('PEXPIRE', KEYS[1], ARGV[1])
end
local ttl = redis.call('PTTL', KEYS[1])
return { current, ttl }
`;

/**
 * Rate limiting Fastify plugin using Redis fixed window counter.
 *
 * Hook order: helmet → cors → auth → **rate-limit** → org-context → db-context
 *
 * Future extensions:
 * - GraphQL cost-based rate limiting (deduct N tokens per query complexity)
 * - Per-org quotas tied to billing plans
 * - Sliding window algorithm upgrade (replace Lua script, same key format)
 */
export default fp(
  async function rateLimitPlugin(
    app: FastifyInstance,
    opts: RateLimitPluginOptions,
  ) {
    const { env } = opts;
    const windowMs = env.RATE_LIMIT_WINDOW_SECONDS * 1000;
    const prefix = env.RATE_LIMIT_KEY_PREFIX;

    // Dedicated Redis client for rate limiting — separate from BullMQ
    const redis =
      opts.redis ??
      new Redis({
        host: env.REDIS_HOST,
        port: env.REDIS_PORT,
        password: env.REDIS_PASSWORD || undefined,
        lazyConnect: true,
        enableOfflineQueue: false,
        maxRetriesPerRequest: 0,
        connectTimeout: 5000,
        commandTimeout: 1000,
      });

    if (!opts.redis) {
      try {
        await redis.connect();
        app.log.info('Rate limit Redis client connected');
      } catch (err) {
        app.log.warn(
          { err },
          'Rate limit Redis unavailable — requests will be allowed without rate limiting',
        );
      }
    }

    app.addHook(
      'onRequest',
      async function rateLimitHook(
        request: FastifyRequest,
        reply: FastifyReply,
      ) {
        if (shouldSkip(request)) return;

        const isAuthenticated = !!request.authContext?.userId;
        const identifier = isAuthenticated
          ? request.authContext!.userId
          : request.ip;
        const limit = isAuthenticated
          ? env.RATE_LIMIT_AUTH_MAX
          : env.RATE_LIMIT_DEFAULT_MAX;

        const windowId = Math.floor(Date.now() / windowMs);
        const key = `${prefix}:${env.RATE_LIMIT_WINDOW_SECONDS}:${windowId}:${identifier}`;

        let count: number;
        let ttlMs: number;

        try {
          const result = (await redis.eval(LUA_SCRIPT, 1, key, windowMs)) as [
            number,
            number,
          ];
          count = result[0];
          ttlMs = result[1];
        } catch {
          // Graceful degradation: Redis unavailable → allow request
          request.log.warn(
            'Rate limit Redis error — allowing request without rate limiting',
          );
          return;
        }

        const remaining = Math.max(0, limit - count);
        const resetEpochSeconds = Math.ceil(
          (Date.now() + Math.max(0, ttlMs)) / 1000,
        );

        reply.header('X-RateLimit-Limit', limit);
        reply.header('X-RateLimit-Remaining', remaining);
        reply.header('X-RateLimit-Reset', resetEpochSeconds);

        if (count > limit) {
          const retryAfterSeconds = Math.ceil(Math.max(0, ttlMs) / 1000);
          reply.header('Retry-After', retryAfterSeconds);
          reply.header('Cache-Control', 'no-store');

          request.log.warn(
            {
              identifier: isAuthenticated
                ? request.authContext!.userId
                : request.ip,
              path: request.url,
              count,
              limit,
            },
            'Rate limit exceeded',
          );

          return reply.status(429).send({
            error: 'rate_limit_exceeded',
            message: 'Too many requests',
          });
        }
      },
    );

    // Clean up Redis connection on app close
    app.addHook('onClose', async () => {
      if (!opts.redis) {
        await redis.quit().catch(() => {
          // Ignore quit errors during shutdown
        });
      }
    });
  },
  {
    name: 'colophony-rate-limit',
    dependencies: ['colophony-auth'],
    fastify: '5.x',
  },
);
