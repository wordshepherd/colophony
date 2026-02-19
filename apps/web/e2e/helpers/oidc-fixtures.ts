/**
 * OIDC test fixtures for Playwright E2E tests.
 *
 * These fixtures use a real Zitadel instance (no fake auth injection).
 * Tests authenticate by filling the actual Zitadel login form.
 *
 * Prerequisites:
 * - Zitadel running via `docker compose --profile auth up -d`
 * - E2E provisioning via `pnpm --filter @colophony/web e2e:setup-oidc`
 * - OIDC_E2E=true environment variable
 */

import { existsSync, readFileSync } from "fs";
import { resolve } from "path";
import { test as base, expect, type Page, devices } from "@playwright/test";

interface OidcConfig {
  authority: string;
  clientId: string;
  testUserEmail: string;
  testUserPassword: string;
  testUserId: string;
  testOrgId: string;
}

/**
 * Load Zitadel E2E config from the generated JSON file.
 */
function loadOidcConfig(): OidcConfig {
  const configPath = resolve(__dirname, "../.zitadel-e2e-config.json");
  if (!existsSync(configPath)) {
    throw new Error(
      "OIDC E2E config not found. Run `pnpm --filter @colophony/web e2e:setup-oidc` first.",
    );
  }
  return JSON.parse(readFileSync(configPath, "utf-8")) as OidcConfig;
}

/**
 * Fill the Zitadel login form and submit.
 *
 * Zitadel v4.x login UI uses a two-step form:
 * 1. Enter login name (email) → click Next
 * 2. Enter password → click Next
 */
export async function loginViaZitadel(
  page: Page,
  email: string,
  password: string,
): Promise<void> {
  // Step 1: Enter email
  const loginInput = page.locator(
    'input[name="loginName"], input[autocomplete="username"]',
  );
  await loginInput.waitFor({ state: "visible", timeout: 15_000 });
  await loginInput.fill(email);

  // Click Next (first step)
  await page.getByRole("button", { name: /next/i }).click();

  // Step 2: Enter password
  const passwordInput = page.locator(
    'input[name="password"], input[type="password"]',
  );
  await passwordInput.waitFor({ state: "visible", timeout: 10_000 });
  await passwordInput.fill(password);

  // Click Next (second step — submits login)
  await page.getByRole("button", { name: /next/i }).click();

  // Wait for redirect back to app
  await page.waitForURL(/localhost:3010/, { timeout: 15_000 });
}

/**
 * Extended Playwright test with OIDC fixtures.
 *
 * Fixtures:
 * - `oidcConfig` — loaded Zitadel E2E configuration
 * - `unauthPage` — clean Page with no auth state
 */
export const test = base.extend<{
  oidcConfig: OidcConfig;
  unauthPage: Page;
}>({
  oidcConfig: async ({}, use) => {
    await use(loadOidcConfig());
  },

  unauthPage: async ({ browser, baseURL }, use) => {
    const context = await browser.newContext({
      ...devices["Desktop Chrome"],
      baseURL: baseURL ?? undefined,
    });
    const page = await context.newPage();
    await use(page);
    await context.close();
  },
});

export { expect };
