/**
 * Auth injection helper for Playwright E2E tests.
 *
 * Provides three layers of auth state injection:
 * 1. BrowserContext storageState — pre-populates localStorage BEFORE any page
 *    loads (zero race condition with page JS)
 * 2. addInitScript — re-sets localStorage on every subsequent navigation as a
 *    safety net (handles client-side navigations that could clear storage)
 * 3. Route interception — swaps the fake OIDC Bearer token for the interactive
 *    test-auth header on all API requests
 *
 * Auth class: this drives the API's **interactive** test path
 * (`x-test-user-id`, apps/api/src/hooks/auth.ts), which yields
 * `authMethod: 'test'`. That is the same class the real web app uses, so E2E
 * exercises the guards real users hit: role checks apply, `requireScopes` is a
 * no-op, and `internalOnly` routers admit the request.
 *
 * The path is gated on NODE_ENV=test AND no JWKS verifier; playwright.config.ts
 * sets both on the API webServer. Roles still come from `organization_members`,
 * so a suite expresses privilege via its seed user's membership, not scopes.
 */

import type { Browser, Page } from "@playwright/test";
import { devices } from "@playwright/test";

export const OIDC_AUTHORITY = "http://test-idp:8080";
export const OIDC_CLIENT_ID = "test-client";
export const OIDC_STORAGE_KEY = `oidc.user:${OIDC_AUTHORITY}:${OIDC_CLIENT_ID}`;

export interface UserProfile {
  sub: string;
  email: string;
  name: string;
}

/**
 * The three seed identities from packages/db/src/seed.ts, hoisted here so the
 * suites share one definition. Roles come from `organization_members`:
 * admin=ADMIN, editor=EDITOR, writer=READER (in quarterly-review).
 */
export const ADMIN_USER_PROFILE: UserProfile = {
  sub: "seed-zitadel-admin-001",
  email: "editor@quarterlyreview.org",
  name: "Test Admin",
};

export const EDITOR_USER_PROFILE: UserProfile = {
  sub: "seed-zitadel-editor-001",
  email: "reader@quarterlyreview.org",
  name: "Test Editor",
};

export const WRITER_USER_PROFILE: UserProfile = {
  sub: "seed-zitadel-writer-001",
  email: "writer@example.com",
  name: "Test Writer",
};

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
 * - page.route intercepts API calls to swap Bearer for the test-auth header
 *
 * `userId` is the local users.id UUID, not the Zitadel sub. The auth hook does
 * no lookup and no validation on it — a wrong value surfaces later as
 * `403 not_a_member` from org-context, or as silently empty RLS results.
 */
export async function setupPageAuth(
  page: Page,
  orgId: string,
  userId: string,
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

  // Intercept ALL API requests (tRPC + SSE + REST): remove the fake Bearer
  // token and add the test-auth header. Must cover all API endpoints, not just
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

      // Remove the fake OIDC Bearer token. Still required: the auth hook checks
      // Bearer before the test headers, so leaving it would 401 and poison the
      // per-IP throttle.
      delete headers["authorization"];

      headers["x-test-user-id"] = userId;
      headers["x-test-email"] = userProfile.email;
      headers["x-test-zitadel-id"] = userProfile.sub;

      await route.continue({ headers });
    },
  );
}

/**
 * Create a browser context + page authenticated as `userId` in `orgId`.
 *
 * Collapses the ~20-line body that was duplicated verbatim across every
 * `authedPage` fixture. Callers own teardown: `await context.close()`.
 */
export async function createAuthedContext(
  browser: Browser,
  baseURL: string | undefined,
  orgId: string,
  userId: string,
  userProfile: UserProfile,
): Promise<{
  context: Awaited<ReturnType<Browser["newContext"]>>;
  page: Page;
}> {
  const context = await browser.newContext({
    ...devices["Desktop Chrome"],
    baseURL,
    storageState: buildStorageState(orgId, userProfile),
  });

  const page = await context.newPage();
  await setupPageAuth(page, orgId, userId, userProfile);

  return { context, page };
}
