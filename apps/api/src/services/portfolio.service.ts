import { sql, type DrizzleDb } from '@colophony/db';
import type { SQL } from 'drizzle-orm';
import type {
  CSRStatus,
  ListPortfolioInput,
  PortfolioItem,
  PortfolioListResponse,
} from '@colophony/types';

// ---------------------------------------------------------------------------
// Status mapping — native (uppercase) ↔ CSR (lowercase)
// ---------------------------------------------------------------------------

export const NATIVE_TO_CSR: Record<string, CSRStatus> = {
  DRAFT: 'draft',
  SUBMITTED: 'sent',
  UNDER_REVIEW: 'in_review',
  HOLD: 'hold',
  ACCEPTED: 'accepted',
  REJECTED: 'rejected',
  WITHDRAWN: 'withdrawn',
  REVISE_AND_RESUBMIT: 'revise',
};

export const CSR_TO_NATIVE: Record<string, string[]> = {
  draft: ['DRAFT'],
  sent: ['SUBMITTED'],
  in_review: ['UNDER_REVIEW'],
  hold: ['HOLD'],
  accepted: ['ACCEPTED'],
  rejected: ['REJECTED'],
  withdrawn: ['WITHDRAWN'],
  revise: ['REVISE_AND_RESUBMIT'],
  no_response: [],
  unknown: [],
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildNativeSubquery(
  userId: string,
  status: CSRStatus | undefined,
  searchEscaped: string | null,
): SQL | null {
  if (status) {
    const nativeStatuses = CSR_TO_NATIVE[status] ?? [];
    if (nativeStatuses.length === 0) return null;
  }

  const conditions: SQL[] = [sql`s.submitter_id = ${userId}`];
  conditions.push(sql.raw(`s.status != 'DRAFT'`));

  if (status) {
    const nativeStatuses = CSR_TO_NATIVE[status]!;
    const statusList = nativeStatuses.map((s) => sql`${s}`);
    conditions.push(
      sql`s.status::text IN (${sql.join(statusList, sql.raw(', '))})`,
    );
  }

  if (searchEscaped) {
    conditions.push(
      sql`(s.title ILIKE '%' || ${searchEscaped} || '%' OR o.name ILIKE '%' || ${searchEscaped} || '%')`,
    );
  }

  const where = sql.join(conditions, sql.raw(' AND '));

  return sql`
    SELECT
      'native'::text AS source,
      s.id,
      s.title,
      o.name AS journal_name,
      CASE s.status::text
        WHEN 'DRAFT' THEN 'draft'
        WHEN 'SUBMITTED' THEN 'sent'
        WHEN 'UNDER_REVIEW' THEN 'in_review'
        WHEN 'HOLD' THEN 'hold'
        WHEN 'ACCEPTED' THEN 'accepted'
        WHEN 'REJECTED' THEN 'rejected'
        WHEN 'WITHDRAWN' THEN 'withdrawn'
        WHEN 'REVISE_AND_RESUBMIT' THEN 'revise'
        ELSE 'unknown'
      END AS status,
      s.submitted_at AS sent_at,
      sh_decision.decided_at AS responded_at,
      m.id AS manuscript_id,
      m.title AS manuscript_title,
      s.created_at
    FROM submissions s
    LEFT JOIN organizations o ON o.id = s.organization_id
    LEFT JOIN manuscript_versions mv ON mv.id = s.manuscript_version_id
    LEFT JOIN manuscripts m ON m.id = mv.manuscript_id
    LEFT JOIN LATERAL (
      SELECT MIN(sh.changed_at) AS decided_at
      FROM submission_history sh
      WHERE sh.submission_id = s.id
        AND sh.to_status IN ('ACCEPTED', 'REJECTED', 'WITHDRAWN')
    ) sh_decision ON true
    WHERE ${where}
  `;
}

function buildExternalSubquery(
  userId: string,
  status: CSRStatus | undefined,
  searchEscaped: string | null,
): SQL {
  const conditions: SQL[] = [sql`es.user_id = ${userId}`];

  if (status) {
    conditions.push(sql`es.status::text = ${status}`);
  }
  if (searchEscaped) {
    conditions.push(sql`es.journal_name ILIKE '%' || ${searchEscaped} || '%'`);
  }

  const where = sql.join(conditions, sql.raw(' AND '));

  return sql`
    SELECT
      'external'::text AS source,
      es.id,
      es.journal_name AS title,
      es.journal_name,
      es.status::text,
      es.sent_at,
      es.responded_at,
      es.manuscript_id,
      m2.title AS manuscript_title,
      es.created_at
    FROM external_submissions es
    LEFT JOIN manuscripts m2 ON m2.id = es.manuscript_id
    WHERE ${where}
  `;
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export const portfolioService = {
  async list(
    tx: DrizzleDb,
    userId: string,
    input: ListPortfolioInput,
  ): Promise<PortfolioListResponse> {
    const { search, status, source, page, limit } = input;
    const offset = (page - 1) * limit;

    const searchEscaped = search ? search.replace(/[\\%_]/g, '\\$&') : null;

    const includeNative = !source || source === 'native';
    const includeExternal = !source || source === 'external';

    const parts: SQL[] = [];

    if (includeNative) {
      const nativeSql = buildNativeSubquery(userId, status, searchEscaped);
      if (nativeSql) parts.push(nativeSql);
    }
    if (includeExternal) {
      parts.push(buildExternalSubquery(userId, status, searchEscaped));
    }

    if (parts.length === 0) {
      return { items: [], total: 0, page, limit, totalPages: 0 };
    }

    const unionQuery =
      parts.length === 1 ? parts[0]! : sql.join(parts, sql.raw(' UNION ALL '));

    const result = await tx.execute(sql`
      WITH portfolio AS (${unionQuery})
      SELECT
        (SELECT COUNT(*)::int FROM portfolio) AS total,
        p.*
      FROM portfolio p
      ORDER BY p.created_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `);

    const rows = result.rows as Array<{
      total: number;
      source: string;
      id: string;
      title: string | null;
      journal_name: string | null;
      status: string;
      sent_at: string | Date | null;
      responded_at: string | Date | null;
      manuscript_id: string | null;
      manuscript_title: string | null;
      created_at: string | Date;
    }>;

    const total = rows[0]?.total ?? 0;

    const items: PortfolioItem[] = rows.map((row) => ({
      id: row.id,
      source: row.source as 'native' | 'external',
      title: row.title,
      journalName: row.journal_name,
      status: row.status as CSRStatus,
      sentAt: row.sent_at
        ? new Date(row.sent_at as string).toISOString()
        : null,
      respondedAt: row.responded_at
        ? new Date(row.responded_at as string).toISOString()
        : null,
      manuscriptId: row.manuscript_id,
      manuscriptTitle: row.manuscript_title,
      createdAt: new Date(row.created_at as string).toISOString(),
    }));

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  },
};
