/**
 * Organization deletion E2E tests.
 *
 * These tests create disposable orgs because:
 * 1. We can't delete the seed org (it's used by other suites)
 * 2. API keys are org-scoped — the seed org key won't work for a different org
 *
 * Each test creates its own disposable org + API key + authedPage.
 */

import { test as base, expect, devices, type Browser } from "@playwright/test";
import { buildStorageState, setupPageAuth } from "../helpers/auth";
import {
  createOrg,
  deleteOrg,
  addMember,
  getUserByEmail,
  createApiKey,
  deleteApiKey,
} from "../helpers/db";

/** Admin user profile (ADMIN role) */
const ADMIN_USER_PROFILE = {
  sub: "seed-zitadel-admin-001",
  email: "editor@quarterlyreview.org",
  name: "Test Admin",
};

const ORG_E2E_SCOPES = [
  "organizations:read",
  "organizations:write",
  "users:read",
];

/**
 * Create a disposable org with admin membership and API key,
 * returning an authedPage bound to that org.
 */
async function createDisposableOrgContext(browser: Browser, baseURL: string) {
  const suffix =
    Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const orgName = `Delete Test Org ${suffix}`;

  // Create org
  const org = await createOrg({
    name: orgName,
    slug: `delete-test-${suffix}`,
  });

  // Add admin user as ADMIN member
  const admin = await getUserByEmail("editor@quarterlyreview.org");
  if (!admin) throw new Error("Seed admin not found");
  await addMember(org.id, admin.id, "ADMIN");

  // Create API key scoped to this org
  const apiKey = await createApiKey({
    orgId: org.id,
    userId: admin.id,
    scopes: ORG_E2E_SCOPES,
    name: `e2e-delete-${suffix}`,
  });

  // Create authed browser context
  const context = await browser.newContext({
    ...devices["Desktop Chrome"],
    baseURL,
    storageState: buildStorageState(org.id, ADMIN_USER_PROFILE),
  });

  const page = await context.newPage();
  await setupPageAuth(page, org.id, apiKey.plainKey, ADMIN_USER_PROFILE);

  return { org, apiKey, page, context };
}

base.describe("Delete Organization", () => {
  base(
    "delete button disabled until org name typed",
    async ({ browser, baseURL }) => {
      const { org, apiKey, page, context } = await createDisposableOrgContext(
        browser,
        baseURL ?? "http://localhost:3010",
      );

      try {
        await page.goto("/organizations/settings");

        // Click Delete Organization in Danger Zone
        await page.getByRole("button", { name: "Delete Organization" }).click();

        // Confirmation dialog opens
        await expect(
          page.getByRole("heading", { name: "Delete organization?" }),
        ).toBeVisible();

        // Confirm button should be disabled initially
        const confirmButton = page.getByRole("button", {
          name: "Yes, delete this organization",
        });
        await expect(confirmButton).toBeDisabled();

        // Type partial name — still disabled
        const confirmInput = page.getByPlaceholder(org.name);
        await confirmInput.fill(org.name.slice(0, 5));
        await expect(confirmButton).toBeDisabled();

        // Type full org name — button becomes enabled
        await confirmInput.clear();
        await confirmInput.fill(org.name);
        await expect(confirmButton).toBeEnabled();
      } finally {
        await context.close();
        await deleteApiKey(apiKey.id);
        await deleteOrg(org.id);
      }
    },
  );

  base("deletes org after confirmation", async ({ browser, baseURL }) => {
    const { org, apiKey, page, context } = await createDisposableOrgContext(
      browser,
      baseURL ?? "http://localhost:3010",
    );

    try {
      await page.goto("/organizations/settings");

      // Click Delete Organization in Danger Zone
      await page.getByRole("button", { name: "Delete Organization" }).click();

      // Type exact org name
      await page.getByPlaceholder(org.name).fill(org.name);

      // Click confirm
      await page
        .getByRole("button", { name: "Yes, delete this organization" })
        .click();

      // Assert success toast
      await expect(
        page.getByText("Organization deleted successfully"),
      ).toBeVisible();

      // Assert redirected to home
      await page.waitForURL("**/", { timeout: 10000 });
    } finally {
      await context.close();
      await deleteApiKey(apiKey.id);
      // Idempotent — org may already be deleted by the test
      await deleteOrg(org.id);
    }
  });
});
