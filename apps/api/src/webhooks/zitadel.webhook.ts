import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { drizzle } from 'drizzle-orm/node-postgres';
import { verifyZitadelSignature } from '@colophony/auth-client';
import type { ZitadelWebhookPayload } from '@colophony/auth-client';
import { eq, pool, users } from '@colophony/db';
import type { DrizzleDb } from '@colophony/db';
import type { Env } from '../config/env.js';
import { auditService } from '../services/audit.service.js';
import { AuditActions, AuditResources } from '@colophony/types';

export interface ZitadelWebhookOptions {
  env: Env;
}

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

  app.post(
    '/webhooks/zitadel',
    {
      config: { rawBody: true },
      bodyLimit: 256 * 1024, // 256kb
    },
    async function zitadelWebhookHandler(
      request: FastifyRequest,
      reply: FastifyReply,
    ) {
      // Verify signature
      const signature = request.headers['x-zitadel-signature'] as
        | string
        | undefined;

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
          request.log.warn('Invalid Zitadel webhook signature');
        }
        return reply.status(401).send({ error: 'invalid_signature' });
      }

      const payload = request.body as ZitadelWebhookPayload;

      if (!payload.eventId || !payload.eventType) {
        return reply.status(400).send({ error: 'invalid_payload' });
      }

      // SECURITY NOTE: Uses pool.connect() directly (bypasses RLS) because
      // webhooks are unauthenticated system events. The zitadel_webhook_events
      // table has no RLS policies (system table, not tenant-scoped).
      const client = await pool.connect();
      try {
        await client.query('BEGIN');

        // Attempt to insert — ON CONFLICT means already processed
        const insertResult = await client.query(
          `INSERT INTO zitadel_webhook_events (id, event_id, type, payload, processed, received_at)
           VALUES (gen_random_uuid(), $1, $2, $3, false, now())
           ON CONFLICT (event_id) DO NOTHING
           RETURNING id`,
          [payload.eventId, payload.eventType, JSON.stringify(payload)],
        );

        // If no rows inserted, this event was already seen
        if (insertResult.rows.length === 0) {
          await client.query('COMMIT');
          client.release();
          return reply.status(200).send({ status: 'already_processed' });
        }

        const webhookEventId = insertResult.rows[0].id as string;

        // Process event using a Drizzle instance on the same transaction client
        // so that user state changes are atomic with the idempotency record.
        const tx = drizzle(client);
        await processEvent(payload, request, tx);

        // Mark as processed
        await client.query(
          `UPDATE zitadel_webhook_events SET processed = true, processed_at = now() WHERE id = $1`,
          [webhookEventId],
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

async function processEvent(
  payload: ZitadelWebhookPayload,
  request: FastifyRequest,
  tx: DrizzleDb,
): Promise<void> {
  const { eventType, user: userData } = payload;

  if (!userData?.userId) {
    request.log.warn({ eventType }, 'Webhook event missing user data');
    return;
  }

  switch (eventType) {
    case 'user.created':
    case 'user.changed': {
      // Upsert: handles both create and out-of-order delivery
      await tx
        .insert(users)
        .values({
          email: userData.email ?? `${userData.userId}@placeholder.local`,
          zitadelUserId: userData.userId,
          emailVerified: userData.emailVerified ?? false,
          emailVerifiedAt: userData.emailVerified ? new Date() : undefined,
        })
        .onConflictDoUpdate({
          target: users.zitadelUserId,
          set: {
            ...(userData.email ? { email: userData.email } : {}),
            ...(userData.emailVerified !== undefined
              ? {
                  emailVerified: userData.emailVerified,
                  emailVerifiedAt: userData.emailVerified
                    ? new Date()
                    : undefined,
                }
              : {}),
            updatedAt: new Date(),
          },
        });
      await auditService.log(tx, {
        resource: AuditResources.USER,
        action:
          eventType === 'user.created'
            ? AuditActions.USER_CREATED
            : AuditActions.USER_UPDATED,
        newValue: {
          zitadelUserId: userData.userId,
          email: userData.email,
          emailVerified: userData.emailVerified,
        },
        ipAddress: request.ip,
        userAgent: request.headers['user-agent'],
      });
      request.log.info(
        { zitadelUserId: userData.userId, eventType },
        'User upserted from webhook',
      );
      break;
    }

    case 'user.deactivated': {
      const result = await tx
        .update(users)
        .set({ deletedAt: new Date(), updatedAt: new Date() })
        .where(eq(users.zitadelUserId, userData.userId));
      if (!result.rowCount) {
        request.log.warn(
          { zitadelUserId: userData.userId },
          'user.deactivated: user not found locally',
        );
      }
      await auditService.log(tx, {
        resource: AuditResources.USER,
        action: AuditActions.USER_DEACTIVATED,
        newValue: { zitadelUserId: userData.userId },
        ipAddress: request.ip,
        userAgent: request.headers['user-agent'],
      });
      break;
    }

    case 'user.reactivated': {
      const result = await tx
        .update(users)
        .set({ deletedAt: null, updatedAt: new Date() })
        .where(eq(users.zitadelUserId, userData.userId));
      if (!result.rowCount) {
        request.log.warn(
          { zitadelUserId: userData.userId },
          'user.reactivated: user not found locally',
        );
      }
      await auditService.log(tx, {
        resource: AuditResources.USER,
        action: AuditActions.USER_REACTIVATED,
        newValue: { zitadelUserId: userData.userId },
        ipAddress: request.ip,
        userAgent: request.headers['user-agent'],
      });
      break;
    }

    case 'user.removed': {
      // GDPR: Anonymize email, preserve referential integrity
      const anonymizedEmail = `deleted-${userData.userId}@anonymized.local`;
      const result = await tx
        .update(users)
        .set({
          email: anonymizedEmail,
          emailVerified: false,
          emailVerifiedAt: null,
          deletedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(users.zitadelUserId, userData.userId));
      if (!result.rowCount) {
        request.log.warn(
          { zitadelUserId: userData.userId },
          'user.removed: user not found locally',
        );
      } else {
        request.log.info(
          { zitadelUserId: userData.userId },
          'User anonymized (GDPR removal)',
        );
      }
      await auditService.log(tx, {
        resource: AuditResources.USER,
        action: AuditActions.USER_REMOVED,
        newValue: {
          zitadelUserId: userData.userId,
          email: anonymizedEmail,
        },
        ipAddress: request.ip,
        userAgent: request.headers['user-agent'],
      });
      break;
    }

    case 'user.email.verified': {
      const result = await tx
        .update(users)
        .set({
          emailVerified: true,
          emailVerifiedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(users.zitadelUserId, userData.userId));
      if (!result.rowCount) {
        request.log.warn(
          { zitadelUserId: userData.userId },
          'user.email.verified: user not found locally',
        );
      }
      await auditService.log(tx, {
        resource: AuditResources.USER,
        action: AuditActions.USER_EMAIL_VERIFIED,
        newValue: { zitadelUserId: userData.userId },
        ipAddress: request.ip,
        userAgent: request.headers['user-agent'],
      });
      break;
    }

    default:
      request.log.info({ eventType }, 'Unhandled Zitadel event type');
  }
}
