import type { FastifyInstance } from 'fastify';
import { db } from '@colophony/db';
import { sql } from 'drizzle-orm';
import type { Env } from '../config/env.js';

interface WebhookProviderHealth {
  provider: string;
  lastReceivedAt: string | null;
  freshnessSeconds: number | null;
  status: 'healthy' | 'stale' | 'unknown';
}

interface WebhookHealthResponse {
  timestamp: string;
  providers: WebhookProviderHealth[];
}

/**
 * Register the webhook health endpoint in an isolated Fastify scope.
 * Returns freshness status for each webhook provider (Zitadel, Stripe, Documenso).
 *
 * Uses the admin db pool — these are system tables without RLS.
 * No auth required — reveals only timestamps, not event content.
 */
export async function registerWebhookHealthRoute(
  app: FastifyInstance,
  opts: { env: Env },
): Promise<void> {
  const thresholds: Record<string, number> = {
    zitadel: opts.env.WEBHOOK_HEALTH_ZITADEL_STALE_SECONDS,
    stripe: opts.env.WEBHOOK_HEALTH_STRIPE_STALE_SECONDS,
    documenso: opts.env.WEBHOOK_HEALTH_DOCUMENSO_STALE_SECONDS,
  };

  app.get('/webhooks/health', async (_request, reply) => {
    const result = await db.execute<{
      provider: string;
      last_received_at: string | null;
    }>(sql`
      SELECT 'zitadel' AS provider, MAX(received_at)::text AS last_received_at
        FROM zitadel_webhook_events
      UNION ALL
      SELECT 'stripe' AS provider, MAX(received_at)::text AS last_received_at
        FROM stripe_webhook_events
      UNION ALL
      SELECT 'documenso' AS provider, MAX(received_at)::text AS last_received_at
        FROM documenso_webhook_events
    `);

    const now = new Date();
    const providers: WebhookProviderHealth[] = result.rows.map((row) => {
      const lastReceivedAt = row.last_received_at;
      if (!lastReceivedAt) {
        return {
          provider: row.provider,
          lastReceivedAt: null,
          freshnessSeconds: null,
          status: 'unknown' as const,
        };
      }

      const freshnessSeconds = Math.round(
        (now.getTime() - new Date(lastReceivedAt).getTime()) / 1000,
      );
      const threshold = thresholds[row.provider] ?? 3600;
      const status = freshnessSeconds > threshold ? 'stale' : 'healthy';

      return {
        provider: row.provider,
        lastReceivedAt,
        freshnessSeconds,
        status,
      };
    });

    const response: WebhookHealthResponse = {
      timestamp: now.toISOString(),
      providers,
    };

    return reply.status(200).send(response);
  });
}
