import {
  db,
  sql,
  auditEvents,
  eq,
  and,
  gte,
  lte,
  type DrizzleDb,
} from '@colophony/db';
import { desc, count } from 'drizzle-orm';
import type {
  AuditLogParams,
  AuthAuditParams,
  ApiKeyAuditParams,
  EmbedTokenAuditParams,
  UserAuditParams,
  SystemAuditParams,
  ListAuditEventsInput,
} from '@colophony/types';

const MAX_VALUE_LENGTH = 8192;

const SECRET_PATTERN = /token|secret|password|authorization/i;

/**
 * Safely serialize a value to JSON for audit storage.
 *
 * - Scrubs keys matching common secret patterns
 * - Truncates output exceeding 8KB
 * - Handles circular references
 */
export function serializeValue(value: unknown): string | null {
  if (value == null) return null;

  const seen = new WeakSet();

  const json = JSON.stringify(value, (_key, val) => {
    // Scrub secret keys
    if (_key && SECRET_PATTERN.test(_key)) {
      return '[REDACTED]';
    }
    // Handle circular references
    if (typeof val === 'object' && val !== null) {
      if (seen.has(val)) {
        return '[Circular]';
      }
      seen.add(val);
    }
    return val;
  });

  if (json.length > MAX_VALUE_LENGTH) {
    return JSON.stringify({ _truncated: true, _originalSize: json.length });
  }

  return json;
}

/**
 * Build the SQL call to insert_audit_event() SECURITY DEFINER function.
 * Used by both log() and logDirect() to ensure all writes go through the
 * audit_writer-owned function (tamper-proof — app_user cannot INSERT directly).
 */
function insertAuditSql(params: AuditLogParams) {
  return sql`SELECT insert_audit_event(
    ${params.action}::varchar, ${params.resource}::varchar,
    ${params.resourceId ?? null}::uuid, ${params.actorId ?? null}::uuid,
    ${params.organizationId ?? null}::uuid,
    ${serializeValue(params.oldValue)}::text, ${serializeValue(params.newValue)}::text,
    ${params.ipAddress ?? null}::varchar, ${params.userAgent ?? null}::text,
    ${params.requestId ?? null}::varchar, ${params.method ?? null}::varchar,
    ${params.route ?? null}::varchar
  )`;
}

/**
 * Safely parse a JSON string back to an object.
 * Returns the raw string on parse failure to handle malformed rows gracefully.
 */
function safeJsonParse(value: string | null): unknown {
  if (value == null) return null;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

/**
 * Parse an audit event row, deserializing oldValue/newValue from JSON strings.
 */
function parseAuditRow(row: {
  id: string;
  organizationId: string | null;
  actorId: string | null;
  action: string;
  resource: string;
  resourceId: string | null;
  oldValue: string | null;
  newValue: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  requestId: string | null;
  method: string | null;
  route: string | null;
  createdAt: Date;
}) {
  return {
    id: row.id,
    action: row.action,
    resource: row.resource,
    resourceId: row.resourceId,
    actorId: row.actorId,
    oldValue: safeJsonParse(row.oldValue),
    newValue: safeJsonParse(row.newValue),
    ipAddress: row.ipAddress,
    userAgent: row.userAgent,
    requestId: row.requestId,
    method: row.method,
    route: row.route,
    createdAt: row.createdAt,
  };
}

/**
 * Core audit logging service.
 *
 * All writes use the `insert_audit_event()` SECURITY DEFINER function,
 * owned by `audit_writer` (NOSUPERUSER, NOBYPASSRLS). This prevents
 * application code from UPDATE/DELETE on audit_events directly.
 *
 * Errors propagate — audit is atomic with the business operation.
 */
export const auditService = {
  async log(tx: DrizzleDb, params: AuditLogParams): Promise<void> {
    await tx.execute(insertAuditSql(params));
  },

  /**
   * List audit events with optional filters and pagination.
   * RLS handles org scoping automatically.
   */
  async list(tx: DrizzleDb, input: ListAuditEventsInput) {
    const { page, limit, action, resource, actorId, resourceId, from, to } =
      input;
    const offset = (page - 1) * limit;

    const conditions = [];
    if (action) conditions.push(eq(auditEvents.action, action));
    if (resource) conditions.push(eq(auditEvents.resource, resource));
    if (actorId) conditions.push(eq(auditEvents.actorId, actorId));
    if (resourceId) conditions.push(eq(auditEvents.resourceId, resourceId));
    if (from) conditions.push(gte(auditEvents.createdAt, from));
    if (to) conditions.push(lte(auditEvents.createdAt, to));

    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const [items, countResult] = await Promise.all([
      tx
        .select()
        .from(auditEvents)
        .where(where)
        .orderBy(desc(auditEvents.createdAt))
        .limit(limit)
        .offset(offset),
      tx.select({ count: count() }).from(auditEvents).where(where),
    ]);

    const total = countResult[0]?.count ?? 0;

    return {
      items: items.map(parseAuditRow),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  },

  /**
   * Get a single audit event by ID. RLS scoped.
   */
  async getById(tx: DrizzleDb, id: string) {
    const [row] = await tx
      .select()
      .from(auditEvents)
      .where(eq(auditEvents.id, id))
      .limit(1);
    return row ? parseAuditRow(row) : null;
  },

  /**
   * Insert an audit event directly via the shared `db` instance.
   *
   * Used for events that occur before a per-request transaction exists
   * (e.g. auth failures, API key auth failures). Only accepts
   * AuthAuditParams or ApiKeyAuditParams — org-scoped events must
   * use `log()` inside an RLS transaction context.
   *
   * Errors propagate — caller is responsible for try/catch.
   */
  async logDirect(
    params:
      | AuthAuditParams
      | ApiKeyAuditParams
      | EmbedTokenAuditParams
      | UserAuditParams
      | SystemAuditParams,
  ): Promise<void> {
    if (params.organizationId) {
      throw new Error(
        'logDirect must not include organizationId — use auditService.log() inside a transaction for org-scoped events',
      );
    }

    await db.execute(insertAuditSql(params as AuditLogParams));
  },
};
