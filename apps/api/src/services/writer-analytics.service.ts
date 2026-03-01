import { sql, type DrizzleDb } from '@colophony/db';
import type { SQL } from 'drizzle-orm';
import type {
  WriterAnalyticsFilter,
  WriterTimeSeriesFilter,
  WriterOverviewStats,
  WriterStatusBreakdown,
  WriterTimeSeries,
  WriterResponseTime,
} from '@colophony/types';
import { NATIVE_TO_CSR } from './portfolio.service.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function nativeDateFilter(filter: WriterAnalyticsFilter, alias = 's'): SQL {
  const parts: SQL[] = [];
  if (filter.startDate) {
    parts.push(sql`${sql.raw(`${alias}.submitted_at`)} >= ${filter.startDate}`);
  }
  if (filter.endDate) {
    parts.push(sql`${sql.raw(`${alias}.submitted_at`)} <= ${filter.endDate}`);
  }
  return parts.length > 0 ? sql.join(parts, sql.raw(' AND ')) : sql.raw('TRUE');
}

function externalDateFilter(filter: WriterAnalyticsFilter, alias = 'es'): SQL {
  const parts: SQL[] = [];
  if (filter.startDate) {
    parts.push(sql`${sql.raw(`${alias}.sent_at`)} >= ${filter.startDate}`);
  }
  if (filter.endDate) {
    parts.push(sql`${sql.raw(`${alias}.sent_at`)} <= ${filter.endDate}`);
  }
  return parts.length > 0 ? sql.join(parts, sql.raw(' AND ')) : sql.raw('TRUE');
}

// ---------------------------------------------------------------------------
// Response time buckets
// ---------------------------------------------------------------------------

