/**
 * Organization-specific Playwright test fixtures.
 *
 * Uses the ADMIN user (editor@quarterlyreview.org) — org settings,
 * member management, and org deletion all require ADMIN role.
 *
 * Provides `inviteTarget` fixture with a second test user for
 * invite/remove tests, with automatic cleanup in teardown.
 */

import { test as base, expect, type Page } from "@playwright/test";
import { createAuthedContext, ADMIN_USER_PROFILE } from "./auth";
import {
  getOrgBySlug,
  getUserByEmail,
  createUser,
  deleteUser,
  createOrg,
  deleteOrg,
  addMember,
} from "./db";

interface SeedOrg {
  id: string;
  name: string;
  slug: string;
}

interface SeedUser {
  id: string;
  email: string;
}

interface InviteTarget {
  id: string;
  email: string;
}

export const test = base.extend<{
  seedOrg: SeedOrg;
  seedAdmin: SeedUser;
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

  authedPage: async ({ browser, seedOrg, seedAdmin, baseURL }, use) => {
    const { context, page } = await createAuthedContext(
      browser,
      baseURL ?? undefined,
      seedOrg.id,
      seedAdmin.id,
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
   * Separate org so the invitee has somewhere to be a member of.
   *
   * The org-context hook resolves `X-Organization-Id` against
   * `organization_members` and returns 403 not_a_member if the user has no
   * roles there. The invitee is by definition not yet a member of the seed
   * org, so without this they could not load the dashboard chrome at all
   * (the notification bell alone calls an org-scoped procedure). The accept
   * endpoint itself is a `userProcedure` and works cross-org via SECURITY
   * DEFINER functions.
   *
   * This is not an API-key artefact — the same membership check applies to
   * interactive auth.
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
   *
   * Used for accept-side invitation tests. The invitee is deliberately a
   * lower-privilege principal than the org admin — that distinction now rides
   * entirely on their READER membership in `inviteeOrg`, which is how the real
   * product expresses it.
   */
  inviteePage: async ({ browser, inviteeOrg, inviteTarget, baseURL }, use) => {
    const inviteeProfile = {
      sub: `e2e-zitadel-invite-${inviteTarget.id}`,
      email: inviteTarget.email,
      name: "Test Invitee",
    };

    const { context, page } = await createAuthedContext(
      browser,
      baseURL ?? undefined,
      inviteeOrg.id,
      inviteTarget.id,
      inviteeProfile,
    );

    await use(page);

    await context.close();
  },
});

export { expect };
