import type { FastifyInstance } from 'fastify';
import { db, users, organizations } from '@colophony/db';
import { eq } from 'drizzle-orm';
import { demoLoginRequestSchema } from '@colophony/types';
import type { Env } from '../config/env.js';

/**
 * Demo user config — maps role to a stable user ID from seed-demo.ts.
 * These IDs must match the exported DEMO_WRITER_ID / DEMO_EDITOR_ID constants.
 */
const DEMO_USERS: Record<
  'writer' | 'editor',
  { userId: string; orgSlug: string }
> = {
  writer: {
    userId: '00000000-0000-4000-a000-000000000001',
    orgSlug: 'meridian-review',
  },
  editor: {
    userId: '00000000-0000-4000-a000-000000000002',
    orgSlug: 'meridian-review',
  },
};

const DEMO_LOGIN_RATE_LIMIT_MAX = 20;
const DEMO_LOGIN_RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour

const RATE_LIMIT_SCRIPT = `
local key = KEYS[1]
local windowStart = tonumber(ARGV[1])
local now = tonumber(ARGV[2])
local requestId = ARGV[3]
local windowMs = tonumber(ARGV[4])
local limit = tonumber(ARGV[5])
redis.call('ZREMRANGEBYSCORE', key, 0, windowStart)
local count = redis.call('ZCARD', key)
if count >= limit then
  return {count, 0}
end
redis.call('ZADD', key, now, requestId)
redis.call('PEXPIRE', key, windowMs)
return {count + 1, 1}
`;

export async function registerDemoRoutes(
  app: FastifyInstance,
  opts: { env: Env },
) {
  const { env } = opts;

  // In-memory rate limiter (fallback when Redis is unavailable)
  const ipRequests = new Map<string, { count: number; windowStart: number }>();

  function checkInMemoryRateLimit(ip: string): boolean {
    const now = Date.now();
    const entry = ipRequests.get(ip);
    if (!entry || now - entry.windowStart >= DEMO_LOGIN_RATE_LIMIT_WINDOW_MS) {
      ipRequests.set(ip, { count: 1, windowStart: now });
      return true;
    }
    if (entry.count >= DEMO_LOGIN_RATE_LIMIT_MAX) {
      return false;
    }
    entry.count++;
    return true;
  }

  // Lazy Redis import — demo routes only registered when DEMO_MODE=true
  let redis: import('ioredis').default | null = null;
  try {
    const { default: Redis } = await import('ioredis');
    redis = new Redis({
      host: env.REDIS_HOST,
      port: env.REDIS_PORT,
      password: env.REDIS_PASSWORD || undefined,
      lazyConnect: true,
      maxRetriesPerRequest: 1,
    });
    await redis.connect();
  } catch {
    app.log.warn(
      'Demo rate limiter: Redis unavailable — using in-memory fallback',
    );
  }

  app.addHook('onClose', async () => {
    await redis?.quit().catch(() => {});
  });

  // ---------------------------------------------------------------------------
  // POST /v1/public/demo/login — demo login (no auth required)
  // ---------------------------------------------------------------------------
  app.post<{ Body: { role: string } }>(
    '/v1/public/demo/login',
    async (request, reply) => {
      const parsed = demoLoginRequestSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          error: 'validation_error',
          message: 'Invalid role. Must be "writer" or "editor".',
        });
      }

      const { role } = parsed.data;

      // Rate limit (Redis primary, in-memory fallback)
      let rateLimitPassed = false;
      if (redis) {
        try {
          const ip = request.ip;
          const key = `demo-login-rl:${ip}`;
          const now = Date.now();
          const windowStart = now - DEMO_LOGIN_RATE_LIMIT_WINDOW_MS;
          const requestId = `${now}:${Math.random().toString(36).slice(2, 8)}`;

          const result = (await redis.eval(
            RATE_LIMIT_SCRIPT,
            1,
            key,
            windowStart,
            now,
            requestId,
            DEMO_LOGIN_RATE_LIMIT_WINDOW_MS,
            DEMO_LOGIN_RATE_LIMIT_MAX,
          )) as [number, number];

          rateLimitPassed = result[1] === 1;
        } catch {
          // Redis error — fall through to in-memory
          rateLimitPassed = checkInMemoryRateLimit(request.ip);
        }
      } else {
        rateLimitPassed = checkInMemoryRateLimit(request.ip);
      }

      if (!rateLimitPassed) {
        return reply.status(429).send({
          error: 'rate_limited',
          message: 'Too many demo login requests. Try again later.',
        });
      }

      const config = DEMO_USERS[role];

      // Look up user
      const [user] = await db
        .select({
          id: users.id,
          displayName: users.displayName,
          email: users.email,
        })
        .from(users)
        .where(eq(users.id, config.userId))
        .limit(1);

      if (!user) {
        return reply.status(503).send({
          error: 'demo_not_ready',
          message: 'Demo data is not seeded. Please try again later.',
        });
      }

      // Look up org
      const [org] = await db
        .select({ id: organizations.id, slug: organizations.slug })
        .from(organizations)
        .where(eq(organizations.slug, config.orgSlug))
        .limit(1);

      if (!org) {
        return reply.status(503).send({
          error: 'demo_not_ready',
          message: 'Demo organization not found. Please try again later.',
        });
      }

      return reply.status(200).send({
        userId: user.id,
        displayName: user.displayName ?? user.email,
        email: user.email,
        orgId: org.id,
        orgSlug: org.slug,
        role,
      });
    },
  );
}
