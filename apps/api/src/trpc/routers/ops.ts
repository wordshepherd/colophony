import { z } from 'zod';
import { sql, eq, gte, lt, and, count } from 'drizzle-orm';
import { db, submissions } from '@colophony/db';
import { adminProcedure, createRouter } from '../init.js';
import { validateEnv } from '../../config/env.js';
import {
  getEmailQueueInstance,
  getWebhookQueueInstance,
  getFileScanQueueInstance,
  getContentExtractQueueInstance,
  getS3CleanupQueueInstance,
  getOutboxPollerQueueInstance,
  getTransferFetchQueueInstance,
} from '../../queues/index.js';

// ---------------------------------------------------------------------------
// Output schemas (ops-internal, not shared via @colophony/types)
// ---------------------------------------------------------------------------

const queueCountsSchema = z.object({
  name: z.string(),
  waiting: z.number(),
  active: z.number(),
  delayed: z.number(),
  failed: z.number(),
});

const queueHealthOutputSchema = z.object({
  queues: z.array(queueCountsSchema),
});

const webhookProviderSchema = z.object({
  provider: z.string(),
  status: z.enum(['healthy', 'stale', 'unknown']),
  lastReceivedAt: z.string().nullable(),
  freshnessSeconds: z.number().nullable(),
});

const webhookProviderHealthOutputSchema = z.object({
  timestamp: z.string(),
  providers: z.array(webhookProviderSchema),
});

const submissionTrendOutputSchema = z.object({
  thisMonth: z.number(),
  lastMonth: z.number(),
  trend: z.enum(['up', 'down', 'flat']),
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const QUEUE_ACCESSORS = [
  { name: 'email', get: getEmailQueueInstance },
  { name: 'webhook', get: getWebhookQueueInstance },
  { name: 'file-scan', get: getFileScanQueueInstance },
  { name: 'content-extract', get: getContentExtractQueueInstance },
  { name: 's3-cleanup', get: getS3CleanupQueueInstance },
  { name: 'outbox-poller', get: getOutboxPollerQueueInstance },
  { name: 'transfer-fetch', get: getTransferFetchQueueInstance },
] as const;

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

export const opsRouter = createRouter({
  /**
   * Queue health — job counts for all 7 BullMQ queues.
   * Reads from Redis (not tenant-scoped), so no RLS needed.
   */
  queueHealth: adminProcedure
    .output(queueHealthOutputSchema)
    .query(async () => {
      const queues = await Promise.all(
        QUEUE_ACCESSORS.map(async ({ name, get }) => {
          const instance = get();
          if (!instance) {
            return { name, waiting: 0, active: 0, delayed: 0, failed: 0 };
          }
          try {
            const counts = await instance.getJobCounts(
              'waiting',
              'active',
              'delayed',
              'failed',
            );
            return {
              name,
              waiting: counts.waiting ?? 0,
              active: counts.active ?? 0,
              delayed: counts.delayed ?? 0,
              failed: counts.failed ?? 0,
            };
          } catch {
            // Redis unavailable — report zeros rather than fail the dashboard
            return { name, waiting: 0, active: 0, delayed: 0, failed: 0 };
          }
        }),
      );
      return { queues };
    }),

  /**
   * Webhook provider health — freshness status for Zitadel, Stripe, Documenso.
   * Uses admin pool (system tables, no RLS).
   */
  webhookProviderHealth: adminProcedure
    .output(webhookProviderHealthOutputSchema)
    .query(async () => {
      const env = validateEnv();
      const thresholds: Record<string, number> = {
        zitadel: env.WEBHOOK_HEALTH_ZITADEL_STALE_SECONDS,
        stripe: env.WEBHOOK_HEALTH_STRIPE_STALE_SECONDS,
        documenso: env.WEBHOOK_HEALTH_DOCUMENSO_STALE_SECONDS,
      };

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
      const providers = result.rows.map((row) => {
        const lastReceivedAt = row.last_received_at;
        if (!lastReceivedAt) {
          return {
            provider: row.provider,
            status: 'unknown' as const,
            lastReceivedAt: null,
            freshnessSeconds: null,
          };
        }

        const freshnessSeconds = Math.round(
          (now.getTime() - new Date(lastReceivedAt).getTime()) / 1000,
        );
        const threshold = thresholds[row.provider] ?? 3600;
        const status: 'healthy' | 'stale' =
          freshnessSeconds > threshold ? 'stale' : 'healthy';

        return {
          provider: row.provider,
          status,
          lastReceivedAt,
          freshnessSeconds,
        };
      });

      return { timestamp: now.toISOString(), providers };
    }),

  /**
   * Submission trend — this month vs last month, org-scoped.
   * Uses ctx.dbTx (RLS) + explicit organizationId filter (defense-in-depth).
   */
  submissionTrend: adminProcedure
    .output(submissionTrendOutputSchema)
    .query(async ({ ctx }) => {
      const now = new Date();
      const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const orgId = ctx.authContext.orgId;

      const [thisMonthResult] = await ctx.dbTx
        .select({ value: count() })
        .from(submissions)
        .where(
          and(
            eq(submissions.organizationId, orgId),
            gte(submissions.createdAt, thisMonthStart),
          ),
        );

      const [lastMonthResult] = await ctx.dbTx
        .select({ value: count() })
        .from(submissions)
        .where(
          and(
            eq(submissions.organizationId, orgId),
            gte(submissions.createdAt, lastMonthStart),
            lt(submissions.createdAt, thisMonthStart),
          ),
        );

      const thisMonth = thisMonthResult?.value ?? 0;
      const lastMonth = lastMonthResult?.value ?? 0;
      const trend: 'up' | 'down' | 'flat' =
        thisMonth > lastMonth ? 'up' : thisMonth < lastMonth ? 'down' : 'flat';

      return { thisMonth, lastMonth, trend };
    }),
});
