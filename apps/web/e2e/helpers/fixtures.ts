/**
 * Custom Playwright test fixtures for E2E tests.
 *
 * Provides authenticated page context with seed data lookups and
 * API key management. Each test gets a fresh API key that is
 * cleaned up after the test.
 */

import { test as base, expect, type Page } from "@playwright/test";
import { injectAuth } from "./auth";
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

  authedPage: async ({ page, seedOrg, seedUser, testApiKey }, use) => {
    await injectAuth({
      page,
      orgId: seedOrg.id,
      apiKey: testApiKey.plainKey,
      userProfile: {
        sub: `seed-zitadel-writer-001`,
        email: seedUser.email,
        name: "Test Writer",
      },
    });

    await use(page);
  },
});

export { expect };
