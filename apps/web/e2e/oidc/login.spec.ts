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
    );

    // Should be redirected back to the app
    await expect(unauthPage).toHaveURL(/\/submissions|\//, {
      timeout: 15_000,
    });

    // Authenticated UI should be visible (e.g., heading or user menu)
    await expect(
      unauthPage.getByRole("heading", { name: /submissions/i }),
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
    );

    // Wait for authenticated state
    await expect(unauthPage).toHaveURL(/\/submissions|\//, {
      timeout: 15_000,
    });

    // Click logout (look for common logout patterns)
    const logoutButton = unauthPage.getByRole("button", {
      name: /log\s*out|sign\s*out/i,
    });
    if (await logoutButton.isVisible()) {
      await logoutButton.click();
    } else {
      // Try user menu dropdown first
      const userMenu = unauthPage.getByRole("button", {
        name: /user|account|profile/i,
      });
      if (await userMenu.isVisible()) {
        await userMenu.click();
        await unauthPage
          .getByRole("menuitem", { name: /log\s*out|sign\s*out/i })
          .click();
      }
    }

    // Navigate to a protected route — should redirect to login again
    await unauthPage.goto("/submissions");
    await unauthPage.waitForURL(/localhost:8080/, { timeout: 15_000 });
  });
});