const RESPONSE_BUCKETS = [
  { label: '< 7 days', minDays: 0, maxDays: 7 },
  { label: '7-14 days', minDays: 7, maxDays: 14 },
  { label: '14-28 days', minDays: 14, maxDays: 28 },
  { label: '28-60 days', minDays: 28, maxDays: 60 },
  { label: '60+ days', minDays: 60, maxDays: Infinity },
];

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export const writerAnalyticsService = {
  async getOverview(
    tx: DrizzleDb,
    userId: string,
    filter: WriterAnalyticsFilter,
  ): Promise<WriterOverviewStats> {
    const nDateFilter = nativeDateFilter(filter);
    const eDateFilter = externalDateFilter(filter);

    const now = new Date();
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);

    // Native counts
    const [nativeRow] = (
      await tx.execute(sql`
      SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE s.status IN ('ACCEPTED'))::int AS accepted,
        COUNT(*) FILTER (WHERE s.status IN ('REJECTED'))::int AS rejected,
        COUNT(*) FILTER (WHERE s.status IN ('SUBMITTED', 'UNDER_REVIEW', 'HOLD', 'REVISE_AND_RESUBMIT'))::int AS pending,
        COUNT(*) FILTER (WHERE s.submitted_at >= ${thisMonthStart})::int AS this_month,
        COUNT(*) FILTER (WHERE s.submitted_at >= ${lastMonthStart} AND s.submitted_at < ${thisMonthStart})::int AS last_month
      FROM submissions s
      WHERE s.submitter_id = ${userId}
        AND s.status != 'DRAFT'
        AND ${nDateFilter}
    `)
    ).rows as Array<{
      total: number;
      accepted: number;
      rejected: number;
      pending: number;
      this_month: number;
      last_month: number;
    }>;

    // External counts
    const [externalRow] = (
      await tx.execute(sql`
      SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE es.status = 'accepted')::int AS accepted,
        COUNT(*) FILTER (WHERE es.status = 'rejected')::int AS rejected,
        COUNT(*) FILTER (WHERE es.status IN ('sent', 'in_review', 'hold', 'revise'))::int AS pending,
        COUNT(*) FILTER (WHERE es.sent_at >= ${thisMonthStart})::int AS this_month,
        COUNT(*) FILTER (WHERE es.sent_at >= ${lastMonthStart} AND es.sent_at < ${thisMonthStart})::int AS last_month
      FROM external_submissions es
      WHERE es.user_id = ${userId}
        AND ${eDateFilter}
    `)
    ).rows as Array<{
      total: number;
      accepted: number;
      rejected: number;
      pending: number;
      this_month: number;
      last_month: number;
    }>;

    const n = nativeRow ?? {
      total: 0,
      accepted: 0,
      rejected: 0,
      pending: 0,
      this_month: 0,
      last_month: 0,
    };
    const e = externalRow ?? {
      total: 0,
      accepted: 0,
      rejected: 0,
      pending: 0,
      this_month: 0,
      last_month: 0,
    };

    const totalAccepted = n.accepted + e.accepted;
    const totalDecided = totalAccepted + n.rejected + e.rejected;
    const acceptanceRate =
      totalDecided > 0
        ? Math.round((totalAccepted / totalDecided) * 10000) / 100
        : 0;

    // Average response time — native: first terminal transition
    const [nativeAvg] = (
      await tx.execute(sql`
      SELECT AVG(EXTRACT(EPOCH FROM sh.decided_at - s.submitted_at) / 86400) AS avg_days,
             COUNT(*)::int AS cnt
      FROM submissions s
      INNER JOIN LATERAL (
        SELECT MIN(sh2.changed_at) AS decided_at
        FROM submission_history sh2
        WHERE sh2.submission_id = s.id
          AND sh2.to_status IN ('ACCEPTED', 'REJECTED')
      ) sh ON sh.decided_at IS NOT NULL
      WHERE s.submitter_id = ${userId}
        AND s.status != 'DRAFT'
        AND ${nDateFilter}
    `)
    ).rows as Array<{ avg_days: number | null; cnt: number }>;

    // External avg response
    const [externalAvg] = (
      await tx.execute(sql`
      SELECT AVG(EXTRACT(EPOCH FROM (es.responded_at - es.sent_at)) / 86400) AS avg_days,
             COUNT(*)::int AS cnt
      FROM external_submissions es
      WHERE es.user_id = ${userId}
        AND es.responded_at IS NOT NULL
        AND es.sent_at IS NOT NULL
        AND ${eDateFilter}
    `)
    ).rows as Array<{ avg_days: number | null; cnt: number }>;

    // Weighted average
    const nAvg = nativeAvg?.avg_days ?? null;
    const nCnt = nativeAvg?.cnt ?? 0;
    const eAvg = externalAvg?.avg_days ?? null;
    const eCnt = externalAvg?.cnt ?? 0;

    let avgResponseTimeDays: number | null = null;
    if (nCnt + eCnt > 0) {
      const nTotal = nAvg != null ? nAvg * nCnt : 0;
      const eTotal = eAvg != null ? eAvg * eCnt : 0;
      avgResponseTimeDays =
        Math.round(((nTotal + eTotal) / (nCnt + eCnt)) * 10) / 10;
    }

    return {
      totalSubmissions: n.total + e.total,
      nativeCount: n.total,
      externalCount: e.total,
      acceptanceRate,
      avgResponseTimeDays,
      pendingCount: n.pending + e.pending,
      submissionsThisMonth: n.this_month + e.this_month,
      submissionsLastMonth: n.last_month + e.last_month,
    };
  },

  async getStatusBreakdown(
    tx: DrizzleDb,
    userId: string,
    filter: WriterAnalyticsFilter,
  ): Promise<WriterStatusBreakdown> {
    const nDateFilter = nativeDateFilter(filter);
    const eDateFilter = externalDateFilter(filter);

    // Native grouped by status
    const nativeRows = (
      await tx.execute(sql`
      SELECT s.status::text, COUNT(*)::int AS count
      FROM submissions s
      WHERE s.submitter_id = ${userId}
        AND s.status != 'DRAFT'
        AND ${nDateFilter}
      GROUP BY s.status
    `)
    ).rows as Array<{ status: string; count: number }>;

    // External grouped by status
    const externalRows = (
      await tx.execute(sql`
      SELECT es.status::text, COUNT(*)::int AS count
      FROM external_submissions es
      WHERE es.user_id = ${userId}
        AND ${eDateFilter}
      GROUP BY es.status
    `)
    ).rows as Array<{ status: string; count: number }>;

    // Merge into harmonized map
    const countMap = new Map<string, number>();
    for (const row of nativeRows) {
      const csrStatus = NATIVE_TO_CSR[row.status] ?? 'unknown';
      countMap.set(csrStatus, (countMap.get(csrStatus) ?? 0) + row.count);
    }
    for (const row of externalRows) {
      countMap.set(row.status, (countMap.get(row.status) ?? 0) + row.count);
    }

    const breakdown = Array.from(countMap.entries())
      .map(([status, count]) => ({ status, count }))
      .sort((a, b) => b.count - a.count);

    return { breakdown };
  },

  async getTimeSeries(
    tx: DrizzleDb,
    userId: string,
    filter: WriterTimeSeriesFilter,
  ): Promise<WriterTimeSeries> {
    const { granularity = 'monthly' } = filter;
    const nDateFilter = nativeDateFilter(filter);
    const eDateFilter = externalDateFilter(filter);

    const truncUnit =
      granularity === 'daily'
        ? 'day'
        : granularity === 'weekly'
          ? 'week'
          : 'month';

    // Native time series
    const nativePoints = (
      await tx.execute(sql`
      SELECT
        date_trunc(${truncUnit}, s.submitted_at)::date::text AS date,
        COUNT(*)::int AS count
      FROM submissions s
      WHERE s.submitter_id = ${userId}
        AND s.status != 'DRAFT'
        AND s.submitted_at IS NOT NULL
        AND ${nDateFilter}
      GROUP BY 1
      ORDER BY 1
    `)
    ).rows as Array<{ date: string; count: number }>;

    // External time series
    const externalPoints = (
      await tx.execute(sql`
      SELECT
        date_trunc(${truncUnit}, es.sent_at)::date::text AS date,
        COUNT(*)::int AS count
      FROM external_submissions es
      WHERE es.user_id = ${userId}
        AND es.sent_at IS NOT NULL
        AND ${eDateFilter}
      GROUP BY 1
      ORDER BY 1
    `)
    ).rows as Array<{ date: string; count: number }>;

    // Merge into date-keyed map
    const dateMap = new Map<
      string,
      { nativeCount: number; externalCount: number }
    >();

    for (const p of nativePoints) {
      const entry = dateMap.get(p.date) ?? { nativeCount: 0, externalCount: 0 };
      entry.nativeCount += p.count;
      dateMap.set(p.date, entry);
    }
    for (const p of externalPoints) {
      const entry = dateMap.get(p.date) ?? { nativeCount: 0, externalCount: 0 };
      entry.externalCount += p.count;
      dateMap.set(p.date, entry);
    }

    const points = Array.from(dateMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, { nativeCount, externalCount }]) => ({
        date,
        count: nativeCount + externalCount,
        nativeCount,
        externalCount,
      }));

    return { granularity, points };
  },

  async getResponseTime(
    tx: DrizzleDb,
    userId: string,
    filter: WriterAnalyticsFilter,
  ): Promise<WriterResponseTime> {
    const nDateFilter = nativeDateFilter(filter);
    const eDateFilter = externalDateFilter(filter);

    // Native response times (days)
    const nativeDays = (
      await tx.execute(sql`
      SELECT EXTRACT(EPOCH FROM (sh.decided_at - s.submitted_at)) / 86400 AS days
      FROM submissions s
      INNER JOIN LATERAL (
        SELECT MIN(sh2.changed_at) AS decided_at
        FROM submission_history sh2
        WHERE sh2.submission_id = s.id
          AND sh2.to_status IN ('ACCEPTED', 'REJECTED')
      ) sh ON sh.decided_at IS NOT NULL
      WHERE s.submitter_id = ${userId}
        AND s.status != 'DRAFT'
        AND s.submitted_at IS NOT NULL
        AND ${nDateFilter}
    `)
    ).rows as Array<{ days: number }>;

    // External response times (days)
    const externalDays = (
      await tx.execute(sql`
      SELECT EXTRACT(EPOCH FROM (es.responded_at - es.sent_at)) / 86400 AS days
      FROM external_submissions es
      WHERE es.user_id = ${userId}
        AND es.responded_at IS NOT NULL
        AND es.sent_at IS NOT NULL
        AND ${eDateFilter}
    `)
    ).rows as Array<{ days: number }>;

    // Combine and bucket
    const allDays = [...nativeDays, ...externalDays]
      .map((r) => Number(r.days))
      .filter((d) => d >= 0)
      .sort((a, b) => a - b);

    const buckets = RESPONSE_BUCKETS.map((b) => ({
      ...b,
      count: allDays.filter(
        (d) =>
          d >= b.minDays && (b.maxDays === Infinity ? true : d < b.maxDays),
      ).length,
    }));

    // Median
    let medianDays: number | null = null;
    if (allDays.length > 0) {
      const mid = Math.floor(allDays.length / 2);
      const a = allDays[mid - 1] ?? 0;
      const b = allDays[mid] ?? 0;
      medianDays =
        allDays.length % 2 === 0
          ? Math.round(((a + b) / 2) * 10) / 10
          : Math.round(b * 10) / 10;
    }

    return {
      buckets: buckets.map((b) => ({
        label: b.label,
        count: b.count,
        minDays: b.minDays,
        maxDays: b.maxDays === Infinity ? 999 : b.maxDays,
      })),
      medianDays,
    };
  },
};
