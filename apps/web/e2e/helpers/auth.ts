/**
 * Auth injection helper for Playwright E2E tests.
 *
 * Injects a fake OIDC user into localStorage (satisfies frontend ProtectedRoute
 * and useAuth checks) and intercepts tRPC requests to swap the fake Bearer token
 * for a real API key header (satisfies API auth).
 *
 * This uses the real API key auth path — no API code changes needed.
 */

import type { Page } from "@playwright/test";

const OIDC_AUTHORITY = "http://test-idp:8080";
const OIDC_CLIENT_ID = "test-client";
const OIDC_STORAGE_KEY = `oidc.user:${OIDC_AUTHORITY}:${OIDC_CLIENT_ID}`;

interface InjectAuthOptions {
  page: Page;
  orgId: string;
  apiKey: string;
  userProfile: {
    sub: string;
    email: string;
    name: string;
  };
}

/**
 * Inject fake OIDC auth state and API key route interception.
 *
 * Must be called BEFORE navigating to any page. Sets up:
 * 1. localStorage entries for OIDC user + currentOrgId (via addInitScript)
 * 2. Route interception to swap Authorization header for X-Api-Key on tRPC calls
 */
export async function injectAuth({
  page,
  orgId,
  apiKey,
  userProfile,
}: InjectAuthOptions): Promise<void> {
  // 1. Inject OIDC user + org context into localStorage before any page JS runs
  await page.addInitScript(
    ({ storageKey, orgId, userProfile }) => {
      const expiresAt = Math.floor(Date.now() / 1000) + 3600; // 1 hour ahead

      const oidcUser = {
        access_token: "e2e-fake-token",
        token_type: "Bearer",
        expires_at: expiresAt,
        scope: "openid profile email offline_access",
        profile: {
          sub: userProfile.sub,
          email: userProfile.email,
          name: userProfile.name,
          email_verified: true,
        },
      };

      localStorage.setItem(storageKey, JSON.stringify(oidcUser));
      localStorage.setItem("currentOrgId", orgId);
    },
    { storageKey: OIDC_STORAGE_KEY, orgId, userProfile },
  );

  // 2. Intercept tRPC requests: remove fake Bearer token, add real API key
  await page.route("**/trpc/**", async (route) => {
    const request = route.request();
    const headers = { ...request.headers() };

    // Remove the fake OIDC Bearer token
    delete headers["authorization"];

    // Add the real API key
    headers["x-api-key"] = apiKey;

    await route.continue({ headers });
  });
}
