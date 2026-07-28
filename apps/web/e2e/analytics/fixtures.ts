/**
 * Analytics-specific Playwright test fixtures.
 *
 * Uses the EDITOR user (reader@quarterlyreview.org) — analytics endpoints
 * require assertEditorOrAdmin. EDITOR is the minimum required role.
 *
 * Co-located in e2e/analytics/ (not e2e/helpers/) to avoid triggering
 * all Playwright suites via detect-changes.sh shared prefix matching.
 */

import { test as base, expect, type Page } from "@playwright/test";
import { createAuthedContext, EDITOR_USER_PROFILE } from "../helpers/auth";
import { getOrgBySlug, getUserByEmail } from "../helpers/db";

interface SeedOrg {
  id: string;
  name: string;
  slug: string;
}

interface SeedUser {
  id: string;
  email: string;
}

export const test = base.extend<{
  seedOrg: SeedOrg;
  seedEditor: SeedUser;
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

  authedPage: async ({ browser, seedOrg, seedEditor, baseURL }, use) => {
    const { context, page } = await createAuthedContext(
      browser,
      baseURL ?? undefined,
      seedOrg.id,
      seedEditor.id,
      EDITOR_USER_PROFILE,
    );

    await use(page);

    await context.close();
  },
});

export { expect };
