import { auditEvents, db, type DrizzleDb } from '@colophony/db';
import type { AuditLogParams, AuthAuditParams } from '@prospector/types';

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
 * Core audit logging service.
 *
 * Inserts into the `audit_events` table using the caller's transaction.
 * Errors propagate — audit is atomic with the business operation.
 */
export const auditService = {
  async log(tx: DrizzleDb, params: AuditLogParams): Promise<void> {
    await tx.insert(auditEvents).values({
      action: params.action,
      resource: params.resource,
      resourceId: params.resourceId,
      actorId: params.actorId,
      organizationId: params.organizationId,
      oldValue: serializeValue(params.oldValue),
      newValue: serializeValue(params.newValue),
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
    });
  },

  /**
   * Insert an audit event directly via the shared `db` instance.
   *
   * Used for events that occur before a per-request transaction exists
   * (e.g. auth failures). Only accepts AuthAuditParams — org-scoped
   * events must use `log()` inside an RLS transaction context.
   *
   * Errors propagate — caller is responsible for try/catch.
   */
  async logDirect(params: AuthAuditParams): Promise<void> {
    if (params.organizationId) {
      throw new Error(
        'logDirect must not include organizationId — use auditService.log() inside a transaction for org-scoped events',
      );
    }

    await db.insert(auditEvents).values({
      action: params.action,
      resource: params.resource,
      resourceId: params.resourceId,
      actorId: params.actorId,
      oldValue: serializeValue(params.oldValue),
      newValue: serializeValue(params.newValue),
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
    });
  },
};
