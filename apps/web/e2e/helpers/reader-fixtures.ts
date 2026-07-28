/**
 * Reader-specific Playwright test fixtures.
 *
 * Uses the WRITER user (writer@example.com) who has READER role in
 * the quarterly-review org. Tests verify that READER-role users see
 * restricted UI (no editor/admin navigation, read-only settings).
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

export const test = base.extend<{
  seedOrg: SeedOrg;
  seedReader: SeedUser;
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

  authedPage: async ({ browser, seedOrg, seedReader, baseURL }, use) => {
    const { context, page } = await createAuthedContext(
      browser,
      baseURL ?? undefined,
      seedOrg.id,
      seedReader.id,
      WRITER_USER_PROFILE,
    );

    await use(page);

    await context.close();
  },
});

export { expect };
