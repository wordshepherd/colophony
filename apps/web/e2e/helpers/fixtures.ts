/**
 * Custom Playwright test fixtures for E2E tests.
 *
 * Provides an authenticated page context with seed data lookups.
 *
 * Auth strategy: create a BrowserContext with pre-populated localStorage
 * (storageState) so OIDC user + currentOrgId are available before any page
 * JS executes. This eliminates the race condition between addInitScript and
 * page JavaScript reading localStorage. Requests are then authenticated to the
 * API via the interactive test path (`x-test-user-id`) — see ./auth.
 */

import { test as base, expect, type Page } from "@playwright/test";
import { createAuthedContext, WRITER_USER_PROFILE } from "./auth";
import { getOrgBySlug, getUserByEmail } from "./db";

interface SeedOrg {
  id: string;
  name: string;
  slug: string;
}

interface SeedUser {
  id: string;
  email: string;
}

/**
 * Extended Playwright test with auth fixtures.
 *
 * Fixtures:
 * - `seedOrg` — the "quarterly-review" seed org
 * - `seedUser` — the "writer@example.com" seed user (READER in that org)
 * - `authedPage` — a Page authenticated as that user
 */
export const test = base.extend<{
  seedOrg: SeedOrg;
  seedUser: SeedUser;
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

  authedPage: async ({ browser, seedOrg, seedUser, baseURL }, use) => {
    const { context, page } = await createAuthedContext(
      browser,
      baseURL ?? undefined,
      seedOrg.id,
      seedUser.id,
      WRITER_USER_PROFILE,
    );

    await use(page);

    await context.close();
  },
});

export { expect };
