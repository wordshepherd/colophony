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
 * Sliding-window-log rate limiter using Redis sorted sets.
 *
 * Each request is stored as a scored member (score = timestamp). On each check:
 * 1. Remove expired entries (older than window)
 * 2. Count remaining entries
 * 3. Only add new entry if under limit (prevents unbounded growth during abuse)
 * 4. Set TTL for automatic cleanup
 *
 * ARGV[1]: nowMs - windowMs (oldest allowed timestamp)
 * ARGV[2]: nowMs (current timestamp as score)
 * ARGV[3]: unique request ID (now:random) to prevent dedup
 * ARGV[4]: windowMs (TTL for cleanup)
 * ARGV[5]: max (limit — only add if under limit)
 *
 * Returns: count + 1 (1-indexed like INCR — allowed entries capped at limit)
 *
 * Shared with rate-limit-auth.ts second-pass plugin.
 */
export const SLIDING_WINDOW_SCRIPT = `
redis.call('ZREMRANGEBYSCORE', KEYS[1], 0, ARGV[1])
local count = redis.call('ZCARD', KEYS[1])
if count < tonumber(ARGV[5]) then
  redis.call('ZADD', KEYS[1], ARGV[2], ARGV[3])
end
redis.call('PEXPIRE', KEYS[1], ARGV[4])
return count + 1
`;

/**
 * First-pass rate limiting: IP-based, runs before auth.
 *
 * Hook order: helmet → cors → **rate-limit** → auth → **rate-limit-auth** → org-context → db-context
 *
 * Always uses request.ip + DEFAULT_MAX. This is a DoS shield — it protects
 * the auth system itself. Authenticated users get a higher limit via the
 * second-pass plugin (rate-limit-auth.ts).
 */
export default fp(
  async function rateLimitPlugin(
    app: FastifyInstance,
    opts: RateLimitPluginOptions,
  ) {
    const { env } = opts;
    const windowMs = env.RATE_LIMIT_WINDOW_SECONDS * 1000;
    const prefix = env.RATE_LIMIT_KEY_PREFIX;
    const limit = env.RATE_LIMIT_DEFAULT_MAX;

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

    // Expose redis instance for second-pass plugin to share
    app.decorate('rateLimitRedis', redis);

    app.addHook(
      'onRequest',
      async function rateLimitHook(
        request: FastifyRequest,
        reply: FastifyReply,
      ) {
        if (shouldSkip(request)) return;

        // Always use IP — auth hasn't run yet
        const identifier = request.ip;

        const key = `${prefix}:${identifier}`;
        const nowMs = Date.now();
        const requestId = `${nowMs}:${Math.random().toString(36).slice(2, 8)}`;

        let count: number;

        try {
          count = (await redis.eval(
            SLIDING_WINDOW_SCRIPT,
            1,
            key,
            nowMs - windowMs,
            nowMs,
            requestId,
            windowMs,
            limit,
          )) as number;
        } catch {
          // Graceful degradation: Redis unavailable → allow request
          request.log.warn(
            'Rate limit Redis error — allowing request without rate limiting',
          );
          return;
        }

        const remaining = Math.max(0, limit - count);
        const resetEpochSeconds = Math.ceil((nowMs + windowMs) / 1000);

        reply.header('X-RateLimit-Limit', limit);
        reply.header('X-RateLimit-Remaining', remaining);
        reply.header('X-RateLimit-Reset', resetEpochSeconds);

        if (count > limit) {
          const retryAfterSeconds = Math.ceil(windowMs / 1000);
          reply.header('Retry-After', retryAfterSeconds);
          reply.header('Cache-Control', 'no-store');

          request.log.warn(
            {
              identifier: request.ip,
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
    fastify: '5.x',
  },
);

// Fastify type augmentation for shared redis instance
declare module 'fastify' {
  interface FastifyInstance {
    rateLimitRedis: Redis;
  }
}
