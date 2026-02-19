/**
 * E2E tests for OIDC login flow with real Zitadel instance.
 *
 * Prerequisites:
 * - Zitadel running via `docker compose --profile auth up -d`
 * - E2E provisioning via `pnpm --filter @colophony/web e2e:setup-oidc`
 * - OIDC_E2E=true environment variable
 */

import { test, expect, loginViaZitadel } from "../helpers/oidc-fixtures";

test.describe("OIDC Login Flow", () => {
  test("unauthenticated access redirects to Zitadel", async ({
    unauthPage,
    oidcConfig,
  }) => {
    await unauthPage.goto("/submissions");

    // Should redirect to Zitadel login page
    await unauthPage.waitForURL(/localhost:8080/, { timeout: 15_000 });
    expect(unauthPage.url()).toContain(
      oidcConfig.authority.replace("http://", ""),
    );
  });

  test("completes login and reaches dashboard", async ({
    unauthPage,
    oidcConfig,
  }) => {
    await unauthPage.goto("/submissions");

    // Wait for Zitadel redirect
    await unauthPage.waitForURL(/localhost:8080/, { timeout: 15_000 });

    // Complete login
    await loginViaZitadel(
      unauthPage,
      oidcConfig.testUserEmail,
      oidcConfig.testUserPassword,
      oidcConfig.testOrgId,
    );

    // Reload so ProtectedRoute picks up the org context from localStorage
    await unauthPage.reload();

    // Should be redirected back to the app
    await expect(unauthPage).toHaveURL(/\/submissions|\//, {
      timeout: 15_000,
    });

    // Authenticated UI should be visible
    await expect(
      unauthPage.getByRole("heading", { name: "My Submissions" }),
    ).toBeVisible({ timeout: 10_000 });
  });

  test("preserves return path after login", async ({
    unauthPage,
    oidcConfig,
  }) => {
    // Navigate to a specific protected route
    await unauthPage.goto("/submissions/new");

    // Wait for Zitadel redirect
    await unauthPage.waitForURL(/localhost:8080/, { timeout: 15_000 });

    // Complete login
    await loginViaZitadel(
      unauthPage,
      oidcConfig.testUserEmail,
      oidcConfig.testUserPassword,
      oidcConfig.testOrgId,
    );

    // Should be redirected back to the original path
    await expect(unauthPage).toHaveURL(/\/submissions\/new/, {
      timeout: 15_000,
    });
  });

  test("logout clears session", async ({ unauthPage, oidcConfig }) => {
    // First, login
    await unauthPage.goto("/submissions");
    await unauthPage.waitForURL(/localhost:8080/, { timeout: 15_000 });
    await loginViaZitadel(
      unauthPage,
      oidcConfig.testUserEmail,
      oidcConfig.testUserPassword,
      oidcConfig.testOrgId,
    );

    // Reload so ProtectedRoute picks up the org context from localStorage
    await unauthPage.reload();

    // Wait for authenticated state
    await expect(unauthPage).toHaveURL(/\/submissions|\//, {
      timeout: 15_000,
    });

    // Open user menu dropdown via data-testid (avatar button has no accessible name)
    const userMenu = unauthPage.getByTestId("user-menu-trigger");
    await userMenu.waitFor({ state: "visible", timeout: 10_000 });
    await userMenu.click();

    // Click "Sign out" menu item — triggers OIDC end-session redirect
    await Promise.all([
      unauthPage.waitForURL(/localhost:8080|localhost:3010/, {
        timeout: 15_000,
      }),
      unauthPage.getByRole("menuitem", { name: /sign\s*out/i }).click(),
    ]);

    // Wait for post-logout redirect back to the app
    await unauthPage.waitForURL(/localhost:3010/, { timeout: 15_000 });

    // Verify the client-side OIDC session was cleared (no access token).
    // Note: Zitadel may preserve its own SSO session (browser cookie), so
    // navigating to a protected route could silently re-authenticate.
    // We verify logout by checking that OIDC client state is gone.
    const hasOidcUser = await unauthPage.evaluate(() => {
      // oidc-client-ts stores user data in sessionStorage under a key
      // starting with "oidc."
      for (let i = 0; i < sessionStorage.length; i++) {
        const key = sessionStorage.key(i);
        if (key?.startsWith("oidc.")) return true;
      }
      return false;
    });
    expect(hasOidcUser).toBe(false);
  });
});
