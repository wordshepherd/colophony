import fp from 'fastify-plugin';
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import type { Env } from '../config/env.js';
import { SLIDING_WINDOW_SCRIPT } from './rate-limit.js';

export interface RateLimitAuthPluginOptions {
  env: Env;
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
 * Second-pass rate limiting: user-based, runs after auth.
 *
 * Hook order: ... → auth → **rate-limit-auth** → org-context → ...
 *
 * Only applies to authenticated requests. Uses userId as identifier with
 * AUTH_MAX limit (higher than the IP-based DEFAULT_MAX). Overrides the
 * X-RateLimit-* headers set by the first-pass plugin with the higher values.
 *
 * Shares Redis instance with first-pass plugin via app.rateLimitRedis.
 */
export default fp(
  async function rateLimitAuthPlugin(
    app: FastifyInstance,
    opts: RateLimitAuthPluginOptions,
  ) {
    const { env } = opts;
    const windowMs = env.RATE_LIMIT_WINDOW_SECONDS * 1000;
    const prefix = env.RATE_LIMIT_KEY_PREFIX;
    const limit = env.RATE_LIMIT_AUTH_MAX;

    app.addHook(
      'onRequest',
      async function rateLimitAuthHook(
        request: FastifyRequest,
        reply: FastifyReply,
      ) {
        if (shouldSkip(request)) return;

        // Only run for authenticated requests
        const userId = request.authContext?.userId;
        if (!userId) return;

        const redis = app.rateLimitRedis;
        if (!redis) return;

        const key = `${prefix}:auth:${userId}`;
        const nowMs = Date.now();
        const requestId = `${nowMs}:${Math.random().toString(36).slice(2, 8)}`;

        let count: number;
        let oldestMs = 0;

        try {
          const result = (await redis.eval(
            SLIDING_WINDOW_SCRIPT,
            1,
            key,
            nowMs - windowMs,
            nowMs,
            requestId,
            windowMs,
            limit,
          )) as [number, number];
          count = result[0];
          oldestMs = result[1] ?? 0;
        } catch {
          // Graceful degradation: Redis unavailable → allow request
          request.log.warn(
            'Rate limit auth Redis error — allowing request without rate limiting',
          );
          return;
        }

        const remaining = Math.max(0, limit - count);
        // Reset = when the oldest entry expires (tight estimate)
        const resetMs = oldestMs > 0 ? oldestMs + windowMs : nowMs + windowMs;
        const resetEpochSeconds = Math.ceil(resetMs / 1000);

        // Override headers from first-pass with higher auth limits
        reply.header('X-RateLimit-Limit', limit);
        reply.header('X-RateLimit-Remaining', remaining);
        reply.header('X-RateLimit-Reset', resetEpochSeconds);

        if (count > limit) {
          const retryAfterSeconds = Math.max(
            1,
            Math.ceil((resetMs - nowMs) / 1000),
          );
          reply.header('Retry-After', retryAfterSeconds);
          reply.header('Cache-Control', 'no-store');

          request.log.warn(
            {
              identifier: userId,
              path: request.url,
              count,
              limit,
            },
            'Authenticated rate limit exceeded',
          );

          return reply.status(429).send({
            error: 'rate_limit_exceeded',
            message: 'Too many requests',
          });
        }
      },
    );
  },
  {
    name: 'colophony-rate-limit-auth',
    dependencies: ['colophony-auth', 'colophony-rate-limit'],
    fastify: '5.x',
  },
);
