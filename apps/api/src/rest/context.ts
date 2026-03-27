import { os, ORPCError } from '@orpc/server';
import type { AuthContext, Role, ApiKeyScope } from '@colophony/types';
import { AuditActions, AuditResources } from '@colophony/types';
import type { DrizzleDb } from '@colophony/db';
import type { AuditFn } from '../services/types.js';
import { checkApiKeyScopes } from '../services/scope-check.js';

/**
 * Initial oRPC context populated by Fastify hooks.
 * Mirrors the tRPC context but typed for oRPC middleware.
 */
export interface RestContext {
  authContext: AuthContext | null;
  dbTx: DrizzleDb | null;
  audit: AuditFn;
}

/** Context after requireAuth middleware narrows authContext to non-null. */
export interface AuthedContext extends RestContext {
  authContext: AuthContext;
}

/** Context after requireUserContext middleware narrows authContext + dbTx (no org). */
export interface UserContext extends RestContext {
  authContext: AuthContext;
  dbTx: DrizzleDb;
}

/** Context after requireOrgContext middleware narrows orgId, roles, and dbTx. */
export interface OrgContext extends RestContext {
  authContext: AuthContext & { orgId: string; roles: Role[] };
  dbTx: DrizzleDb;
}

/**
 * Base oRPC procedure builder with RestContext.
 * All REST route handlers start from this base.
 */
export const restBase = os.$context<RestContext>();

// ---------------------------------------------------------------------------
// Middleware
// ---------------------------------------------------------------------------

/** Requires an authenticated user (authContext populated by auth hook). */
export const requireAuth = restBase.middleware(async ({ context, next }) => {
  if (!context.authContext) {
    throw new ORPCError('UNAUTHORIZED', {
      message: 'Not authenticated',
    });
  }
  return next({
    context: { authContext: context.authContext },
  });
});

/** Requires auth + DB transaction (user context). No org required. */
export const requireUserContext = restBase.middleware(
  async ({ context, next }) => {
    if (!context.authContext) {
      throw new ORPCError('UNAUTHORIZED', {
        message: 'Not authenticated',
      });
    }
    if (!context.dbTx) {
      throw new ORPCError('INTERNAL_SERVER_ERROR', {
        message: 'Database transaction not available',
      });
    }
    return next({
      context: { authContext: context.authContext, dbTx: context.dbTx },
    });
  },
);

/** Requires org context (X-Organization-Id resolved by org-context hook). */
export const requireOrgContext = restBase.middleware(
  async ({ context, next }) => {
    if (!context.authContext) {
      throw new ORPCError('UNAUTHORIZED', {
        message: 'Not authenticated',
      });
    }
    if (!context.authContext.orgId || !context.authContext.roles?.length) {
      throw new ORPCError('BAD_REQUEST', {
        message: 'X-Organization-Id header is required',
      });
    }
    if (!context.dbTx) {
      throw new ORPCError('INTERNAL_SERVER_ERROR', {
        message: 'Database transaction not available',
      });
    }
    return next({
      context: {
        authContext: context.authContext as AuthContext & {
          orgId: string;
          roles: Role[];
        },
        dbTx: context.dbTx,
      },
    });
  },
);

/** Helper: check if roles array includes any of the required roles. */
function hasRole(roles: readonly string[], ...required: string[]): boolean {
  return required.some((r) => roles.includes(r));
}

/** Requires ADMIN role within the current org context. */
export const requireAdmin = restBase.middleware(async ({ context, next }) => {
  if (!context.authContext) {
    throw new ORPCError('UNAUTHORIZED', {
      message: 'Not authenticated',
    });
  }
  if (!context.authContext.orgId || !context.authContext.roles?.length) {
    throw new ORPCError('BAD_REQUEST', {
      message: 'X-Organization-Id header is required',
    });
  }
  if (!hasRole(context.authContext.roles, 'ADMIN')) {
    throw new ORPCError('FORBIDDEN', {
      message: 'Admin role required',
    });
  }
  if (!context.dbTx) {
    throw new ORPCError('INTERNAL_SERVER_ERROR', {
      message: 'Database transaction not available',
    });
  }
  return next({
    context: {
      authContext: context.authContext as AuthContext & {
        orgId: string;
        roles: Role[];
      },
      dbTx: context.dbTx,
    },
  });
});

