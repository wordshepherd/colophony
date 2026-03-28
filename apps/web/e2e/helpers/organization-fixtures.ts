/**
 * Organization-specific Playwright test fixtures.
 *
 * Uses the ADMIN user (editor@quarterlyreview.org) — org settings,
 * member management, and org deletion all require ADMIN role.
 *
 * Provides `inviteTarget` fixture with a second test user for
 * invite/remove tests, with automatic cleanup in teardown.
 */

import { test as base, expect, type Page, devices } from "@playwright/test";
import { buildStorageState, setupPageAuth } from "./auth";
import {
  getOrgBySlug,
  getUserByEmail,
  createApiKey,
  deleteApiKey,
  createUser,
  deleteUser,
  createOrg,
  deleteOrg,
  addMember,
} from "./db";

/** Admin user profile (ADMIN role in quarterly-review org) */
const ADMIN_USER_PROFILE = {
  sub: "seed-zitadel-admin-001",
  email: "editor@quarterlyreview.org",
  name: "Test Admin",
};

/** All scopes needed for Organization E2E tests */
const ORG_E2E_SCOPES = [
  "organizations:read",
  "organizations:write",
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

interface InviteTarget {
  id: string;
  email: string;
}

export const test = base.extend<{
  seedOrg: SeedOrg;
  seedAdmin: SeedUser;
  testApiKey: TestApiKey;
  authedPage: Page;
  inviteTarget: InviteTarget;
  inviteeOrg: SeedOrg;
  inviteePage: Page;
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

  seedAdmin: async ({}, use) => {
    const user = await getUserByEmail("editor@quarterlyreview.org");
    if (!user) {
      throw new Error(
        'Seed admin "editor@quarterlyreview.org" not found. Run `pnpm db:seed` first.',
      );
    }
    await use(user);
  },

  testApiKey: async ({ seedOrg, seedAdmin }, use) => {
    const key = await createApiKey({
      orgId: seedOrg.id,
      userId: seedAdmin.id,
      scopes: ORG_E2E_SCOPES,
      name: `e2e-org-${Date.now()}`,
    });

    await use(key);

    await deleteApiKey(key.id);
  },

  authedPage: async ({ browser, seedOrg, testApiKey, baseURL }, use) => {
    const context = await browser.newContext({
      ...devices["Desktop Chrome"],
      baseURL: baseURL ?? undefined,
      storageState: buildStorageState(seedOrg.id, ADMIN_USER_PROFILE),
    });

    const page = await context.newPage();

    await setupPageAuth(
      page,
      seedOrg.id,
      testApiKey.plainKey,
      ADMIN_USER_PROFILE,
    );

    await use(page);

    await context.close();
  },

  inviteTarget: async ({}, use) => {
    const suffix = Date.now().toString(36);
    const email = `e2e-invite-${suffix}@test.example.com`;
    const user = await createUser({
      email,
      zitadelUserId: `e2e-zitadel-invite-${suffix}`,
    });

    await use({ id: user.id, email: user.email });

    await deleteUser(user.id);
  },

  /**
   * Separate org for invitee API key auth.
   *
   * The org-context hook requires the API key creator to be a member of
   * the key's org. The invitee isn't a member of the seed org, so we
   * create a dedicated org where the invitee IS a member. The accept
   * endpoint uses SECURITY DEFINER functions that operate cross-org.
   */
  inviteeOrg: async ({ inviteTarget }, use) => {
    const org = await createOrg({
      name: "Invitee Auth Org",
      slug: `invitee-auth-${Date.now().toString(36)}`,
    });
    await addMember(org.id, inviteTarget.id, "READER");
    await use(org);
    await deleteOrg(org.id);
  },

  /**
   * Playwright page authenticated as the inviteTarget user.
   * Used for accept-side invitation tests.
   */
  inviteePage: async ({ browser, inviteeOrg, inviteTarget, baseURL }, use) => {
    const apiKey = await createApiKey({
      orgId: inviteeOrg.id,
      userId: inviteTarget.id,
      scopes: ["organizations:read", "users:read"],
      name: `e2e-invitee-${Date.now()}`,
    });

    const inviteeProfile = {
      sub: `e2e-zitadel-invite-${inviteTarget.id}`,
      email: inviteTarget.email,
      name: "Test Invitee",
    };

    const context = await browser.newContext({
      ...devices["Desktop Chrome"],
      baseURL: baseURL ?? undefined,
      storageState: buildStorageState(inviteeOrg.id, inviteeProfile),
    });

    const page = await context.newPage();
    await setupPageAuth(page, inviteeOrg.id, apiKey.plainKey, inviteeProfile);

    await use(page);

    await context.close();
    await deleteApiKey(apiKey.id);
  },
});

export { expect };
