/**
 * Auth injection helper for Playwright E2E tests.
 *
 * Provides two layers of auth state injection:
 * 1. BrowserContext storageState — pre-populates localStorage BEFORE any page
 *    loads (zero race condition with page JS)
 * 2. addInitScript — re-sets localStorage on every subsequent navigation as a
 *    safety net (handles client-side navigations that could clear storage)
 * 3. Route interception — swaps the fake OIDC Bearer token for a real API key
 *    on all tRPC requests
 *
 * This uses the real API key auth path — no API code changes needed.
 */

import type { Page } from "@playwright/test";

export const OIDC_AUTHORITY = "http://test-idp:8080";
export const OIDC_CLIENT_ID = "test-client";
export const OIDC_STORAGE_KEY = `oidc.user:${OIDC_AUTHORITY}:${OIDC_CLIENT_ID}`;

interface UserProfile {
  sub: string;
  email: string;
  name: string;
}

/**
 * Build the OIDC user object for localStorage injection.
 */
export function buildOidcUser(userProfile: UserProfile) {
  return {
    access_token: "e2e-fake-token",
    token_type: "Bearer",
    expires_at: Math.floor(Date.now() / 1000) + 3600, // 1 hour ahead
    scope: "openid profile email offline_access",
    profile: {
      sub: userProfile.sub,
      email: userProfile.email,
      name: userProfile.name,
      email_verified: true,
    },
  };
}

/**
 * Build Playwright storageState for BrowserContext creation.
 *
 * Pre-populates localStorage with OIDC user + currentOrgId so that auth
 * state is available before any page JavaScript executes.
 */
export function buildStorageState(orgId: string, userProfile: UserProfile) {
  const oidcUser = buildOidcUser(userProfile);

  return {
    cookies: [],
    origins: [
      {
        origin: "http://localhost:3010",
        localStorage: [
          { name: OIDC_STORAGE_KEY, value: JSON.stringify(oidcUser) },
          { name: "currentOrgId", value: orgId },
        ],
      },
    ],
  };
}

/**
 * Set up route interception and addInitScript on a page.
 *
 * Must be called after the page is created but before navigating to any URL.
 * - addInitScript re-sets localStorage on every page load (safety net)
 * - page.route intercepts tRPC calls to swap Bearer for API key
 */
export async function setupPageAuth(
  page: Page,
  orgId: string,
  apiKey: string,
  userProfile: UserProfile,
): Promise<void> {
  const oidcUserJson = JSON.stringify(buildOidcUser(userProfile));

  // Re-set localStorage on every page load as safety net
  await page.addInitScript(
    ({
      storageKey,
      orgId: oid,
      json,
    }: {
      storageKey: string;
      orgId: string;
      json: string;
    }) => {
      localStorage.setItem(storageKey, json);
      localStorage.setItem("currentOrgId", oid);
    },
    { storageKey: OIDC_STORAGE_KEY, orgId, json: oidcUserJson },
  );

  // Intercept ALL API requests (tRPC + SSE + REST): remove fake Bearer
  // token and add real API key. Must cover all API endpoints, not just
  // /trpc/**, because non-tRPC requests (e.g. /api/notifications/stream)
  // carry the fake OIDC Bearer token which triggers AUTH_TOKEN_INVALID — after
  // 10 failures the per-IP auth throttle blocks ALL requests from localhost.
  //
  // Use a predicate function since Playwright's URL glob matching is unreliable
  // with full URLs containing ports.
  await page.route(
    (url) => url.port === "4010",
    async (route) => {
      const request = route.request();
      const headers = { ...request.headers() };

      // Remove the fake OIDC Bearer token
      delete headers["authorization"];

      // Add the real API key
      headers["x-api-key"] = apiKey;

      await route.continue({ headers });
    },
  );
}
