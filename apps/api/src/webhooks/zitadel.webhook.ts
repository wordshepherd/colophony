import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { drizzle } from 'drizzle-orm/node-postgres';
import Redis from 'ioredis';
import {
  verifyZitadelSignature,
  zitadelWebhookPayloadSchema,
} from '@colophony/auth-client';
import type { ZitadelWebhookPayload } from '@colophony/auth-client';
import { eq, and, or, lt, isNull, sql, pool, users } from '@colophony/db';
import type { DrizzleDb } from '@colophony/db';
import type { Env } from '../config/env.js';
import { auditService } from '../services/audit.service.js';
import { AuditActions, AuditResources } from '@colophony/types';

export interface ZitadelWebhookOptions {
  env: Env;
}

/**
 * Atomic Lua script: INCR key, set PEXPIRE on first hit, return [count, pttl].
 */
const RATE_LIMIT_LUA = `
local current = redis.call('INCR', KEYS[1])
if current == 1 then
  redis.call('PEXPIRE', KEYS[1], ARGV[1])
end
local ttl = redis.call('PTTL', KEYS[1])
return { current, ttl }
`;

/**
 * Registers the Zitadel webhook endpoint.
 *
 * This must be registered in its own Fastify scope so that
 * `fastify-raw-body` configuration is isolated from other routes.
 */
