/**
 * Organization deletion E2E tests.
 *
 * These tests create disposable orgs because we can't delete the seed org —
 * it is used by every other suite.
 *
 * Each test creates its own disposable org + authedPage. The admin must be an
 * ADMIN member of the disposable org: org-context resolves the
 * X-Organization-Id header against `organization_members` and 403s otherwise.
 */

import { test as base, expect, type Browser } from "@playwright/test";
import { createAuthedContext, ADMIN_USER_PROFILE } from "../helpers/auth";
import { createOrg, deleteOrg, addMember, getUserByEmail } from "../helpers/db";

/**
 * Create a disposable org with admin membership,
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

  const { context, page } = await createAuthedContext(
    browser,
    baseURL,
    org.id,
    admin.id,
    ADMIN_USER_PROFILE,
  );

  return { org, page, context };
}

base.describe("Delete Organization", () => {
  base(
    "delete button disabled until org name typed",
    async ({ browser, baseURL }) => {
      const { org, page, context } = await createDisposableOrgContext(
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
        await deleteOrg(org.id);
      }
    },
  );

  base("deletes org after confirmation", async ({ browser, baseURL }) => {
    const { org, page, context } = await createDisposableOrgContext(
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
      // Idempotent — org may already be deleted by the test
      await deleteOrg(org.id);
    }
  });
});
