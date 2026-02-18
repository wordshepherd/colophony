import type { AuthContext, ApiKeyScope } from '@colophony/types';

export type ScopeCheckResult =
  | { allowed: true }
  | { allowed: false; missing: ApiKeyScope[] };

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

  return { allowed: false, missing: missing as ApiKeyScope[] };
}
