import { initTRPC, TRPCError } from '@trpc/server';
import type { ApiKeyScope } from '@colophony/types';
import { AuditActions, AuditResources } from '@colophony/types';
import type { TRPCContext } from './context.js';
import {
  checkApiKeyScopes,
  markGuard,
  readGuardTags,
  GUARD_TAG,
  type GuardTag,
} from '../services/scope-check.js';
import { validateEnv } from '../config/env.js';

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

/** Requires BUSINESS_OPS or ADMIN role. */
const isBusinessOps = t.middleware(({ ctx, next }) => {
  if (!ctx.authContext) {
    throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Not authenticated' });
  }
  if (!ctx.authContext.orgId || !ctx.authContext.roles?.length) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: 'X-Organization-Id header is required',
    });
  }
  if (!hasRole(ctx.authContext.roles, 'BUSINESS_OPS', 'ADMIN')) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'Business Operations or Admin role required',
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

// ---------------------------------------------------------------------------
// Guard tagging
// ---------------------------------------------------------------------------

/**
 * The guard tag itself is shared with the REST surface — see
 * `services/scope-check.ts`. Both gates read the same symbol, so a guard added on
 * either surface is visible to its own coverage test without further wiring.
 */
export { GUARD_TAG, readGuardTags, type GuardTag };

/**
 * Tags the underlying function of a middleware builder, returning the builder
 * unchanged. Takes the builder rather than the raw function so the middleware
 * body keeps tRPC's parameter inference — oRPC needs no such wrapper, because
 * `restBase.middleware(...)` hands back the function directly.
 */
function tagGuard<TBuilder extends { _middlewares: readonly unknown[] }>(
  middleware: TBuilder,
  tag: GuardTag,
): TBuilder {
  const fn = middleware._middlewares[0];
  /* c8 ignore next 3 -- defensive: tRPC always populates _middlewares[0] */
  if (typeof fn !== 'function') {
    throw new Error('Cannot tag guard: middleware builder has no function');
  }
  markGuard(fn, tag);
  return middleware;
}

/**
 * Factory: returns tRPC middleware that enforces API key scopes.
 * OIDC/test auth bypasses the check (scopes are API-key-only).
 * Must be chained after isAuthed or hasOrgContext.
 */
export function requireScopes(...scopes: ApiKeyScope[]) {
  const middleware = t.middleware(async ({ ctx, next }) => {
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

  return tagGuard(middleware, { kind: 'scopes', scopes });
}

/**
 * Auth methods that represent an interactive human session.
 *
 * This is an ALLOWLIST, and the distinction is not stylistic. A denylist of
 * 'apikey' stays correct only until the next credential class exists — the
 * `col_svc_` service principal would carry a different authMethod and silently
 * readmit itself to `federation.updateConfig` and `hub.revokeInstance` with
 * broader tenancy than the credential the rule was written to exclude.
 * Written this way, every future auth method is excluded by construction and
 * has to be explicitly admitted here.
 *
 * See docs/api-integration-design.md §1.6 M1.
 */
const INTERACTIVE_AUTH_METHODS: readonly string[] = ['oidc', 'demo', 'test'];

/**
 * Restricts a procedure to interactive human sessions.
 *
 * Enforcing by default: a non-interactive caller is audited and rejected with
 * 403. TRPC_INTERNAL_ONLY_ENFORCE=false reverts to log-only, auditing the
 * crossing and letting it through — kept as a revert lever, not a normal
 * setting. An unauthenticated caller is rejected in both modes, unaudited.
 */
const internalOnlyMiddleware = t.middleware(async ({ ctx, path, next }) => {
  if (!ctx.authContext) {
    throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Not authenticated' });
  }

  if (INTERACTIVE_AUTH_METHODS.includes(ctx.authContext.authMethod)) {
    return next();
  }

  // validateEnv() is called here rather than at module level — a module-level
  // call breaks test imports.
  const enforced = validateEnv().TRPC_INTERNAL_ONLY_ENFORCE;

  await ctx.audit?.({
    action: AuditActions.API_KEY_INTERNAL_ROUTE,
    resource: AuditResources.API_KEY,
    resourceId: ctx.authContext.apiKeyId,
    newValue: {
      procedure: path,
      authMethod: ctx.authContext.authMethod,
      enforced,
    },
  });

  if (enforced) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'This procedure is not available to API keys',
    });
  }

  return next();
});

export const internalOnly = tagGuard(internalOnlyMiddleware, {
  kind: 'internal',
});

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
export const businessOpsProcedure = t.procedure.use(isBusinessOps);

// Internal-only variants. `internalOnly` runs FIRST so that a non-interactive
// credential is audited and rejected on the boundary rather than incidentally
// on its role — the audit trail should say why the call was actually refused.
export const internalAuthedProcedure = t.procedure
  .use(internalOnly)
  .use(isAuthed);
export const internalAdminProcedure = t.procedure
  .use(internalOnly)
  .use(isAdmin);

export const createRouter = t.router;
export const mergeRouters = t.mergeRouters;
