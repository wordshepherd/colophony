import { db, sql, type DrizzleDb } from '@colophony/db';
import type {
  AuditLogParams,
  AuthAuditParams,
  ApiKeyAuditParams,
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
   * Insert an audit event directly via the shared `db` instance.
   *
   * Used for events that occur before a per-request transaction exists
   * (e.g. auth failures, API key auth failures). Only accepts
   * AuthAuditParams or ApiKeyAuditParams — org-scoped events must
   * use `log()` inside an RLS transaction context.
   *
   * Errors propagate — caller is responsible for try/catch.
   */
  async logDirect(params: AuthAuditParams | ApiKeyAuditParams): Promise<void> {
    if (params.organizationId) {
      throw new Error(
        'logDirect must not include organizationId — use auditService.log() inside a transaction for org-scoped events',
      );
    }

    await db.execute(insertAuditSql(params as AuditLogParams));
  },
};
