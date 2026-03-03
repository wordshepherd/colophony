import { test, expect } from "../helpers/organization-fixtures";
import { deleteOrg, getOrgBySlug } from "../helpers/db";

test.describe("Create Organization (/organizations/new)", () => {
  test("displays create org form", async ({ authedPage }) => {
    await authedPage.goto("/organizations/new");

    await expect(
      authedPage.getByRole("heading", { name: "Create Organization" }),
    ).toBeVisible();

    await expect(authedPage.getByLabel("Organization Name")).toBeVisible();
    await expect(authedPage.getByLabel("URL Slug")).toBeVisible();
    await expect(
      authedPage.getByRole("button", { name: "Create Organization" }),
    ).toBeVisible();
  });

  test("auto-generates slug from name", async ({ authedPage }) => {
    await authedPage.goto("/organizations/new");

    const nameInput = authedPage.getByLabel("Organization Name");
    const slugInput = authedPage.getByLabel("URL Slug");

    await nameInput.fill("Test Literary Magazine");

    // Slug should auto-populate
    await expect(slugInput).toHaveValue("test-literary-magazine");
  });

  test("creates org and redirects to settings", async ({ authedPage }) => {
    const suffix = Date.now().toString(36);
    const orgName = `E2E Test Org ${suffix}`;
    const expectedSlug = `e2e-test-org-${suffix}`;

    await authedPage.goto("/organizations/new");

    // Fill name (slug auto-generates)
    await authedPage.getByLabel("Organization Name").fill(orgName);

    // Wait for slug availability check to pass (button becomes enabled)
    const createButton = authedPage.getByRole("button", {
      name: "Create Organization",
    });
    await expect(createButton).toBeEnabled({ timeout: 5000 });

    // Create the org
    await createButton.click();

    // Assert redirected to settings
    await authedPage.waitForURL("**/organizations/settings", {
      timeout: 10000,
    });

    // Assert success toast
    await expect(authedPage.getByText("Organization created")).toBeVisible();

    // Cleanup: delete the org via DB
    const org = await getOrgBySlug(expectedSlug);
    if (org) {
      await deleteOrg(org.id);
    }
  });
});
