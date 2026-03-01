import { sql, type SQL } from 'drizzle-orm';
import type { DrizzleDb } from '@colophony/db';
import type {
  AnalyticsFilter,
  TimeSeriesFilter,
  AgingFilter,
  SubmissionOverviewStats,
  SubmissionStatusBreakdown,
  SubmissionFunnel,
  SubmissionTimeSeries,
  ResponseTimeDistribution,
  AgingSubmissions,
} from '@colophony/types';

// ---------------------------------------------------------------------------
// Status sets
// ---------------------------------------------------------------------------

/** Funnel stage ordering — matches the submission workflow progression. */
const FUNNEL_STAGE_ORDER = [
  'SUBMITTED',
  'UNDER_REVIEW',
  'HOLD',
  'REVISE_AND_RESUBMIT',
  'ACCEPTED',
  'REJECTED',
  'WITHDRAWN',
] as const;

// ---------------------------------------------------------------------------
// Helpers — parameterized SQL fragments (defense-in-depth)
// ---------------------------------------------------------------------------

/**
 * Build parameterized WHERE conditions from the analytics filter.
 * Returns SQL fragments using Drizzle's tagged template for safe interpolation.
 * The `alias` param controls the table alias (e.g., 's', 's2', 'sub').
 */
function buildFilterWhere(filter: AnalyticsFilter, alias = 's'): SQL {
  const parts: SQL[] = [sql.raw(`${alias}.status != 'DRAFT'`)];

  if (filter.startDate) {
    parts.push(sql`${sql.raw(`${alias}.submitted_at`)} >= ${filter.startDate}`);
  }
  if (filter.endDate) {
    parts.push(sql`${sql.raw(`${alias}.submitted_at`)} <= ${filter.endDate}`);
  }
  if (filter.submissionPeriodId) {
    parts.push(
      sql`${sql.raw(`${alias}.submission_period_id`)} = ${filter.submissionPeriodId}::uuid`,
    );
  }

  return sql.join(parts, sql.raw(' AND '));
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export const submissionAnalyticsService = {
  async getOverviewStats(
    tx: DrizzleDb,
    filter: AnalyticsFilter,
  ): Promise<SubmissionOverviewStats> {
    const where = buildFilterWhere(filter);
    const subWhere = buildFilterWhere(filter, 's2');

    const now = new Date();
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);

    const result = await tx.execute(sql`
      SELECT
        COUNT(*)::int AS "totalSubmissions",
        COUNT(*) FILTER (WHERE s.status IN ('SUBMITTED', 'UNDER_REVIEW', 'HOLD', 'REVISE_AND_RESUBMIT'))::int AS "pendingCount",
        COALESCE(
          ROUND(
            COUNT(*) FILTER (WHERE s.status = 'ACCEPTED')::numeric
            / NULLIF(COUNT(*) FILTER (WHERE s.status IN ('ACCEPTED', 'REJECTED'))::numeric, 0)
            * 100,
            1
          ),
          0
        )::float AS "acceptanceRate",
        (
          SELECT ROUND(AVG(EXTRACT(EPOCH FROM (h.changed_at - s2.submitted_at)) / 86400), 1)::float
          FROM submissions s2
          JOIN LATERAL (
            SELECT MIN(changed_at) AS changed_at
            FROM submission_history sh
            WHERE sh.submission_id = s2.id
              AND sh.to_status IN ('ACCEPTED', 'REJECTED')
          ) h ON h.changed_at IS NOT NULL
          WHERE ${subWhere}
        ) AS "avgResponseTimeDays",
        COUNT(*) FILTER (WHERE s.submitted_at >= ${thisMonthStart})::int AS "submissionsThisMonth",
        COUNT(*) FILTER (WHERE s.submitted_at >= ${lastMonthStart} AND s.submitted_at < ${thisMonthStart})::int AS "submissionsLastMonth"
      FROM submissions s
      WHERE ${where}
    `);

    const row = result.rows[0];
    return {
      totalSubmissions: (row.totalSubmissions as number) ?? 0,
      acceptanceRate: (row.acceptanceRate as number) ?? 0,
      avgResponseTimeDays: (row.avgResponseTimeDays as number) ?? null,
      pendingCount: (row.pendingCount as number) ?? 0,
      submissionsThisMonth: (row.submissionsThisMonth as number) ?? 0,
      submissionsLastMonth: (row.submissionsLastMonth as number) ?? 0,
    };
  },

  async getStatusBreakdown(
    tx: DrizzleDb,
    filter: AnalyticsFilter,
  ): Promise<SubmissionStatusBreakdown> {
    const where = buildFilterWhere(filter);

    const result = await tx.execute(sql`
      SELECT s.status, COUNT(*)::int AS count
      FROM submissions s
      WHERE ${where}
      GROUP BY s.status
      ORDER BY count DESC
    `);

    return {
      breakdown: result.rows.map((row) => ({
        status: row.status as string,
        count: row.count as number,
      })),
    };
  },

  async getFunnel(
    tx: DrizzleDb,
    filter: AnalyticsFilter,
  ): Promise<SubmissionFunnel> {
    const where = buildFilterWhere(filter, 'sub');

    const result = await tx.execute(sql`
      SELECT sh.to_status AS stage, COUNT(DISTINCT sh.submission_id)::int AS count
      FROM submission_history sh
      JOIN submissions sub ON sub.id = sh.submission_id
      WHERE ${where}
      GROUP BY sh.to_status
    `);

    const countMap = new Map<string, number>();
    for (const row of result.rows) {
      countMap.set(row.stage as string, row.count as number);
    }

    const stages = FUNNEL_STAGE_ORDER.map((stage) => ({
      stage,
      count: countMap.get(stage) ?? 0,
    }));

    return { stages };
  },

  async getTimeSeries(
    tx: DrizzleDb,
    filter: TimeSeriesFilter,
  ): Promise<SubmissionTimeSeries> {
    const where = buildFilterWhere(filter);
    // Granularity is validated by Zod enum — safe to use in sql.raw
    const truncUnit =
      filter.granularity === 'daily'
        ? 'day'
        : filter.granularity === 'weekly'
          ? 'week'
          : 'month';

    const result = await tx.execute(sql`
      SELECT
        date_trunc(${truncUnit}, s.submitted_at)::date::text AS date,
        COUNT(*)::int AS count
      FROM submissions s
      WHERE ${where}
        AND s.submitted_at IS NOT NULL
      GROUP BY 1
      ORDER BY 1 ASC
    `);

    return {
      granularity: filter.granularity,
      points: result.rows.map((row) => ({
        date: row.date as string,
        count: row.count as number,
      })),
    };
  },

  async getResponseTimeDistribution(
    tx: DrizzleDb,
    filter: AnalyticsFilter,
  ): Promise<ResponseTimeDistribution> {
    const where = buildFilterWhere(filter);

    const result = await tx.execute(sql`
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
        WHERE ${where}
      )
      SELECT
        COUNT(*) FILTER (WHERE response_days < 7)::int AS "bucket_0_7",
        COUNT(*) FILTER (WHERE response_days >= 7 AND response_days < 14)::int AS "bucket_7_14",
        COUNT(*) FILTER (WHERE response_days >= 14 AND response_days < 28)::int AS "bucket_14_28",
        COUNT(*) FILTER (WHERE response_days >= 28 AND response_days < 60)::int AS "bucket_28_60",
        COUNT(*) FILTER (WHERE response_days >= 60)::int AS "bucket_60_plus",
        PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY response_days)::float AS "medianDays"
      FROM response_times
    `);

    const row = result.rows[0];

    return {
      buckets: [
        {
          label: '< 7 days',
          count: (row.bucket_0_7 as number) ?? 0,
          minDays: 0,
          maxDays: 7,
        },
        {
          label: '7-14 days',
          count: (row.bucket_7_14 as number) ?? 0,
          minDays: 7,
          maxDays: 14,
        },
        {
          label: '14-28 days',
          count: (row.bucket_14_28 as number) ?? 0,
          minDays: 14,
          maxDays: 28,
        },
        {
          label: '28-60 days',
          count: (row.bucket_28_60 as number) ?? 0,
          minDays: 28,
          maxDays: 60,
        },
        {
          label: '60+ days',
          count: (row.bucket_60_plus as number) ?? 0,
          minDays: 60,
          maxDays: Infinity,
        },
      ],
      medianDays: (row.medianDays as number) ?? null,
    };
  },

  async getAgingSubmissions(
    tx: DrizzleDb,
    filter: Omit<AgingFilter, 'maxPerBracket'> & { maxPerBracket?: number },
  ): Promise<AgingSubmissions> {
    const baseWhere = buildFilterWhere(filter);

    const result = await tx.execute(sql`
      SELECT
        s.id,
        s.title,
        s.status,
        s.submitted_at AS "submittedAt",
        EXTRACT(EPOCH FROM (NOW() - s.submitted_at)) / 86400 AS "daysPending"
      FROM submissions s
      WHERE ${baseWhere}
        AND s.status IN ('SUBMITTED', 'UNDER_REVIEW', 'HOLD', 'REVISE_AND_RESUBMIT')
        AND s.submitted_at IS NOT NULL
      ORDER BY s.submitted_at ASC
      LIMIT 10000
    `);

    const threshold = filter.thresholdDays;
    const maxPerBracket = filter.maxPerBracket ?? 25;

    // Define age brackets relative to threshold
    const bracketDefs = [
      {
        label: `${threshold}-${threshold * 2} days`,
        min: threshold,
        max: threshold * 2,
      },
      {
        label: `${threshold * 2}-${threshold * 4} days`,
        min: threshold * 2,
        max: threshold * 4,
      },
      { label: `${threshold * 4}+ days`, min: threshold * 4, max: Infinity },
    ];

    const brackets = bracketDefs.map((def) => ({
      label: def.label,
      count: 0,
      submissions: [] as Array<{
        id: string;
        title: string | null;
        status: string;
        submittedAt: Date | null;
        daysPending: number;
      }>,
    }));

    let totalAging = 0;

    for (const row of result.rows) {
      const daysPending = Math.floor(row.daysPending as number);
      if (daysPending < threshold) continue;

      totalAging++;
      const sub = {
        id: row.id as string,
        title: row.title as string | null,
        status: row.status as string,
        submittedAt: row.submittedAt
          ? new Date(row.submittedAt as string)
          : null,
        daysPending,
      };

      for (let i = brackets.length - 1; i >= 0; i--) {
        if (daysPending >= bracketDefs[i].min) {
          brackets[i].count++;
          if (brackets[i].submissions.length < maxPerBracket) {
            brackets[i].submissions.push(sub);
          }
          break;
        }
      }
    }

    return { brackets, totalAging };
  },
};
