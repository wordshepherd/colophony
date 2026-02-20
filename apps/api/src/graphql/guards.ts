import { GraphQLError } from 'graphql';
import type { AuthContext, ApiKeyScope, Role } from '@colophony/types';
import { AuditActions, AuditResources } from '@colophony/types';
import type { DrizzleDb } from '@colophony/db';
import { checkApiKeyScopes } from '../services/scope-check.js';
import type { GraphQLContext } from './context.js';

// ---------------------------------------------------------------------------
// Narrowed context types (mirrors REST context.ts pattern)
// ---------------------------------------------------------------------------

export interface AuthedGraphQLContext extends GraphQLContext {
  authContext: AuthContext;
}

export interface OrgGraphQLContext extends GraphQLContext {
  authContext: AuthContext & { orgId: string; role: Role };
  dbTx: DrizzleDb;
}

// ---------------------------------------------------------------------------
// Guard functions — throw GraphQLError on failure
// ---------------------------------------------------------------------------

/**
 * Require an authenticated user. Returns narrowed context.
 */
export function requireAuth(ctx: GraphQLContext): AuthedGraphQLContext {
  if (!ctx.authContext) {
    throw new GraphQLError('Not authenticated', {
      extensions: { code: 'UNAUTHENTICATED' },
    });
  }
  return ctx as AuthedGraphQLContext;
}

/**
 * Require org context (X-Organization-Id resolved by org-context hook).
 * Returns narrowed context with non-null dbTx.
 */
export function requireOrgContext(ctx: GraphQLContext): OrgGraphQLContext {
  if (!ctx.authContext) {
    throw new GraphQLError('Not authenticated', {
      extensions: { code: 'UNAUTHENTICATED' },
    });
  }
  if (!ctx.authContext.orgId || !ctx.authContext.role) {
    throw new GraphQLError('X-Organization-Id header is required', {
      extensions: { code: 'BAD_REQUEST' },
    });
  }
  if (!ctx.dbTx) {
    throw new GraphQLError('Database transaction not available', {
      extensions: { code: 'INTERNAL_SERVER_ERROR' },
    });
  }
  return ctx as OrgGraphQLContext;
}

/**
 * Require ADMIN role within the current org context.
 * Returns narrowed OrgGraphQLContext.
 */
export function requireAdmin(ctx: GraphQLContext): OrgGraphQLContext {
  const orgCtx = requireOrgContext(ctx);
  if (orgCtx.authContext.role !== 'ADMIN') {
    throw new GraphQLError('Admin role required', {
      extensions: { code: 'FORBIDDEN' },
    });
  }
  return orgCtx;
}

/**
 * Enforce API key scopes. OIDC/test auth bypass scope checks.
 * Must be called after requireAuth or requireOrgContext.
 */
export async function requireScopes(
  ctx: GraphQLContext,
  ...scopes: ApiKeyScope[]
): Promise<void> {
  if (!ctx.authContext) {
    throw new GraphQLError('Not authenticated', {
      extensions: { code: 'UNAUTHENTICATED' },
    });
  }

  const result = checkApiKeyScopes(ctx.authContext, scopes);
  if (!result.allowed) {
    await ctx.audit({
      action: AuditActions.API_KEY_SCOPE_DENIED,
      resource: AuditResources.API_KEY,
      resourceId: ctx.authContext.apiKeyId,
      newValue: { required: scopes, missing: result.missing },
    });
    throw new GraphQLError('Insufficient API key scope', {
      extensions: {
        code: 'FORBIDDEN',
        error: 'insufficient_scope',
        required: scopes,
        missing: result.missing,
      },
    });
  }
}
