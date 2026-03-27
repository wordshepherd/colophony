import { initTRPC, TRPCError } from '@trpc/server';
import type { ApiKeyScope } from '@colophony/types';
import { AuditActions, AuditResources } from '@colophony/types';
import type { TRPCContext } from './context.js';
import { checkApiKeyScopes } from '../services/scope-check.js';

export const t = initTRPC.context<TRPCContext>().create({
  errorFormatter({ shape, error }) {
    const cause = error.cause;
    return {
      ...shape,
      data: {
        ...shape.data,
        fieldErrors:
          cause &&
          typeof cause === 'object' &&
          'fieldErrors' in cause &&
          Array.isArray(cause.fieldErrors)
            ? cause.fieldErrors
            : undefined,
      },
    };
  },
});

// ---------------------------------------------------------------------------
// Middleware
// ---------------------------------------------------------------------------

/** Requires an authenticated user (authContext populated by auth hook). */
const isAuthed = t.middleware(({ ctx, next }) => {
  if (!ctx.authContext) {
    throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Not authenticated' });
  }
  return next({ ctx: { ...ctx, authContext: ctx.authContext } });
});

/** Type for auth context with org + roles narrowed to non-optional. */
type OrgAuthContext = Required<
  Pick<NonNullable<TRPCContext['authContext']>, 'orgId' | 'roles'>
> &
  NonNullable<TRPCContext['authContext']>;

/** Requires org context (X-Organization-Id resolved by org-context hook). */
const hasOrgContext = t.middleware(({ ctx, next }) => {
  if (!ctx.authContext) {
    throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Not authenticated' });
  }
  if (!ctx.authContext.orgId || !ctx.authContext.roles?.length) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: 'X-Organization-Id header is required',
    });
  }
  if (!ctx.dbTx) {
    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Database transaction not available',
    });
  }
  return next({
    ctx: {
      ...ctx,
      authContext: ctx.authContext as OrgAuthContext,
      dbTx: ctx.dbTx,
    },
  });
});

/** Helper: check if roles array includes any of the required roles. */
function hasRole(roles: readonly string[], ...required: string[]): boolean {
  return required.some((r) => roles.includes(r));
}

/** Requires ADMIN role within the current org context. */
const isAdmin = t.middleware(({ ctx, next }) => {
  if (!ctx.authContext) {
    throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Not authenticated' });
  }
  if (!ctx.authContext.orgId || !ctx.authContext.roles?.length) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: 'X-Organization-Id header is required',
    });
  }
  if (!hasRole(ctx.authContext.roles, 'ADMIN')) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'Admin role required',
    });
  }
  if (!ctx.dbTx) {
    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Database transaction not available',
    });
  }
  return next({
    ctx: {
      ...ctx,
      authContext: ctx.authContext as OrgAuthContext,
      dbTx: ctx.dbTx,
    },
  });
});

/** Requires EDITOR or ADMIN role. */
const isEditor = t.middleware(({ ctx, next }) => {
  if (!ctx.authContext) {
    throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Not authenticated' });
  }
  if (!ctx.authContext.orgId || !ctx.authContext.roles?.length) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: 'X-Organization-Id header is required',
    });
  }
  if (!hasRole(ctx.authContext.roles, 'EDITOR', 'ADMIN')) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'Editor or Admin role required',
    });
  }
  if (!ctx.dbTx) {
    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Database transaction not available',
    });
  }
  return next({
    ctx: {
      ...ctx,
      authContext: ctx.authContext as OrgAuthContext,
      dbTx: ctx.dbTx,
    },
  });
});

/** Requires PRODUCTION, EDITOR, or ADMIN role. */
const isProduction = t.middleware(({ ctx, next }) => {
  if (!ctx.authContext) {
    throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Not authenticated' });
  }
  if (!ctx.authContext.orgId || !ctx.authContext.roles?.length) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: 'X-Organization-Id header is required',
    });
  }
  if (!hasRole(ctx.authContext.roles, 'PRODUCTION', 'EDITOR', 'ADMIN')) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'Production, Editor, or Admin role required',
    });
  }
  if (!ctx.dbTx) {
    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Database transaction not available',
    });
  }
  return next({
    ctx: {
      ...ctx,
      authContext: ctx.authContext as OrgAuthContext,
      dbTx: ctx.dbTx,
    },
  });
});

/**
 * Factory: returns tRPC middleware that enforces API key scopes.
 * OIDC/test auth bypasses the check (scopes are API-key-only).
 * Must be chained after isAuthed or hasOrgContext.
 */
export function requireScopes(...scopes: ApiKeyScope[]) {
  return t.middleware(async ({ ctx, next }) => {
    if (!ctx.authContext) {
      throw new TRPCError({
        code: 'UNAUTHORIZED',
        message: 'Not authenticated',
      });
    }

    const result = checkApiKeyScopes(ctx.authContext, scopes);
    if (!result.allowed) {
      await ctx.audit?.({
        action: AuditActions.API_KEY_SCOPE_DENIED,
        resource: AuditResources.API_KEY,
        resourceId: ctx.authContext.apiKeyId,
        newValue: { required: scopes, missing: result.missing },
      });
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: `Insufficient API key scope. Required: ${scopes.join(', ')}. Missing: ${result.missing.join(', ')}`,
      });
    }

    return next();
  });
}

// ---------------------------------------------------------------------------
// Procedure builders
// ---------------------------------------------------------------------------

/** Requires auth + DB transaction (user context). No org required. */
const hasUserContext = t.middleware(({ ctx, next }) => {
  if (!ctx.authContext) {
    throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Not authenticated' });
  }
  if (!ctx.dbTx) {
    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Database transaction not available',
    });
  }
  return next({
    ctx: { ...ctx, authContext: ctx.authContext, dbTx: ctx.dbTx },
  });
});

export const publicProcedure = t.procedure;
export const authedProcedure = t.procedure.use(isAuthed);
export const userProcedure = t.procedure.use(hasUserContext);
export const orgProcedure = t.procedure.use(hasOrgContext);
export const editorProcedure = t.procedure.use(isEditor);
export const productionProcedure = t.procedure.use(isProduction);
export const adminProcedure = t.procedure.use(isAdmin);
export const createRouter = t.router;
export const mergeRouters = t.mergeRouters;
