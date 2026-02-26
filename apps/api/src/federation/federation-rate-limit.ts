import fp from 'fastify-plugin';
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import type { Env } from '../config/env.js';
import { SLIDING_WINDOW_SCRIPT } from '../hooks/rate-limit.js';

export interface FederationRateLimitOptions {
  env: Env;
}

/**
 * Per-peer federation rate limiting.
 *
 * Runs as a preHandler after federation-auth or hub-auth.
 * Uses the authenticated peer's domain as the rate limit key.
 * Shares Redis instance with the global rate limiter via app.rateLimitRedis.
 */
export default fp(
  async function federationRateLimitPlugin(
    app: FastifyInstance,
    opts: FederationRateLimitOptions,
  ) {
    const { env } = opts;
    const limit = env.FEDERATION_RATE_LIMIT_MAX;
    const windowMs = env.FEDERATION_RATE_LIMIT_WINDOW_SECONDS * 1000;
    const prefix = env.RATE_LIMIT_KEY_PREFIX;

    app.addHook(
      'preHandler',
      async function federationRateLimitHook(
        request: FastifyRequest,
        reply: FastifyReply,
      ) {
        // Read domain from federation or hub peer context
        const domain =
          request.federationPeer?.domain ?? request.hubPeer?.domain;

        // No peer = unauthenticated; federation-auth already rejected these
        if (!domain) return;

        const redis = app.rateLimitRedis;
        if (!redis) return;

        const key = `${prefix}:fed:${domain}`;
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
          // Fail open: Redis unavailable → allow request
          request.log.warn(
            'Federation rate limit Redis error — allowing request without rate limiting',
          );
          return;
        }

        const remaining = Math.max(0, limit - count);
        const resetMs = oldestMs > 0 ? oldestMs + windowMs : nowMs + windowMs;
        const resetEpochSeconds = Math.ceil(resetMs / 1000);

        // Set federation-specific rate limit headers (overrides IP tier)
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
              identifier: domain,
              path: request.url,
              count,
              limit,
            },
            'Federation peer rate limit exceeded',
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
    name: 'colophony-federation-rate-limit',
    fastify: '5.x',
  },
);
