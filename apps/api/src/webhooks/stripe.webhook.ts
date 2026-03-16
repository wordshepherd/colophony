import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import Stripe from 'stripe';
import { drizzle } from 'drizzle-orm/node-postgres';
import Redis from 'ioredis';
import { pool, payments, sql } from '@colophony/db';
import type { DrizzleDb } from '@colophony/db';
import type { Env } from '../config/env.js';
import { auditService } from '../services/audit.service.js';
import {
  AuditActions,
  AuditResources,
  stripeCheckoutMetadataSchema,
} from '@colophony/types';
import { getGlobalRegistry } from '../adapters/registry-accessor.js';
import type { StripePaymentAdapter } from '../adapters/payment/index.js';

export interface StripeWebhookOptions {
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
 * Registers the Stripe webhook endpoint.
 *
 * This must be registered in its own Fastify scope so that
 * `fastify-raw-body` configuration is isolated from other routes.
 */
export async function registerStripeWebhooks(
  app: FastifyInstance,
  opts: StripeWebhookOptions,
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
    '/webhooks/stripe',
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
        const key = `${env.RATE_LIMIT_KEY_PREFIX}:wh:stripe:${windowId}:${request.ip}`;

        try {
          const result = (await redisClient.eval(
            RATE_LIMIT_LUA,
            1,
            key,
            windowMs,
          )) as [number, number];
          const count = result[0];

          if (count > env.WEBHOOK_RATE_LIMIT_MAX) {
            const remainingMs = windowMs - (Date.now() % windowMs);
            const retryAfterSeconds = Math.ceil(remainingMs / 1000);
            reply.header('Retry-After', retryAfterSeconds);
            request.log.warn(
              { ip: request.ip, count, limit: env.WEBHOOK_RATE_LIMIT_MAX },
              'Stripe webhook rate limit exceeded',
            );
            return reply.status(429).send({
              error: 'rate_limit_exceeded',
              message: 'Too many webhook requests',
            });
          }
        } catch {
          // Graceful degradation: Redis unavailable → allow request
          request.log.warn(
            'Stripe webhook rate limit Redis error — allowing request',
          );
        }
      },
    },
    async function stripeWebhookHandler(
      request: FastifyRequest,
      reply: FastifyReply,
    ) {
      const rawBody = (request as FastifyRequest & { rawBody?: Buffer })
        .rawBody;
      if (!rawBody) {
        return reply.status(400).send({ error: 'missing_body' });
      }

      // Verify signature via payment adapter — returns generic 401 for both
      // missing config and invalid signature to prevent configuration probing.
      const paymentAdapter =
        getGlobalRegistry().tryResolve<StripePaymentAdapter>('payment');

      if (!paymentAdapter) {
        request.log.error('Payment adapter not configured');
        return reply.status(401).send({ error: 'invalid_signature' });
      }

      let event: Stripe.Event;
      try {
        const headers = Object.fromEntries(
          Object.entries(request.headers).map(([k, v]) => [
            k,
            Array.isArray(v) ? (v[0] ?? '') : (v ?? ''),
          ]),
        );
        const parsed = await paymentAdapter.verifyWebhook(
          headers,
          rawBody.toString(),
        );
        // Reconstruct Stripe.Event from parsed webhook event for downstream compatibility
        event = {
          id: parsed.id,
          type: parsed.type,
          data: { object: parsed.data },
        } as unknown as Stripe.Event;
      } catch (err) {
        request.log.warn(
          { error: (err as Error).message },
          'Invalid Stripe webhook signature',
        );
        return reply.status(401).send({ error: 'invalid_signature' });
      }

      // Two-step idempotency: INSERT event, then check processed status.
      // Uses pool.connect() directly for manual transaction control.
      const client = await pool.connect();
      try {
        await client.query('BEGIN');

        // Step 1: Attempt to insert the event record.
        // PCI note: Checkout Session events contain amounts, currency, payment_intent
        // ID, and metadata — never card numbers, CVV, or cardholder data. Stripe does
        // not include PCI-sensitive fields in webhook payloads. Safe to store raw.
        await client.query(
          `INSERT INTO stripe_webhook_events (id, stripe_id, type, payload, processed, received_at)
           VALUES (gen_random_uuid(), $1, $2, $3, false, now())
           ON CONFLICT (stripe_id) DO NOTHING`,
          [event.id, event.type, JSON.stringify(event)],
        );

        // Step 2: Check processed status (covers both new insert and existing record)
        const statusResult = await client.query(
          `SELECT processed FROM stripe_webhook_events WHERE stripe_id = $1`,
          [event.id],
        );

        if (statusResult.rows[0]?.processed === true) {
          await client.query('COMMIT');
          return reply.status(200).send({ status: 'already_processed' });
        }

        // Process event using a Drizzle instance on the same transaction client
        const tx = drizzle(client);
        await processStripeEvent(event, request, tx, client);

        // Mark as processed
        await client.query(
          `UPDATE stripe_webhook_events SET processed = true, processed_at = now() WHERE stripe_id = $1`,
          [event.id],
        );

        await client.query('COMMIT');
        return reply.status(200).send({ status: 'processed' });
      } catch (err) {
        await client.query('ROLLBACK');
        request.log.error(err, 'Stripe webhook processing failed');
        return reply.status(500).send({ error: 'processing_failed' });
      } finally {
        client.release();
      }
    },
  );
}

