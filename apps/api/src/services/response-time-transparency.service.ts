import { sql } from 'drizzle-orm';
import { db, withRls, type DrizzleDb } from '@colophony/db';
import { organizations } from '@colophony/db';
import { eq } from 'drizzle-orm';
import type { PublicResponseTimeStats } from '@colophony/types';
import { orgSettingsSchema } from '@colophony/types';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MIN_SAMPLE_SIZE = 10;
const CACHE_TTL_MS = 5 * 60 * 1000;

const BUCKET_DEFS = [
  { label: 'Under 1 week', minDays: 0, maxDays: 7 },
  { label: '1\u20132 weeks', minDays: 7, maxDays: 14 },
  { label: '2\u20134 weeks', minDays: 14, maxDays: 28 },
  { label: '1\u20132 months', minDays: 28, maxDays: 60 },
  { label: '2\u20133 months', minDays: 60, maxDays: 90 },
  { label: 'Over 3 months', minDays: 90, maxDays: null },
] as const;

// ---------------------------------------------------------------------------
// Cache
// ---------------------------------------------------------------------------

interface CacheEntry {
  data: PublicResponseTimeStats | null;
  expiresAt: number;
}

const cache = new Map<string, CacheEntry>();

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

async function isTransparencyEnabled(organizationId: string): Promise<boolean> {
  const org = await db.query.organizations.findFirst({
    where: eq(organizations.id, organizationId),
    columns: { settings: true },
  });
  if (!org) return false;

  const parsed = orgSettingsSchema.safeParse(org.settings ?? {});
  return parsed.success ? parsed.data.responseTimeTransparencyEnabled : true;
}

async function queryStats(
  tx: DrizzleDb,
  organizationId: string,
): Promise<PublicResponseTimeStats | null> {
  // Single CTE for sample size, median, and bucket distribution
  const statsResult = await tx.execute(sql`
    WITH response_times AS (
      SELECT
        EXTRACT(EPOCH FROM (h.changed_at - s.submitted_at)) / 86400 AS response_days
      FROM submissions s
      JOIN LATERAL (
        SELECT MIN(changed_at) AS changed_at
        FROM submission_history sh
        WHERE sh.submission_id = s.id
          AND sh.to_status IN ('ACCEPTED', 'REJECTED')
      ) h ON h.changed_at IS NOT NULL
      WHERE s.organization_id = ${organizationId}::uuid
        AND s.status != 'DRAFT'
    )
    SELECT
      COUNT(*)::int AS sample_size,
      PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY response_days)::float AS median_days,
      COUNT(*) FILTER (WHERE response_days < 7)::int AS bucket_0,
      COUNT(*) FILTER (WHERE response_days >= 7 AND response_days < 14)::int AS bucket_1,
      COUNT(*) FILTER (WHERE response_days >= 14 AND response_days < 28)::int AS bucket_2,
      COUNT(*) FILTER (WHERE response_days >= 28 AND response_days < 60)::int AS bucket_3,
      COUNT(*) FILTER (WHERE response_days >= 60 AND response_days < 90)::int AS bucket_4,
      COUNT(*) FILTER (WHERE response_days >= 90)::int AS bucket_5
    FROM response_times
  `);

  const row = statsResult.rows[0];
  const sampleSize = (row.sample_size as number) ?? 0;

  if (sampleSize < MIN_SAMPLE_SIZE) return null;

  const medianDays = (row.median_days as number) ?? null;

  // Build bucket array with percentages
  const bucketCounts = [
    row.bucket_0 as number,
    row.bucket_1 as number,
    row.bucket_2 as number,
    row.bucket_3 as number,
    row.bucket_4 as number,
    row.bucket_5 as number,
  ];

  const buckets = BUCKET_DEFS.map((def, i) => ({
    label: def.label,
    count: bucketCounts[i],
    percentage:
      sampleSize > 0
        ? Math.round((bucketCounts[i] / sampleSize) * 1000) / 10
        : 0,
    minDays: def.minDays,
    maxDays: def.maxDays,
  }));

  // Trend query (last 6 months)
  const now = new Date();
  const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 6, 1);

  const trendResult = await tx.execute(sql`
    WITH response_times AS (
      SELECT
        date_trunc('month', h.changed_at)::date::text AS month,
        EXTRACT(EPOCH FROM (h.changed_at - s.submitted_at)) / 86400 AS response_days
      FROM submissions s
      JOIN LATERAL (
        SELECT MIN(changed_at) AS changed_at
        FROM submission_history sh
        WHERE sh.submission_id = s.id
          AND sh.to_status IN ('ACCEPTED', 'REJECTED')
      ) h ON h.changed_at IS NOT NULL
      WHERE s.organization_id = ${organizationId}::uuid
        AND s.status != 'DRAFT'
        AND h.changed_at >= ${sixMonthsAgo}
    )
    SELECT
      month,
      PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY response_days)::float AS median_days
    FROM response_times
    GROUP BY month
    ORDER BY month ASC
  `);

  const trend = trendResult.rows.map((r) => ({
    month: (r.month as string).substring(0, 7),
    medianDays: (r.median_days as number) ?? null,
  }));

  return {
    medianDays,
    buckets,
    trend,
    sampleSize,
    source: 'local' as const,
    updatedAt: new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export const responseTimeTransparencyService = {
  /**
   * Get public response time stats for an organization.
   * Returns null if the org has opted out or has insufficient data.
   * Results are cached for 5 minutes.
   */
  async getPublicStats(
    organizationId: string,
  ): Promise<PublicResponseTimeStats | null> {
    // Check cache
    const cached = cache.get(organizationId);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.data;
    }

    // Check org settings (no RLS needed — organizations table is global)
    const enabled = await isTransparencyEnabled(organizationId);
    if (!enabled) {
      cache.set(organizationId, {
        data: null,
        expiresAt: Date.now() + CACHE_TTL_MS,
      });
      return null;
    }

    // Query within RLS context for tenant isolation
    const stats = await withRls({ orgId: organizationId }, (tx) =>
      queryStats(tx, organizationId),
    );

    cache.set(organizationId, {
      data: stats,
      expiresAt: Date.now() + CACHE_TTL_MS,
    });

    return stats;
  },

  /** Clear cached stats for an organization (call on settings change). */
  invalidateCache(organizationId: string): void {
    cache.delete(organizationId);
  },
};
