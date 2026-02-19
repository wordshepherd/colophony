/**
 * Custom Playwright test fixtures for E2E tests.
 *
 * Provides authenticated page context with seed data lookups and
 * API key management. Each test gets a fresh API key that is
 * cleaned up after the test.
 *
 * Auth strategy: create a BrowserContext with pre-populated localStorage
 * (storageState) so OIDC user + currentOrgId are available before any page
 * JS executes. This eliminates the race condition between addInitScript and
 * page JavaScript reading localStorage.
 */

import { test as base, expect, type Page, devices } from "@playwright/test";
import { buildStorageState, setupPageAuth } from "./auth";
import { getOrgBySlug, getUserByEmail, createApiKey, deleteApiKey } from "./db";

/** All scopes needed for submission flow E2E tests */
const E2E_SCOPES = [
  "submissions:read",
  "submissions:write",
  "files:read",
  "files:write",
  "users:read",
  "organizations:read",
];

interface SeedOrg {
  id: string;
  name: string;
  slug: string;
}

interface SeedUser {
  id: string;
  email: string;
}

interface TestApiKey {
  id: string;
  plainKey: string;
}

const TEST_USER_PROFILE = {
  sub: "seed-zitadel-writer-001",
  email: "writer@example.com",
  name: "Test Writer",
};

/**
 * Extended Playwright test with auth fixtures.
 *
 * Fixtures:
 * - `seedOrg` — the "quarterly-review" seed org
 * - `seedUser` — the "writer@example.com" seed user
 * - `testApiKey` — a fresh API key for the seed user (cleaned up after test)
 * - `authedPage` — a Page with auth injected (OIDC + API key interception)
 */
export const test = base.extend<{
  seedOrg: SeedOrg;
  seedUser: SeedUser;
  testApiKey: TestApiKey;
  authedPage: Page;
}>({
  seedOrg: async ({}, use) => {
    const org = await getOrgBySlug("quarterly-review");
    if (!org) {
      throw new Error(
        'Seed org "quarterly-review" not found. Run `pnpm db:seed` first.',
      );
    }
    await use(org);
  },

  seedUser: async ({}, use) => {
    const user = await getUserByEmail("writer@example.com");
    if (!user) {
      throw new Error(
        'Seed user "writer@example.com" not found. Run `pnpm db:seed` first.',
      );
    }
    await use(user);
  },

  testApiKey: async ({ seedOrg, seedUser }, use) => {
    const key = await createApiKey({
      orgId: seedOrg.id,
      userId: seedUser.id,
      scopes: E2E_SCOPES,
      name: `e2e-test-${Date.now()}`,
    });

    await use(key);

    // Cleanup
    await deleteApiKey(key.id);
  },

  authedPage: async ({ browser, seedOrg, testApiKey, baseURL }, use) => {
    // Create a fresh context with pre-populated localStorage.
    // This ensures OIDC user + currentOrgId exist BEFORE any page JS runs,
    // eliminating the race condition between addInitScript and JS execution.
    const context = await browser.newContext({
      ...devices["Desktop Chrome"],
      baseURL: baseURL ?? undefined,
      storageState: buildStorageState(seedOrg.id, TEST_USER_PROFILE),
    });

    const page = await context.newPage();

    // Set up route interception + addInitScript safety net
    await setupPageAuth(
      page,
      seedOrg.id,
      testApiKey.plainKey,
      TEST_USER_PROFILE,
    );

    await use(page);

    await context.close();
  },
});

export { expect };