export async function registerZitadelWebhooks(
  app: FastifyInstance,
  opts: ZitadelWebhookOptions,
) {
  const { env } = opts;

  // Register raw body plugin for signature verification (scoped)
  const rawBodyPlugin = await import('fastify-raw-body');
  await app.register(rawBodyPlugin.default, {
    field: 'rawBody',
    global: true,
    encoding: false, // Buffer, not string
    runFirst: true,
  });

  // Lazy Redis connection for webhook rate limiting
  let redis: Redis | null = null;

  function getRedis(): Redis | null {
    if (redis) return redis;
    try {
      redis = new Redis({
        host: env.REDIS_HOST,
        port: env.REDIS_PORT,
        password: env.REDIS_PASSWORD || undefined,
        lazyConnect: true,
        enableOfflineQueue: false,
        maxRetriesPerRequest: 0,
        connectTimeout: 5000,
        commandTimeout: 1000,
      });
      redis.connect().catch(() => {
        // Connection failure handled per-request via graceful degradation
      });
      return redis;
    } catch {
      return null;
    }
  }

  app.addHook('onClose', async () => {
    if (redis) {
      await redis.quit().catch(() => {
        // Ignore quit errors during shutdown
      });
    }
  });

  app.post(
    '/webhooks/zitadel',
    {
      config: { rawBody: true },
      bodyLimit: 256 * 1024, // 256kb
      preHandler: async function webhookRateLimit(
        request: FastifyRequest,
        reply: FastifyReply,
      ) {
        const redisClient = getRedis();
        if (!redisClient) return; // Graceful degradation

        const windowMs = env.RATE_LIMIT_WINDOW_SECONDS * 1000;
        const windowId = Math.floor(Date.now() / windowMs);
        const key = `${env.RATE_LIMIT_KEY_PREFIX}:wh:zitadel:${windowId}:${request.ip}`;

        try {
          const result = (await redisClient.eval(
            RATE_LIMIT_LUA,
            1,
            key,
            windowMs,
          )) as [number, number];
          const count = result[0];

          if (count > env.WEBHOOK_RATE_LIMIT_MAX) {
            // Compute remaining time until window boundary (not key TTL)
            const remainingMs = windowMs - (Date.now() % windowMs);
            const retryAfterSeconds = Math.ceil(remainingMs / 1000);
            reply.header('Retry-After', retryAfterSeconds);
            request.log.warn(
              { ip: request.ip, count, limit: env.WEBHOOK_RATE_LIMIT_MAX },
              'Webhook rate limit exceeded',
            );
            return reply.status(429).send({
              error: 'rate_limit_exceeded',
              message: 'Too many webhook requests',
            });
          }
        } catch {
          // Graceful degradation: Redis unavailable → allow request
          request.log.warn('Webhook rate limit Redis error — allowing request');
        }
      },
    },
    async function zitadelWebhookHandler(
      request: FastifyRequest,
      reply: FastifyReply,
    ) {
      // Verify signature — Zitadel sends 'ZITADEL-Signature' header,
      // which Node.js lowercases to 'zitadel-signature'.
      const signature = (request.headers['zitadel-signature'] ??
        request.headers['x-zitadel-signature']) as string | undefined;

      const rawBody = (request as FastifyRequest & { rawBody?: Buffer })
        .rawBody;
      if (!rawBody) {
        return reply.status(400).send({ error: 'missing_body' });
      }

      // Verify signature — returns generic 401 for both missing config and
      // invalid signature to prevent configuration state probing.
      if (
        !env.ZITADEL_WEBHOOK_SECRET ||
        !verifyZitadelSignature(rawBody, signature, env.ZITADEL_WEBHOOK_SECRET)
      ) {
        if (!env.ZITADEL_WEBHOOK_SECRET) {
          request.log.error('ZITADEL_WEBHOOK_SECRET not configured');
        } else {
          // Temporary debug logging for staging signature mismatch
          const sigHeaders = Object.keys(request.headers)
            .filter((h) => h.includes('zitadel') || h.includes('signature'))
            .reduce(
              (acc, h) => ({ ...acc, [h]: request.headers[h] }),
              {} as Record<string, unknown>,
            );
          request.log.warn(
            {
              signatureHeadersFound: sigHeaders,
              signatureValue: signature?.substring(0, 20) + '...',
              bodyLength: rawBody.length,
              secretLength: env.ZITADEL_WEBHOOK_SECRET.length,
            },
            'Invalid Zitadel webhook signature',
          );
        }
        return reply.status(401).send({ error: 'invalid_signature' });
      }

      // Temporary: log raw payload to understand Zitadel's format
      request.log.info(
        { rawPayload: request.body },
        'Zitadel webhook raw payload',
      );

      const parsed = zitadelWebhookPayloadSchema.safeParse(request.body);
      if (!parsed.success) {
        request.log.warn(
          { errors: parsed.error.flatten() },
          'Invalid webhook payload',
        );
        return reply.status(400).send({ error: 'invalid_payload' });
      }
      const payload: ZitadelWebhookPayload = parsed.data;

      // Derive idempotency key from aggregateID + sequence (Zitadel v2 has no eventId)
      const eventId = `${payload.aggregateID}:${payload.sequence}`;

      // Timestamp freshness check — fail fast before acquiring DB connection
      const eventTime = new Date(payload.created_at);
      if (!isNaN(eventTime.getTime())) {
        const ageSeconds = (Date.now() - eventTime.getTime()) / 1000;
        if (ageSeconds > env.WEBHOOK_TIMESTAMP_MAX_AGE_SECONDS) {
          request.log.warn(
            { eventId, ageSeconds: Math.round(ageSeconds) },
            'Webhook event rejected: timestamp too old',
          );
          return reply.status(400).send({ error: 'event_too_old' });
        }
        if (ageSeconds < -60) {
          request.log.warn(
            { eventId, ageSeconds: Math.round(ageSeconds) },
            'Webhook event rejected: timestamp in the future',
          );
          return reply.status(400).send({ error: 'event_from_future' });
        }
      }

      // SECURITY NOTE: Uses pool.connect() directly (bypasses RLS) because
      // webhooks are unauthenticated system events. The zitadel_webhook_events
      // table has no RLS policies (system table, not tenant-scoped).
      const client = await pool.connect();
      try {
        await client.query('BEGIN');

        // Two-step idempotency: INSERT then SELECT processed status.
        await client.query(
          `INSERT INTO zitadel_webhook_events (id, event_id, type, payload, processed, received_at)
           VALUES (gen_random_uuid(), $1, $2, $3, false, now())
           ON CONFLICT (event_id) DO NOTHING`,
          [eventId, payload.event_type, JSON.stringify(payload)],
        );

        const statusResult = await client.query(
          `SELECT processed FROM zitadel_webhook_events WHERE event_id = $1`,
          [eventId],
        );

        if (statusResult.rows[0]?.processed === true) {
          await client.query('COMMIT');
          return reply.status(200).send({ status: 'already_processed' });
        }

        // Process event using a Drizzle instance on the same transaction client
        // so that user state changes are atomic with the idempotency record.
        const tx = drizzle(client);
        await processEvent(payload, request, tx);

        // Mark as processed
        await client.query(
          `UPDATE zitadel_webhook_events SET processed = true, processed_at = now() WHERE event_id = $1`,
          [eventId],
        );

        await client.query('COMMIT');
        return reply.status(200).send({ status: 'processed' });
      } catch (err) {
        await client.query('ROLLBACK');
        request.log.error(err, 'Zitadel webhook processing failed');
        return reply.status(500).send({ error: 'processing_failed' });
      } finally {
        client.release();
      }
    },
  );
}

