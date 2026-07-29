import type { AuthContext, ApiKeyScope } from '@colophony/types';

export type ScopeCheckResult =
  { allowed: true } | { allowed: false; missing: ApiKeyScope[] };

/**
 * Check whether the current auth context satisfies the required API key scopes.
 *
 * - OIDC and test auth bypass scope checks entirely (scopes are API-key-only).
 * - For API key auth, all required scopes must be present in apiKeyScopes.
 */
export function checkApiKeyScopes(
  authContext: AuthContext,
  requiredScopes: ApiKeyScope[],
): ScopeCheckResult {
  // Scopes only apply to API key authentication
  if (authContext.authMethod !== 'apikey') {
    return { allowed: true };
  }

  const granted = new Set(authContext.apiKeyScopes ?? []);
  const missing = requiredScopes.filter((s) => !granted.has(s));

  if (missing.length === 0) {
    return { allowed: true };
  }

  return { allowed: false, missing };
}

// ---------------------------------------------------------------------------
// Guard tagging
// ---------------------------------------------------------------------------

/**
 * Marks a middleware as one of the guards that keep a procedure out of an API
 * key's reach. Read by the guard-coverage gates on both surfaces
 * (`trpc/guard-coverage.spec.ts`, `rest/guard-coverage.spec.ts`), which fail the
 * build on a procedure declaring none.
 *
 * Tagging is necessary because no guard is identifiable by reference:
 * `requireScopes` mints a fresh closure per call, and the middleware bodies are
 * anonymous. Both tRPC and oRPC keep the function object itself in their built
 * procedure's middleware array, so a non-enumerable property on it survives
 * builder composition intact.
 *
 * This lives here, beside `checkApiKeyScopes`, because the two surfaces must
 * agree on it. A per-surface copy is how the REST and tRPC scope declarations
 * drifted apart in the first place.
 */
export const GUARD_TAG = Symbol.for('colophony.guard');

export type GuardTag =
  { kind: 'scopes'; scopes: readonly ApiKeyScope[] } | { kind: 'internal' };

/**
 * Tags a middleware function in place and returns it, so it can wrap a builder
 * expression directly. Surface-specific wrappers handle unwrapping where the
 * framework hands back a builder rather than the function (see tRPC's
 * `tagGuard`).
 */
export function markGuard<T>(fn: T, tag: GuardTag): T {
  Object.defineProperty(fn, GUARD_TAG, { value: tag, enumerable: false });
  return fn;
}

/** Reads the guard tags declared on a built procedure's middleware chain. */
export function readGuardTags(middlewares: readonly unknown[]): GuardTag[] {
  return middlewares
    .filter((mw): mw is object => typeof mw === 'function')
    .map((mw) => (mw as Record<symbol, GuardTag | undefined>)[GUARD_TAG])
    .filter((tag): tag is GuardTag => tag !== undefined);
}
