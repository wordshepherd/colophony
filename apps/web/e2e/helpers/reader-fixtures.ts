/**
 * Reader-specific Playwright test fixtures.
 *
 * Uses the WRITER user (writer@example.com) who has READER role in
 * the quarterly-review org. Tests verify that READER-role users see
 * restricted UI (no editor/admin navigation, read-only settings).
 */

import { test as base, expect, type Page, devices } from "@playwright/test";
import { buildStorageState, setupPageAuth } from "./auth";
import { getOrgBySlug, getUserByEmail, createApiKey, deleteApiKey } from "./db";

/** Writer user profile (READER role in quarterly-review org) */
const READER_USER_PROFILE = {
  sub: "seed-zitadel-writer-001",
  email: "writer@example.com",
  name: "Test Reader",
};

/** Read-only scopes for READER E2E tests */
const READER_E2E_SCOPES = [
  "organizations:read",
  "submissions:read",
  "users:read",
  "periods:read",
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

export const test = base.extend<{
  seedOrg: SeedOrg;
  seedReader: SeedUser;
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

  seedReader: async ({}, use) => {
    const user = await getUserByEmail("writer@example.com");
    if (!user) {
      throw new Error(
        'Seed writer "writer@example.com" not found. Run `pnpm db:seed` first.',
      );
    }
    await use(user);
  },

  testApiKey: async ({ seedOrg, seedReader }, use) => {
    const key = await createApiKey({
      orgId: seedOrg.id,
      userId: seedReader.id,
      scopes: READER_E2E_SCOPES,
      name: `e2e-reader-${Date.now()}`,
    });

    await use(key);

    await deleteApiKey(key.id);
  },

  authedPage: async ({ browser, seedOrg, testApiKey, baseURL }, use) => {
    const context = await browser.newContext({
      ...devices["Desktop Chrome"],
      baseURL: baseURL ?? undefined,
      storageState: buildStorageState(seedOrg.id, READER_USER_PROFILE),
    });

    const page = await context.newPage();

    await setupPageAuth(
      page,
      seedOrg.id,
      testApiKey.plainKey,
      READER_USER_PROFILE,
    );

    await use(page);

    await context.close();
  },
});

export { expect };
