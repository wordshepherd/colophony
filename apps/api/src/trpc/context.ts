import type { CreateFastifyContextOptions } from '@trpc/server/adapters/fastify';
import type { AuthContext, AuditLogParams } from '@colophony/types';
import type { DrizzleDb } from '@colophony/db';

type RequestAuditFn = (
  params: Omit<
    AuditLogParams,
    'actorId' | 'organizationId' | 'ipAddress' | 'userAgent'
  >,
) => Promise<void>;

declare module 'fastify' {
  interface FastifyRequest {
    authContext: AuthContext | null;
    dbTx: DrizzleDb | null;
    audit: RequestAuditFn;
  }
}

export interface TRPCContext {
  authContext: AuthContext | null;
  dbTx: DrizzleDb | null;
  audit: RequestAuditFn;
}

export function createContext({
  req,
}: CreateFastifyContextOptions): TRPCContext {
  return {
    authContext: req.authContext,
    dbTx: req.dbTx,
    audit: req.audit,
  };
}
