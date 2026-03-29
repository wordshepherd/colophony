import { sql, type SQL } from 'drizzle-orm';
import type { DrizzleDb } from '@colophony/db';
import type {
  EditorialAnalyticsFilter,
  AcceptanceByGenre,
  AcceptanceByPeriod,
  ResponseTimeStats,
  PipelineHealth,
  GenreDistribution,
  ContributorDiversity,
  ReaderAlignment,
} from '@colophony/types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Build WHERE conditions for editorial analytics queries.
 * Defense-in-depth: always includes explicit organization_id filter.
 */
function buildEditorialWhere(
  organizationId: string,
  filter: EditorialAnalyticsFilter,
  alias = 's',
): SQL {
  const parts: SQL[] = [
    sql`${sql.raw(`${alias}.organization_id`)} = ${organizationId}::uuid`,
    sql.raw(`${alias}.status != 'DRAFT'`),
  ];

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

/**
 * Build genre filter SQL fragment. When genre is set, requires a genre JOIN
 * and filters by the specific genre value.
 */
function genreFilterSql(filter: EditorialAnalyticsFilter): SQL {
  if (!filter.genre) return sql``;
  return sql` AND m.genre->>'primary' = ${filter.genre}`;
}

/**
 * Genre JOIN fragment: submissions → manuscript_versions → manuscripts.
 * Uses LEFT JOIN so submissions without manuscripts appear as "unknown" genre.
 */
function genreJoin(alias = 's'): SQL {
  return sql.raw(
    `LEFT JOIN manuscript_versions mv ON mv.id = ${alias}.manuscript_version_id ` +
      `LEFT JOIN manuscripts m ON m.id = mv.manuscript_id`,
  );
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export const editorialAnalyticsService = {
  /**
   * Acceptance rate broken down by primary genre.
   */
  async getAcceptanceByGenre(
    tx: DrizzleDb,
    organizationId: string,
    filter: EditorialAnalyticsFilter,
  ): Promise<AcceptanceByGenre> {
    const where = buildEditorialWhere(organizationId, filter);

    const result = await tx.execute(sql`
      SELECT
        COALESCE(m.genre->>'primary', 'unknown') AS genre,
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE s.status = 'ACCEPTED')::int AS accepted,
        COUNT(*) FILTER (WHERE s.status = 'REJECTED')::int AS rejected,
        COALESCE(
          ROUND(
            COUNT(*) FILTER (WHERE s.status = 'ACCEPTED')::numeric
            / NULLIF(COUNT(*) FILTER (WHERE s.status IN ('ACCEPTED', 'REJECTED'))::numeric, 0)
            * 100, 1
          ), 0
        )::float AS rate
      FROM submissions s
      ${genreJoin()}
      WHERE ${where}${genreFilterSql(filter)}
      GROUP BY m.genre->>'primary'
      ORDER BY total DESC
      LIMIT 50
    `);

    return {
      genres: result.rows.map((row) => ({
        genre: row.genre as string,
        total: row.total as number,
        accepted: row.accepted as number,
        rejected: row.rejected as number,
        rate: row.rate as number,
      })),
    };
  },

  /**
   * Acceptance rate broken down by submission period.
   */
  async getAcceptanceByPeriod(
    tx: DrizzleDb,
    organizationId: string,
    filter: EditorialAnalyticsFilter,
  ): Promise<AcceptanceByPeriod> {
    const where = buildEditorialWhere(organizationId, filter);

    const gJoin = filter.genre ? genreJoin() : sql``;

    const result = await tx.execute(sql`
      SELECT
        sp.id AS "periodId",
        sp.name AS "periodName",
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE s.status = 'ACCEPTED')::int AS accepted,
        COUNT(*) FILTER (WHERE s.status = 'REJECTED')::int AS rejected,
        COALESCE(
          ROUND(
            COUNT(*) FILTER (WHERE s.status = 'ACCEPTED')::numeric
            / NULLIF(COUNT(*) FILTER (WHERE s.status IN ('ACCEPTED', 'REJECTED'))::numeric, 0)
            * 100, 1
          ), 0
        )::float AS rate
      FROM submissions s
      JOIN submission_periods sp ON sp.id = s.submission_period_id
      ${gJoin}
      WHERE ${where}${genreFilterSql(filter)}
      GROUP BY sp.id, sp.name
      ORDER BY sp.closes_at DESC NULLS LAST
      LIMIT 50
    `);

    return {
      periods: result.rows.map((row) => ({
        periodId: row.periodId as string,
        periodName: row.periodName as string,
        total: row.total as number,
        accepted: row.accepted as number,
        rejected: row.rejected as number,
        rate: row.rate as number,
      })),
    };
  },

  /**
   * Response time statistics: avg, median, p90, and monthly trend.
   */
  async getResponseTimeStats(
    tx: DrizzleDb,
    organizationId: string,
    filter: EditorialAnalyticsFilter,
  ): Promise<ResponseTimeStats> {
    const where = buildEditorialWhere(organizationId, filter);

    // Overall stats
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
        WHERE ${where}
      )
      SELECT
        ROUND(AVG(response_days), 1)::float AS "avgDays",
        PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY response_days)::float AS "medianDays",
        PERCENTILE_CONT(0.9) WITHIN GROUP (ORDER BY response_days)::float AS "p90Days"
      FROM response_times
    `);

    const statsRow = statsResult.rows[0];

    // Monthly trend (last 6 months)
    const now = new Date();
    const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 6, 1);

    const trendWhere = buildEditorialWhere(organizationId, filter);

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
        WHERE ${trendWhere}
          AND h.changed_at >= ${sixMonthsAgo}
      )
      SELECT
        month,
        PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY response_days)::float AS "medianDays"
      FROM response_times
      GROUP BY month
      ORDER BY month ASC
    `);

    return {
      avgDays: (statsRow.avgDays as number) ?? null,
      medianDays: (statsRow.medianDays as number) ?? null,
      p90Days: (statsRow.p90Days as number) ?? null,
      trend: trendResult.rows.map((row) => ({
        month: (row.month as string).substring(0, 7),
        medianDays: (row.medianDays as number) ?? null,
      })),
    };
  },

  /**
   * Pipeline health: items per stage, avg days, stuck count.
   */
  async getPipelineHealth(
    tx: DrizzleDb,
    organizationId: string,
    filter: EditorialAnalyticsFilter,
  ): Promise<PipelineHealth> {
    // Pipeline items don't have submitted_at, so date filters apply to created_at
    const dateParts: SQL[] = [
      sql`pi.organization_id = ${organizationId}::uuid`,
    ];
    if (filter.startDate) {
      dateParts.push(sql`pi.created_at >= ${filter.startDate}`);
    }
    if (filter.endDate) {
      dateParts.push(sql`pi.created_at <= ${filter.endDate}`);
    }
    const pipelineWhere = sql.join(dateParts, sql.raw(' AND '));

    const result = await tx.execute(sql`
      SELECT
        pi.stage,
        COUNT(*)::int AS count,
        ROUND(AVG(EXTRACT(EPOCH FROM (NOW() - pi.updated_at)) / 86400), 1)::float AS "avgDaysInStage",
        COUNT(*) FILTER (
          WHERE EXTRACT(EPOCH FROM (NOW() - pi.updated_at)) / 86400 > 14
        )::int AS "stuckCount"
      FROM pipeline_items pi
      WHERE ${pipelineWhere}
        AND pi.stage NOT IN ('PUBLISHED', 'WITHDRAWN')
      GROUP BY pi.stage
      ORDER BY count DESC
    `);

    return {
      stages: result.rows.map((row) => ({
        stage: row.stage as string,
        count: row.count as number,
        avgDaysInStage: (row.avgDaysInStage as number) ?? null,
        stuckCount: row.stuckCount as number,
      })),
    };
  },

  /**
   * Genre distribution of non-draft submissions.
   */
  async getGenreDistribution(
    tx: DrizzleDb,
    organizationId: string,
    filter: EditorialAnalyticsFilter,
  ): Promise<GenreDistribution> {
    const where = buildEditorialWhere(organizationId, filter);

    const result = await tx.execute(sql`
      SELECT
        COALESCE(m.genre->>'primary', 'unknown') AS genre,
        COUNT(*)::int AS count
      FROM submissions s
      ${genreJoin()}
      WHERE ${where}${genreFilterSql(filter)}
      GROUP BY m.genre->>'primary'
      ORDER BY count DESC
      LIMIT 50
    `);

    return {
      distribution: result.rows.map((row) => ({
        genre: row.genre as string,
        count: row.count as number,
      })),
    };
  },

  /**
   * Contributor diversity: new vs returning submitters per period,
   * and genre spread of accepted submitters.
   */
  async getContributorDiversity(
    tx: DrizzleDb,
    organizationId: string,
    filter: EditorialAnalyticsFilter,
  ): Promise<ContributorDiversity> {
    // Build optional filter fragments
    const extraFilters = [
      filter.startDate ? sql`AND s.submitted_at >= ${filter.startDate}` : sql``,
      filter.endDate ? sql`AND s.submitted_at <= ${filter.endDate}` : sql``,
      filter.submissionPeriodId
        ? sql`AND s.submission_period_id = ${filter.submissionPeriodId}::uuid`
        : sql``,
    ];

    // New vs returning submitters per period
    const newReturningResult = await tx.execute(sql`
      WITH first_submissions AS (
        SELECT
          submitter_id,
          MIN(submitted_at) AS first_submitted_at
        FROM submissions
        WHERE organization_id = ${organizationId}::uuid
          AND status != 'DRAFT'
          AND submitted_at IS NOT NULL
        GROUP BY submitter_id
      ),
      period_submitters AS (
        SELECT DISTINCT
          s.submission_period_id,
          s.submitter_id,
          CASE
            WHEN fs.first_submitted_at >= sp.opens_at THEN 'new'
            ELSE 'returning'
          END AS submitter_type
        FROM submissions s
        JOIN submission_periods sp ON sp.id = s.submission_period_id
        JOIN first_submissions fs ON fs.submitter_id = s.submitter_id
        WHERE s.organization_id = ${organizationId}::uuid
          AND s.status != 'DRAFT'
          AND s.submitted_at IS NOT NULL
          ${extraFilters[0]}
          ${extraFilters[1]}
          ${extraFilters[2]}
      )
      SELECT
        sp.name AS "periodName",
        COUNT(*) FILTER (WHERE ps.submitter_type = 'new')::int AS "newCount",
        COUNT(*) FILTER (WHERE ps.submitter_type = 'returning')::int AS "returningCount"
      FROM period_submitters ps
      JOIN submission_periods sp ON sp.id = ps.submission_period_id
      GROUP BY sp.name, sp.closes_at
      ORDER BY sp.closes_at DESC NULLS LAST
      LIMIT 20
    `);

    // Genre spread of accepted submitters
    const genreSpreadResult = await tx.execute(sql`
      SELECT
        COALESCE(m.genre->>'primary', 'unknown') AS genre,
        COUNT(DISTINCT s.submitter_id)::int AS count
      FROM submissions s
      ${genreJoin()}
      WHERE s.organization_id = ${organizationId}::uuid
        AND s.status = 'ACCEPTED'
        ${extraFilters[0]}
        ${extraFilters[1]}
        ${extraFilters[2]}
        ${genreFilterSql(filter)}
      GROUP BY m.genre->>'primary'
      ORDER BY count DESC
      LIMIT 50
    `);

    return {
      newVsReturning: newReturningResult.rows.map((row) => ({
        periodName: row.periodName as string,
        newCount: row.newCount as number,
        returningCount: row.returningCount as number,
      })),
      genreSpread: genreSpreadResult.rows.map((row) => ({
        genre: row.genre as string,
        count: row.count as number,
      })),
    };
  },

  /**
   * Reader alignment: vote consensus rate vs final decisions.
   * For decided submissions with votes, checks if majority vote
   * matched the final status.
   */
  async getReaderAlignment(
    tx: DrizzleDb,
    organizationId: string,
    filter: EditorialAnalyticsFilter,
  ): Promise<ReaderAlignment> {
    const where = buildEditorialWhere(organizationId, filter);

    const result = await tx.execute(sql`
      WITH decided_with_votes AS (
        SELECT
          s.id AS submission_id,
          s.title,
          s.status AS final_status,
          (
            SELECT sv.decision
            FROM submission_votes sv
            WHERE sv.submission_id = s.id
              AND sv.decision != 'MAYBE'
            GROUP BY sv.decision
            ORDER BY COUNT(*) DESC
            LIMIT 1
          ) AS majority_vote,
          (
            SELECT COUNT(*)::int
            FROM submission_votes sv
            WHERE sv.submission_id = s.id
          ) AS vote_count
        FROM submissions s
        WHERE ${where}
          AND s.status IN ('ACCEPTED', 'REJECTED')
          AND EXISTS (
            SELECT 1 FROM submission_votes sv WHERE sv.submission_id = s.id
          )
      )
      SELECT
        submission_id AS "submissionId",
        title,
        final_status AS "finalStatus",
        majority_vote AS "majorityVote",
        vote_count AS "voteCount",
        CASE
          WHEN final_status = 'ACCEPTED' AND majority_vote = 'ACCEPT' THEN true
          WHEN final_status = 'REJECTED' AND majority_vote = 'REJECT' THEN true
          ELSE false
        END AS matched
      FROM decided_with_votes
      WHERE majority_vote IS NOT NULL
      ORDER BY vote_count DESC
      LIMIT 50
    `);

    const rows = result.rows as Array<{
      submissionId: string;
      title: string | null;
      finalStatus: string;
      majorityVote: string;
      voteCount: number;
      matched: boolean;
    }>;

    const totalWithVotes = rows.length;
    const consensusMatches = rows.filter((r) => r.matched).length;

    // Get total decided count for context (using same filters)
    const decidedResult = await tx.execute(sql`
      SELECT COUNT(*)::int AS count
      FROM submissions s
      WHERE ${where}
        AND s.status IN ('ACCEPTED', 'REJECTED')
    `);

    return {
      totalDecided: (decidedResult.rows[0].count as number) ?? 0,
      totalWithVotes,
      consensusMatches,
      consensusRate:
        totalWithVotes > 0
          ? Math.round((consensusMatches / totalWithVotes) * 1000) / 10
          : 0,
      breakdown: rows.map((row) => ({
        submissionId: row.submissionId,
        title: row.title,
        finalStatus: row.finalStatus,
        majorityVote: row.majorityVote,
        matched: row.matched,
        voteCount: row.voteCount,
      })),
    };
  },
};
