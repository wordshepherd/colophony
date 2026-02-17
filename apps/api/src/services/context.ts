import type { DrizzleDb } from '@colophony/db';
import type { Role } from '@colophony/types';
import type { AuditFn, ServiceContext } from './types.js';

/**
 * Build a {@link ServiceContext} from the request-scoped values provided by
 * Fastify hooks. Works for any API surface (tRPC, REST, GraphQL) since the
 * hooks decorate the same fields on every Fastify request.
 *
 * For tRPC, pass the narrowed `orgProcedure` context directly.
 */
export function toServiceContext(ctx: {
  dbTx: DrizzleDb;
  authContext: { userId: string; orgId: string; role: Role };
  audit: AuditFn;
}): ServiceContext {
  return {
    tx: ctx.dbTx,
    actor: {
      userId: ctx.authContext.userId,
      orgId: ctx.authContext.orgId,
      role: ctx.authContext.role,
    },
    audit: ctx.audit,
  };
}
