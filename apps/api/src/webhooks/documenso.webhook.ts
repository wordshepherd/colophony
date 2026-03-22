import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import Redis from 'ioredis';
import { pool, withRls } from '@colophony/db';
import {
  documensoWebhookPayloadSchema,
  AuditActions,
  AuditResources,
} from '@colophony/types';
import type { Env } from '../config/env.js';
import { createDocumensoAdapter } from '../adapters/documenso.adapter.js';
import { contractService } from '../services/contract.service.js';
import { auditService } from '../services/audit.service.js';
import { inngest } from '../inngest/client.js';
import { drizzle } from 'drizzle-orm/node-postgres';
import type { DrizzleDb } from '@colophony/db';

export interface DocumensoWebhookOptions {
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
 * Registers the Documenso webhook endpoint.
 *
 * Same pattern as stripe.webhook.ts: isolated Fastify scope, raw body parsing,
 * signature verification, two-step idempotency via documenso_webhook_events.
 *
 * Hardening: Zod payload validation, withRls() for mutation phase,
 * defense-in-depth org filter on updateStatus, audit logging.
 */
export async function registerDocumensoWebhooks(
  app: FastifyInstance,
  opts: DocumensoWebhookOptions,
) {
  const { env } = opts;

  // Register raw body plugin for signature verification (scoped)
  const rawBodyPlugin = await import('fastify-raw-body');
  await app.register(rawBodyPlugin.default, {
    field: 'rawBody',
    global: true,
    encoding: false,
    runFirst: true,
  });

  const adapter = createDocumensoAdapter(env);

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
      await redis.quit().catch(() => {});
    }
  });

  app.post(
    '/webhooks/documenso',
    {
      config: { rawBody: true },
      bodyLimit: 256 * 1024,
      preHandler: async function webhookRateLimit(
        request: FastifyRequest,
        reply: FastifyReply,
      ) {
        const redisClient = getRedis();
        if (!redisClient) return;

        const windowMs = env.RATE_LIMIT_WINDOW_SECONDS * 1000;
        const windowId = Math.floor(Date.now() / windowMs);
        const key = `${env.RATE_LIMIT_KEY_PREFIX}:wh:documenso:${windowId}:${request.ip}`;

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
              'Documenso webhook rate limit exceeded',
            );
            return reply.status(429).send({
              error: 'rate_limit_exceeded',
              message: 'Too many webhook requests',
            });
          }
        } catch {
          request.log.warn(
            'Documenso webhook rate limit Redis error — allowing request',
          );
        }
      },
    },
    async function documensoWebhookHandler(
      request: FastifyRequest,
      reply: FastifyReply,
    ) {
      const rawBody = (request as FastifyRequest & { rawBody?: Buffer })
        .rawBody;
      if (!rawBody) {
        return reply.status(400).send({ error: 'missing_body' });
      }

      // Verify signature
      if (!adapter || !env.DOCUMENSO_WEBHOOK_SECRET) {
        return reply.status(401).send({ error: 'invalid_signature' });
      }

      const signature = request.headers['x-documenso-signature'] as
        | string
        | undefined;

      if (!signature) {
        request.log.warn('Missing x-documenso-signature header');
        return reply.status(401).send({ error: 'invalid_signature' });
      }

      const payloadString = rawBody.toString('utf8');
      if (!adapter.verifyWebhookSignature(payloadString, signature)) {
        request.log.warn('Invalid Documenso webhook signature');
        return reply.status(401).send({ error: 'invalid_signature' });
      }

      // Parse and validate webhook payload with Zod
      let rawPayload: unknown;
      try {
        rawPayload = JSON.parse(payloadString);
      } catch {
        return reply.status(400).send({ error: 'invalid_json' });
      }

      const parsed = documensoWebhookPayloadSchema.safeParse(rawPayload);
      if (!parsed.success) {
        request.log.warn(
          { errors: parsed.error.flatten() },
          'Invalid Documenso webhook payload structure',
        );
        return reply.status(400).send({ error: 'invalid_payload' });
      }

      const webhookPayload = parsed.data;
      const documensoId = `${webhookPayload.event}:${webhookPayload.data.id ?? webhookPayload.data.documentId}`;

      // Two-step idempotency via documenso_webhook_events
      const client = await pool.connect();
      try {
        await client.query('BEGIN');

        // Step 1: Attempt to insert
        await client.query(
          `INSERT INTO documenso_webhook_events (id, documenso_id, type, payload, processed, received_at)
           VALUES (gen_random_uuid(), $1, $2, $3, false, now())
           ON CONFLICT (documenso_id) DO NOTHING`,
          [documensoId, webhookPayload.event, JSON.stringify(webhookPayload)],
        );

        // Step 2: Check processed status
        const statusResult = await client.query(
          `SELECT processed FROM documenso_webhook_events WHERE documenso_id = $1`,
          [documensoId],
        );

        if (statusResult.rows[0]?.processed === true) {
          await client.query('COMMIT');
          return reply.status(200).send({ status: 'already_processed' });
        }

        // Process event — collect Inngest events to send AFTER commit
        const tx = drizzle(client);
        const pendingEvents = await processDocumensoEvent(
          webhookPayload,
          request,
          tx,
        );

        // Mark as processed
        await client.query(
          `UPDATE documenso_webhook_events SET processed = true, processed_at = now() WHERE documenso_id = $1`,
          [documensoId],
        );

        await client.query('COMMIT');

        // Send Inngest events after commit to avoid ghost events on rollback
        for (const evt of pendingEvents) {
          await inngest.send(evt).catch((err) => {
            request.log.error(
              err,
              'Failed to send Inngest event after Documenso webhook commit',
            );
          });
        }

        return reply.status(200).send({ status: 'processed' });
      } catch (err) {
        await client.query('ROLLBACK');
        request.log.error(err, 'Documenso webhook processing failed');
        return reply.status(500).send({ error: 'processing_failed' });
      } finally {
        client.release();
      }
    },
  );
}