/** Requires EDITOR or ADMIN role. */
export const requireEditor = restBase.middleware(async ({ context, next }) => {
  if (!context.authContext) {
    throw new ORPCError('UNAUTHORIZED', {
      message: 'Not authenticated',
    });
  }
  if (!context.authContext.orgId || !context.authContext.roles?.length) {
    throw new ORPCError('BAD_REQUEST', {
      message: 'X-Organization-Id header is required',
    });
  }
  if (!hasRole(context.authContext.roles, 'EDITOR', 'ADMIN')) {
    throw new ORPCError('FORBIDDEN', {
      message: 'Editor or Admin role required',
    });
  }
  if (!context.dbTx) {
    throw new ORPCError('INTERNAL_SERVER_ERROR', {
      message: 'Database transaction not available',
    });
  }
  return next({
    context: {
      authContext: context.authContext as AuthContext & {
        orgId: string;
        roles: Role[];
      },
      dbTx: context.dbTx,
    },
  });
});

/** Requires PRODUCTION, EDITOR, or ADMIN role. */
export const requireProduction = restBase.middleware(
  async ({ context, next }) => {
    if (!context.authContext) {
      throw new ORPCError('UNAUTHORIZED', {
        message: 'Not authenticated',
      });
    }
    if (!context.authContext.orgId || !context.authContext.roles?.length) {
      throw new ORPCError('BAD_REQUEST', {
        message: 'X-Organization-Id header is required',
      });
    }
    if (!hasRole(context.authContext.roles, 'PRODUCTION', 'EDITOR', 'ADMIN')) {
      throw new ORPCError('FORBIDDEN', {
        message: 'Production, Editor, or Admin role required',
      });
    }
    if (!context.dbTx) {
      throw new ORPCError('INTERNAL_SERVER_ERROR', {
        message: 'Database transaction not available',
      });
    }
    return next({
      context: {
        authContext: context.authContext as AuthContext & {
          orgId: string;
          roles: Role[];
        },
        dbTx: context.dbTx,
      },
    });
  },
);

/**
 * Factory: returns oRPC middleware that enforces API key scopes.
 * OIDC/test auth bypasses the check (scopes are API-key-only).
 * Must be chained after requireAuth or requireOrgContext.
 */
export function requireScopes(...scopes: ApiKeyScope[]) {
  return restBase.middleware(async ({ context, next }) => {
    if (!context.authContext) {
      throw new ORPCError('UNAUTHORIZED', {
        message: 'Not authenticated',
      });
    }

    const result = checkApiKeyScopes(context.authContext, scopes);
    if (!result.allowed) {
      await context.audit({
        action: AuditActions.API_KEY_SCOPE_DENIED,
        resource: AuditResources.API_KEY,
        resourceId: context.authContext.apiKeyId,
        newValue: { required: scopes, missing: result.missing },
      });
      throw new ORPCError('FORBIDDEN', {
        message: 'Insufficient API key scope',
        data: {
          error: 'insufficient_scope',
          required: scopes,
          missing: result.missing,
        },
      });
    }

    return next({});
  });
}

// Procedure builders (analogous to tRPC procedure builders)
export const authedProcedure = restBase.use(requireAuth);
export const userProcedure = restBase.use(requireUserContext);
export const orgProcedure = restBase.use(requireOrgContext);
export const editorProcedure = restBase.use(requireEditor);
export const productionProcedure = restBase.use(requireProduction);
export const adminProcedure = restBase.use(requireAdmin);