async function processStripeEvent(
  event: Stripe.Event,
  request: FastifyRequest,
  tx: DrizzleDb,
  client: { query: (sql: string, params?: unknown[]) => Promise<unknown> },
): Promise<void> {
  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object;
      const parsed = stripeCheckoutMetadataSchema.safeParse(
        session.metadata ?? {},
      );

      if (!parsed.success) {
        request.log.error(
          { errors: parsed.error.flatten(), eventId: event.id },
          'Invalid Stripe checkout metadata',
        );
        // Record error but mark as processed to prevent infinite retries
        await client.query(
          `UPDATE stripe_webhook_events SET error = $1 WHERE stripe_id = $2`,
          [
            `Invalid metadata: ${JSON.stringify(parsed.error.flatten())}`,
            event.id,
          ],
        );
        return;
      }

      const { organizationId, submissionId } = parsed.data;

      // Set RLS org context — parameterized, transaction-local
      await client.query(`SELECT set_config($1, $2, true)`, [
        'app.current_org',
        organizationId,
      ]);

      // Upsert payment record
      await tx
        .insert(payments)
        .values({
          organizationId,
          submissionId: submissionId ?? null,
          stripeSessionId: session.id,
          stripePaymentId: session.payment_intent as string | null,
          amount: session.amount_total ?? 0,
          currency: session.currency ?? 'usd',
          status: 'SUCCEEDED',
          metadata: { checkoutSessionId: session.id },
        })
        .onConflictDoUpdate({
          target: payments.stripeSessionId,
          set: {
            stripePaymentId: sql`EXCLUDED.stripe_payment_id`,
            amount: sql`EXCLUDED.amount`,
            currency: sql`EXCLUDED.currency`,
            status: sql`'SUCCEEDED'`,
            updatedAt: new Date(),
          },
        });

      await auditService.log(tx, {
        resource: AuditResources.PAYMENT,
        action: AuditActions.PAYMENT_SUCCEEDED,
        organizationId,
        newValue: {
          stripeSessionId: session.id,
          amount: session.amount_total,
          currency: session.currency,
        },
        ipAddress: request.ip,
        userAgent: request.headers['user-agent'],
      });

      request.log.info(
        { sessionId: session.id, organizationId },
        'Payment succeeded',
      );
      break;
    }

    case 'checkout.session.expired': {
      const session = event.data.object;
      const parsed = stripeCheckoutMetadataSchema.safeParse(
        session.metadata ?? {},
      );

      if (!parsed.success) {
        request.log.error(
          { errors: parsed.error.flatten(), eventId: event.id },
          'Invalid Stripe checkout metadata',
        );
        await client.query(
          `UPDATE stripe_webhook_events SET error = $1 WHERE stripe_id = $2`,
          [
            `Invalid metadata: ${JSON.stringify(parsed.error.flatten())}`,
            event.id,
          ],
        );
        return;
      }

      const { organizationId, submissionId } = parsed.data;

      // Set RLS org context — parameterized, transaction-local
      await client.query(`SELECT set_config($1, $2, true)`, [
        'app.current_org',
        organizationId,
      ]);

      // Upsert payment record with FAILED status
      await tx
        .insert(payments)
        .values({
          organizationId,
          submissionId: submissionId ?? null,
          stripeSessionId: session.id,
          stripePaymentId: session.payment_intent as string | null,
          amount: session.amount_total ?? 0,
          currency: session.currency ?? 'usd',
          status: 'FAILED',
          metadata: { checkoutSessionId: session.id },
        })
        .onConflictDoUpdate({
          target: payments.stripeSessionId,
          set: {
            status: sql`'FAILED'`,
            updatedAt: new Date(),
          },
        });

      await auditService.log(tx, {
        resource: AuditResources.PAYMENT,
        action: AuditActions.PAYMENT_EXPIRED,
        organizationId,
        newValue: {
          stripeSessionId: session.id,
          amount: session.amount_total,
          currency: session.currency,
        },
        ipAddress: request.ip,
        userAgent: request.headers['user-agent'],
      });

      request.log.info(
        { sessionId: session.id, organizationId },
        'Payment expired',
      );
      break;
    }

    default:
      request.log.info(
        { eventType: event.type },
        'Unhandled Stripe event type',
      );
  }
}