interface PendingInngestEvent {
  name: string;
  data: Record<string, unknown>;
}

async function processDocumensoEvent(
  payload: {
    event: string;
    data: {
      id: string;
      documentId: string;
      status?: string;
      [key: string]: unknown;
    };
  },
  request: FastifyRequest,
  tx: DrizzleDb,
): Promise<PendingInngestEvent[]> {
  const documentId = payload.data.documentId ?? payload.data.id;
  const pendingEvents: PendingInngestEvent[] = [];

  switch (payload.event) {
    case 'DOCUMENT_SIGNED': {
      const contract = await contractService.getByDocumensoDocumentId(
        tx,
        documentId,
      );
      if (!contract) {
        request.log.warn(
          { documentId },
          'Documenso DOCUMENT_SIGNED: no matching contract found',
        );
        return pendingEvents;
      }

      // Mutation phase: withRls for defense-in-depth RLS enforcement
      await withRls({ orgId: contract.organizationId }, async (rlsTx) => {
        await contractService.updateStatus(
          rlsTx,
          contract.id,
          'SIGNED',
          { signedAt: new Date() },
          contract.organizationId,
        );

        await auditService.log(rlsTx, {
          resource: AuditResources.CONTRACT,
          action: AuditActions.CONTRACT_SIGNED,
          organizationId: contract.organizationId,
          resourceId: contract.id,
          oldValue: { status: contract.status },
          newValue: { status: 'SIGNED', documensoDocumentId: documentId },
        });
      });

      pendingEvents.push({
        name: 'slate/contract.signed',
        data: {
          orgId: contract.organizationId,
          contractId: contract.id,
          documensoDocumentId: documentId,
        },
      });
      break;
    }

    case 'DOCUMENT_COMPLETED': {
      const contract = await contractService.getByDocumensoDocumentId(
        tx,
        documentId,
      );
      if (!contract) {
        request.log.warn(
          { documentId },
          'Documenso DOCUMENT_COMPLETED: no matching contract found',
        );
        return pendingEvents;
      }

      // Mutation phase: withRls for defense-in-depth RLS enforcement
      await withRls({ orgId: contract.organizationId }, async (rlsTx) => {
        await contractService.updateStatus(
          rlsTx,
          contract.id,
          'COMPLETED',
          { completedAt: new Date() },
          contract.organizationId,
        );

        await auditService.log(rlsTx, {
          resource: AuditResources.CONTRACT,
          action: AuditActions.CONTRACT_COMPLETED,
          organizationId: contract.organizationId,
          resourceId: contract.id,
          oldValue: { status: contract.status },
          newValue: { status: 'COMPLETED', documensoDocumentId: documentId },
        });
      });

      pendingEvents.push({
        name: 'slate/contract.completed',
        data: {
          orgId: contract.organizationId,
          contractId: contract.id,
          documensoDocumentId: documentId,
        },
      });
      break;
    }

    default:
      request.log.info(
        { event: payload.event },
        'Unhandled Documenso webhook event',
      );
  }

  return pendingEvents;
}
