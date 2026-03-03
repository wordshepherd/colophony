/**
 * Analytics-specific Playwright test fixtures.
 *
 * Uses the EDITOR user (reader@quarterlyreview.org) — analytics endpoints
 * require assertEditorOrAdmin. EDITOR is the minimum required role.
 *
 * Co-located in e2e/analytics/ (not e2e/helpers/) to avoid triggering
 * all Playwright suites via detect-changes.sh shared prefix matching.
 */

import { test as base, expect, type Page, devices } from "@playwright/test";
import { buildStorageState, setupPageAuth } from "../helpers/auth";
import {
  getOrgBySlug,
  getUserByEmail,
  createApiKey,
  deleteApiKey,
} from "../helpers/db";

/** Editor user profile (EDITOR role in quarterly-review org) */
const EDITOR_USER_PROFILE = {
  sub: "seed-zitadel-editor-001",
  email: "reader@quarterlyreview.org",
  name: "Test Editor",
};

/** All scopes needed for Analytics E2E tests */
const ANALYTICS_SCOPES = [
  "submissions:read",
  "organizations:read",
  "periods:read",
  "users:read",
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
  seedEditor: SeedUser;
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

  seedEditor: async ({}, use) => {
    const user = await getUserByEmail("reader@quarterlyreview.org");
    if (!user) {
      throw new Error(
        'Seed editor "reader@quarterlyreview.org" not found. Run `pnpm db:seed` first.',
      );
    }
    await use(user);
  },

  testApiKey: async ({ seedOrg, seedEditor }, use) => {
    const key = await createApiKey({
      orgId: seedOrg.id,
      userId: seedEditor.id,
      scopes: ANALYTICS_SCOPES,
      name: `e2e-analytics-${Date.now()}`,
    });

    await use(key);

    await deleteApiKey(key.id);
  },

  authedPage: async ({ browser, seedOrg, testApiKey, baseURL }, use) => {
    const context = await browser.newContext({
      ...devices["Desktop Chrome"],
      baseURL: baseURL ?? undefined,
      storageState: buildStorageState(seedOrg.id, EDITOR_USER_PROFILE),
    });

    const page = await context.newPage();

    await setupPageAuth(
      page,
      seedOrg.id,
      testApiKey.plainKey,
      EDITOR_USER_PROFILE,
    );

    await use(page);

    await context.close();
  },
});

export { expect };
