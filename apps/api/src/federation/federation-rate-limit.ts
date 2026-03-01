import fp from 'fastify-plugin';
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import type { Env } from '../config/env.js';
import { SLIDING_WINDOW_SCRIPT } from '../hooks/rate-limit.js';

const VALID_CAPABILITIES = new Set(['simsub', 'transfer', 'migration', 'hub']);

export interface FederationRateLimitOptions {
  env: Env;
  capability?: string;
}

// ---------------------------------------------------------------------------
// In-process fixed-window rate limiter (fallback when Redis is unavailable)
// ---------------------------------------------------------------------------

interface WindowEntry {
  count: number;
  resetAt: number;
}

export class InProcessRateLimiter {
  private windows = new Map<string, WindowEntry>();
  private cleanupTimer: ReturnType<typeof setInterval>;

  constructor(
    private readonly limit: number = 10,
    private readonly windowMs: number = 60_000,
  ) {
    this.cleanupTimer = setInterval(() => this.cleanup(), this.windowMs);
    this.cleanupTimer.unref();
  }

  check(key: string): {
    allowed: boolean;
    count: number;
    remaining: number;
    resetMs: number;
  } {
    const now = Date.now();
    let entry = this.windows.get(key);

    if (!entry || now >= entry.resetAt) {
      entry = { count: 0, resetAt: now + this.windowMs };
      this.windows.set(key, entry);
    }

    entry.count++;

    return {
      allowed: entry.count <= this.limit,
      count: entry.count,
      remaining: Math.max(0, this.limit - entry.count),
      resetMs: entry.resetAt,
    };
  }

  cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.windows) {
      if (now >= entry.resetAt) {
        this.windows.delete(key);
      }
    }
    // Emergency purge if too many unique keys accumulate between cleanups
    if (this.windows.size > 10_000) {
      this.windows.clear();
    }
  }

  close(): void {
    clearInterval(this.cleanupTimer);
    this.windows.clear();
  }
}

// ---------------------------------------------------------------------------
// Plugin
// ---------------------------------------------------------------------------

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
    const { env, capability } = opts;

    if (capability && !VALID_CAPABILITIES.has(capability)) {
      throw new Error(
        `Invalid federation rate limit capability: '${capability}'. ` +
          `Valid values: ${[...VALID_CAPABILITIES].join(', ')}`,
      );
    }
    const limit = env.FEDERATION_RATE_LIMIT_MAX;
    const windowMs = env.FEDERATION_RATE_LIMIT_WINDOW_SECONDS * 1000;
    const prefix = env.RATE_LIMIT_KEY_PREFIX;
    const failMode = env.FEDERATION_RATE_LIMIT_FAIL_MODE;

    // Fallback limiter: created lazily on first Redis failure in fallback mode
    let fallbackLimiter: InProcessRateLimiter | null = null;

    function getFallbackLimiter(): InProcessRateLimiter {
      if (!fallbackLimiter) {
        fallbackLimiter = new InProcessRateLimiter(10, 60_000);
      }
      return fallbackLimiter;
    }

    app.addHook('onClose', async () => {
      fallbackLimiter?.close();
    });

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

        const key = capability
          ? `${prefix}:fed:${capability}:${domain}`
          : `${prefix}:fed:${domain}`;
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
          // Redis unavailable — branch on fail mode
          if (failMode === 'closed') {
            request.log.error(
              'Federation rate limit Redis error — rejecting request (fail-closed)',
            );
            return reply.status(503).send({
              error: 'service_unavailable',
              message:
                'Rate limiting service unavailable. Please try again later.',
            });
          }

          if (failMode === 'fallback') {
            request.log.warn(
              'Federation rate limit Redis error — using in-process fallback',
            );
            const limiter = getFallbackLimiter();
            const fallbackKey = capability ? `${capability}:${domain}` : domain;
            const result = limiter.check(fallbackKey);

            reply.header('X-RateLimit-Limit', limiter['limit']);
            reply.header('X-RateLimit-Remaining', result.remaining);
            reply.header('X-RateLimit-Reset', Math.ceil(result.resetMs / 1000));

            if (!result.allowed) {
              const retryAfterSeconds = Math.max(
                1,
                Math.ceil((result.resetMs - nowMs) / 1000),
              );
              reply.header('Retry-After', retryAfterSeconds);
              reply.header('Cache-Control', 'no-store');
              return reply.status(429).send({
                error: 'rate_limit_exceeded',
                message: 'Too many requests',
              });
            }
            return;
          }

          // Default: fail-open
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
              capability,
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
