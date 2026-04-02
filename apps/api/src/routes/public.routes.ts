import type { FastifyInstance } from 'fastify';
import { db, organizations, users, demoRequests } from '@colophony/db';
import { eq } from 'drizzle-orm';
import { slugSchema, demoLoginRequestSchema } from '@colophony/types';
import { z } from 'zod';
import { responseTimeTransparencyService } from '../services/response-time-transparency.service.js';
import { getGlobalRegistry } from '../adapters/registry-accessor.js';
import type { EmailAdapter } from '@colophony/plugin-sdk';
import type { Env } from '../config/env.js';

const demoRequestSchema = z.object({
  name: z.string().min(1).max(256),
  email: z.string().email().max(320),
  magazine: z.string().min(1).max(256),
  message: z.string().max(5000).optional(),
});

const DEMO_RATE_LIMIT_MAX = 5;
const DEMO_RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour

// Atomic sliding-window rate limit script (same pattern as global rate limiter)
const DEMO_RATE_LIMIT_SCRIPT = `
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

export async function registerPublicRoutes(
  app: FastifyInstance,
  opts: { env: Env },
) {
  const { env } = opts;

  // ---------------------------------------------------------------------------
  // GET /v1/public/orgs/:slug/response-time — public response time stats
  // ---------------------------------------------------------------------------
  app.get<{ Params: { slug: string } }>(
    '/v1/public/orgs/:slug/response-time',
    async (request, reply) => {
      const parsed = slugSchema.safeParse(request.params.slug);
      if (!parsed.success) {
        return reply.status(400).send({ error: 'Invalid slug' });
      }

      const org = await db.query.organizations.findFirst({
        where: eq(organizations.slug, parsed.data),
        columns: { id: true },
      });
      if (!org) {
        return reply.status(404).send({ error: 'Organization not found' });
      }

      const stats = await responseTimeTransparencyService.getPublicStats(
        org.id,
      );

      void reply.header('Cache-Control', 'public, max-age=300');
      return { responseTimeStats: stats };
    },
  );

  // ---------------------------------------------------------------------------
  // POST /v1/public/demo-requests — demo request form submission
  // ---------------------------------------------------------------------------
  app.post('/v1/public/demo-requests', async (request, reply) => {
    // Per-endpoint rate limit: 5 requests per IP per hour (atomic Lua script)
    const ip = request.ip;
    const redis = app.rateLimitRedis;
    if (redis) {
      try {
        const key = `colophony:demo-req:${ip}`;
        const now = Date.now();
        const windowStart = now - DEMO_RATE_LIMIT_WINDOW_MS;
        const requestId = `${now}:${Math.random().toString(36).slice(2, 8)}`;

        const result = (await redis.eval(
          DEMO_RATE_LIMIT_SCRIPT,
          1,
          key,
          windowStart,
          now,
          requestId,
          DEMO_RATE_LIMIT_WINDOW_MS,
          DEMO_RATE_LIMIT_MAX,
        )) as [number, number];

        const allowed = result[1] === 1;
        if (!allowed) {
          return reply.status(429).send({
            error: 'Too many demo requests. Please try again later.',
          });
        }
      } catch {
        // Graceful degradation — allow request if Redis fails
      }
    }

    // Validate input
    const parsed = demoRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: 'Invalid request',
        details: parsed.error.flatten().fieldErrors,
      });
    }

    const { name, email, magazine, message } = parsed.data;

    // Insert into database
    await db.insert(demoRequests).values({
      name,
      email,
      magazineName: magazine,
      message: message ?? null,
    });

    // Send emails (best-effort — don't fail the request if email fails)
    try {
      const emailAdapter =
        getGlobalRegistry().tryResolve<EmailAdapter>('email');

      if (emailAdapter) {
        // Confirmation to requester
        const confirmResult = await emailAdapter.send({
          to: email,
          subject: 'We received your Colophony demo request',
          html: `<p>Hi ${escapeHtml(name)},</p><p>Thanks for your interest in Colophony for <strong>${escapeHtml(magazine)}</strong>. We'll reach out shortly to schedule a walkthrough.</p><p>— The Colophony Team</p>`,
          text: `Hi ${name},\n\nThanks for your interest in Colophony for ${magazine}. We'll reach out shortly to schedule a walkthrough.\n\n— The Colophony Team`,
        });
        if (!confirmResult.success) {
          app.log.warn(
            { error: confirmResult.error, to: email },
            'Failed to send demo confirmation email',
          );
        }

        // Notification to team
        if (env.DEMO_NOTIFY_EMAIL) {
          const notifyResult = await emailAdapter.send({
            to: env.DEMO_NOTIFY_EMAIL,
            subject: `New demo request: ${magazine}`,
            html: `<p><strong>Name:</strong> ${escapeHtml(name)}</p><p><strong>Email:</strong> ${escapeHtml(email)}</p><p><strong>Magazine:</strong> ${escapeHtml(magazine)}</p><p><strong>Message:</strong> ${escapeHtml(message ?? '(none)')}</p>`,
            text: `Name: ${name}\nEmail: ${email}\nMagazine: ${magazine}\nMessage: ${message ?? '(none)'}`,
          });
          if (!notifyResult.success) {
            app.log.warn(
              { error: notifyResult.error, to: env.DEMO_NOTIFY_EMAIL },
              'Failed to send demo team notification email',
            );
          }
        }
      }
    } catch (err) {
      app.log.warn({ err }, 'Failed to send demo request emails');
    }

    return reply.status(201).send({ success: true });
  });

  // ---------------------------------------------------------------------------
  // POST /v1/public/demo/login — demo login (no auth, DEMO_MODE only)
  // ---------------------------------------------------------------------------
  if (env.DEMO_MODE) {
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

        // Rate limit using the global Redis rate limiter
        const rl = app.rateLimitRedis;
        if (rl) {
          try {
            const ip = request.ip;
            const key = `colophony:demo-login:${ip}`;
            const now = Date.now();
            const windowStart = now - DEMO_LOGIN_RATE_LIMIT_WINDOW_MS;
            const requestId = `${now}:${Math.random().toString(36).slice(2, 8)}`;

            const result = (await rl.eval(
              DEMO_RATE_LIMIT_SCRIPT,
              1,
              key,
              windowStart,
              now,
              requestId,
              DEMO_LOGIN_RATE_LIMIT_WINDOW_MS,
              DEMO_LOGIN_RATE_LIMIT_MAX,
            )) as [number, number];

            if (result[1] === 0) {
              return reply.status(429).send({
                error: 'rate_limited',
                message: 'Too many demo login requests. Try again later.',
              });
            }
          } catch {
            // Graceful degradation — global IP rate limiter still applies
          }
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

    app.log.info('Demo mode enabled — /v1/public/demo/login route registered');
  }
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
