import type { DrizzleDb } from '@colophony/db';
import type { AuditLogParams, Role } from '@colophony/types';

/**
 * Audit function compatible with the request-scoped `RequestAuditFn` from the
 * audit hook. The closure already enriches with HTTP metadata (actorId, orgId,
 * IP, user-agent), so callers only supply business-level fields.
 */
export type AuditFn = (
  params: Omit<
    AuditLogParams,
    'actorId' | 'organizationId' | 'ipAddress' | 'userAgent'
  >,
) => Promise<void>;

/**
 * Request-scoped context passed to service methods that operate within an
 * RLS-scoped transaction. Works for tRPC, REST (ts-rest), and GraphQL (Pothos)
 * surfaces — Fastify hooks provide the same fields on every request.
 */
export interface ServiceContext {
  /** RLS-scoped Drizzle transaction from the dbContext hook. */
  tx: DrizzleDb;
  /** Authenticated actor identity from the auth + orgContext hooks. */
  actor: { userId: string; orgId: string; role: Role };
  /** Request-scoped audit function from the audit hook. */
  audit: AuditFn;
}
