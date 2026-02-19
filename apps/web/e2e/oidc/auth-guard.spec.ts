/**
 * E2E tests for auth guard behavior with real Zitadel instance.
 *
 * Prerequisites:
 * - Zitadel running via `docker compose --profile auth up -d`
 * - E2E provisioning via `pnpm --filter @colophony/web e2e:setup-oidc`
 * - OIDC_E2E=true environment variable
 */

import { test, expect } from "../helpers/oidc-fixtures";

test.describe("Auth Guard", () => {
  test("protected routes redirect to login", async ({
    unauthPage,
    oidcConfig,
  }) => {
    // Test multiple protected routes
    const protectedRoutes = ["/submissions", "/submissions/new"];

    for (const route of protectedRoutes) {
      await unauthPage.goto(route);
      await unauthPage.waitForURL(/localhost:8080/, { timeout: 15_000 });
      expect(unauthPage.url()).toContain(
        oidcConfig.authority.replace("http://", ""),
      );

      // Navigate back to a neutral page before testing the next route
      await unauthPage.goto("about:blank");
    }
  });

  test("callback error shows retry UI", async ({ unauthPage }) => {
    // Navigate directly to callback without OIDC params — should show error
    await unauthPage.goto("/auth/callback");

    // Should show "Authentication Error" heading
    await expect(
      unauthPage.getByRole("heading", { name: "Authentication Error" }),
    ).toBeVisible({ timeout: 10_000 });

    // Should show "Try again" link
    await expect(unauthPage.getByText("Try again")).toBeVisible();
  });
});