/**
 * Maps Zitadel's actual event type names (e.g., 'user.human.added') to our
 * internal names (e.g., 'user.created'). Passthrough for unknown types so
 * the switch default case still logs them.
 */
const EVENT_TYPE_ALIASES: Record<string, string> = {
  'user.human.added': 'user.created',
  'user.human.changed': 'user.changed',
  'user.human.deactivated': 'user.deactivated',
  'user.human.reactivated': 'user.reactivated',
  'user.human.removed': 'user.removed',
  'user.human.email.verified': 'user.email.verified',
};

async function processEvent(
  payload: ZitadelWebhookPayload,
  request: FastifyRequest,
  tx: DrizzleDb,
): Promise<void> {
  const rawEventType = payload.event_type;
  const eventType = EVENT_TYPE_ALIASES[rawEventType] ?? rawEventType;
  const eventPayload = payload.event_payload;

  // aggregateID is the user's ID for user.* events
  const userId = payload.aggregateID;
  if (!userId) {
    request.log.warn({ eventType }, 'Webhook event missing aggregateID');
    return;
  }

  // Parse event timestamp for out-of-order guard
  const eventTime = new Date(payload.created_at);
  const hasValidTimestamp = !isNaN(eventTime.getTime());

  switch (eventType) {
    case 'user.created':
    case 'user.changed': {
      const displayName =
        eventPayload?.displayName ??
        ([eventPayload?.firstName, eventPayload?.lastName]
          .filter(Boolean)
          .join(' ') ||
          undefined);
      // Upsert with out-of-order guard: setWhere prevents stale overwrites
      const upsertResult = await tx
        .insert(users)
        .values({
          email: eventPayload?.email ?? `${userId}@placeholder.local`,
          zitadelUserId: userId,
          ...(displayName !== undefined ? { displayName } : {}),
          emailVerified: eventPayload?.emailVerified ?? false,
          emailVerifiedAt: eventPayload?.emailVerified ? new Date() : undefined,
          lastEventAt: hasValidTimestamp ? eventTime : undefined,
        })
        .onConflictDoUpdate({
          target: users.zitadelUserId,
          targetWhere: sql`${users.zitadelUserId} IS NOT NULL`,
          set: {
            ...(eventPayload?.email ? { email: eventPayload.email } : {}),
            ...(displayName !== undefined ? { displayName } : {}),
            ...(eventPayload?.emailVerified !== undefined
              ? {
                  emailVerified: eventPayload.emailVerified,
                  emailVerifiedAt: eventPayload.emailVerified
                    ? new Date()
                    : undefined,
                }
              : {}),
            updatedAt: new Date(),
            lastEventAt: hasValidTimestamp ? eventTime : undefined,
          },
          setWhere: hasValidTimestamp
            ? sql`${users.lastEventAt} IS NULL OR ${users.lastEventAt} < ${eventTime}`
            : undefined,
        });

      // rowCount === 0 means conflict + setWhere rejected (stale event)
      if (upsertResult.rowCount === 0) {
        request.log.info(
          { zitadelUserId: userId, eventType },
          'Stale event skipped',
        );
        break;
      }

      await auditService.log(tx, {
        resource: AuditResources.USER,
        action:
          eventType === 'user.created'
            ? AuditActions.USER_CREATED
            : AuditActions.USER_UPDATED,
        newValue: {
          zitadelUserId: userId,
          email: eventPayload?.email,
          emailVerified: eventPayload?.emailVerified,
        },
        ipAddress: request.ip,
        userAgent: request.headers['user-agent'],
      });
      request.log.info(
        { zitadelUserId: userId, eventType },
        'User upserted from webhook',
      );
      break;
    }

    case 'user.deactivated': {
      const result = await tx
        .update(users)
        .set({
          deletedAt: new Date(),
          updatedAt: new Date(),
          lastEventAt: hasValidTimestamp ? eventTime : undefined,
        })
        .where(
          and(
            eq(users.zitadelUserId, userId),
            hasValidTimestamp
              ? or(isNull(users.lastEventAt), lt(users.lastEventAt, eventTime))
              : undefined,
          ),
        );
      if (result.rowCount) {
        await auditService.log(tx, {
          resource: AuditResources.USER,
          action: AuditActions.USER_DEACTIVATED,
          newValue: { zitadelUserId: userId },
          ipAddress: request.ip,
          userAgent: request.headers['user-agent'],
        });
      } else {
        const [existing] = await tx
          .select({ id: users.id })
          .from(users)
          .where(eq(users.zitadelUserId, userId))
          .limit(1);
        if (existing) {
          request.log.info(
            { zitadelUserId: userId, eventType },
            'Stale event skipped',
          );
        } else {
          request.log.warn(
            { zitadelUserId: userId },
            'user.deactivated: user not found locally',
          );
        }
      }
      break;
    }

    case 'user.reactivated': {
      const result = await tx
        .update(users)
        .set({
          deletedAt: null,
          updatedAt: new Date(),
          lastEventAt: hasValidTimestamp ? eventTime : undefined,
        })
        .where(
          and(
            eq(users.zitadelUserId, userId),
            hasValidTimestamp
              ? or(isNull(users.lastEventAt), lt(users.lastEventAt, eventTime))
              : undefined,
          ),
        );
      if (result.rowCount) {
        await auditService.log(tx, {
          resource: AuditResources.USER,
          action: AuditActions.USER_REACTIVATED,
          newValue: { zitadelUserId: userId },
          ipAddress: request.ip,
          userAgent: request.headers['user-agent'],
        });
      } else {
        const [existing] = await tx
          .select({ id: users.id })
          .from(users)
          .where(eq(users.zitadelUserId, userId))
          .limit(1);
        if (existing) {
          request.log.info(
            { zitadelUserId: userId, eventType },
            'Stale event skipped',
          );
        } else {
          request.log.warn(
            { zitadelUserId: userId },
            'user.reactivated: user not found locally',
          );
        }
      }
      break;
    }

    case 'user.removed': {
      // GDPR: Anonymize email, preserve referential integrity
      const anonymizedEmail = `deleted-${userId}@anonymized.local`;
      const result = await tx
        .update(users)
        .set({
          email: anonymizedEmail,
          emailVerified: false,
          emailVerifiedAt: null,
          deletedAt: new Date(),
          updatedAt: new Date(),
          lastEventAt: hasValidTimestamp ? eventTime : undefined,
        })
        .where(
          and(
            eq(users.zitadelUserId, userId),
            hasValidTimestamp
              ? or(isNull(users.lastEventAt), lt(users.lastEventAt, eventTime))
              : undefined,
          ),
        );
      if (result.rowCount) {
        request.log.info(
          { zitadelUserId: userId },
          'User anonymized (GDPR removal)',
        );
        await auditService.log(tx, {
          resource: AuditResources.USER,
          action: AuditActions.USER_REMOVED,
          newValue: {
            zitadelUserId: userId,
            email: anonymizedEmail,
          },
          ipAddress: request.ip,
          userAgent: request.headers['user-agent'],
        });
      } else {
        const [existing] = await tx
          .select({ id: users.id })
          .from(users)
          .where(eq(users.zitadelUserId, userId))
          .limit(1);
        if (existing) {
          request.log.info(
            { zitadelUserId: userId, eventType },
            'Stale event skipped',
          );
        } else {
          request.log.warn(
            { zitadelUserId: userId },
            'user.removed: user not found locally',
          );
        }
      }
      break;
    }

    case 'user.email.verified': {
      const result = await tx
        .update(users)
        .set({
          emailVerified: true,
          emailVerifiedAt: new Date(),
          updatedAt: new Date(),
          lastEventAt: hasValidTimestamp ? eventTime : undefined,
        })
        .where(
          and(
            eq(users.zitadelUserId, userId),
            hasValidTimestamp
              ? or(isNull(users.lastEventAt), lt(users.lastEventAt, eventTime))
              : undefined,
          ),
        );
      if (result.rowCount) {
        await auditService.log(tx, {
          resource: AuditResources.USER,
          action: AuditActions.USER_EMAIL_VERIFIED,
          newValue: { zitadelUserId: userId },
          ipAddress: request.ip,
          userAgent: request.headers['user-agent'],
        });
      } else {
        const [existing] = await tx
          .select({ id: users.id })
          .from(users)
          .where(eq(users.zitadelUserId, userId))
          .limit(1);
        if (existing) {
          request.log.info(
            { zitadelUserId: userId, eventType },
            'Stale event skipped',
          );
        } else {
          request.log.warn(
            { zitadelUserId: userId },
            'user.email.verified: user not found locally',
          );
        }
      }
      break;
    }

    default:
      request.log.info({ eventType }, 'Unhandled Zitadel event type');
  }
}
