/**
 * Playwright global setup — validates seed data exists before running tests.
 */

import { getOrgBySlug, getUserByEmail, disconnectDb } from "./helpers/db";

export default async function globalSetup() {
  const org = await getOrgBySlug("quarterly-review");
  if (!org) {
    await disconnectDb();
    throw new Error(
      'E2E prerequisite failed: seed org "quarterly-review" not found.\n' +
        "Run `pnpm db:seed` to populate seed data before running E2E tests.",
    );
  }

  const user = await getUserByEmail("writer@example.com");
  if (!user) {
    await disconnectDb();
    throw new Error(
      'E2E prerequisite failed: seed user "writer@example.com" not found.\n' +
        "Run `pnpm db:seed` to populate seed data before running E2E tests.",
    );
  }

  await disconnectDb();
}
