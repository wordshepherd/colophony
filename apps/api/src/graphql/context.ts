import type { FastifyRequest } from 'fastify';
import type { AuthContext } from '@colophony/types';
import type { DrizzleDb } from '@colophony/db';
import type { AuditFn } from '../services/types.js';
import type { Loaders } from './loaders.js';
import { createLoaders } from './loaders.js';

/**
 * GraphQL context — mirrors RestContext/TRPCContext.
 * Populated from Fastify request decorations set by the hook chain.
 */
export interface GraphQLContext {
  authContext: AuthContext | null;
  dbTx: DrizzleDb | null;
  audit: AuditFn;
  loaders: Loaders;
}

/**
 * Build a GraphQL context from a Fastify request.
 * Called per-request by graphql-yoga.
 */
export function buildGraphQLContext(req: FastifyRequest): GraphQLContext {
  return {
    authContext: req.authContext,
    dbTx: req.dbTx,
    audit: req.audit,
    loaders: createLoaders(req.dbTx),
  };
}
