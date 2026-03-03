import { test, expect } from "../helpers/forms-fixtures";
import { deleteFormDefinition } from "../helpers/forms-db";

test.describe("Form Create (/editor/forms/new)", () => {
  test("creates form with name and description", async ({ authedPage }) => {
    let createdId: string | undefined;

    try {
      await authedPage.goto("/editor/forms/new");

      await expect(authedPage.getByText("Create Form").first()).toBeVisible();

      await authedPage.getByLabel("Name").fill("E2E Created Form");
      await authedPage
        .getByLabel("Description")
        .fill("Form created by E2E test");

      await authedPage.getByRole("button", { name: "Create Form" }).click();

      // Should redirect to the editor
      await expect(authedPage).toHaveURL(/\/editor\/forms\//, {
        timeout: 10_000,
      });

      // Extract form ID from URL
      const url = authedPage.url();
      const match = url.match(/\/editor\/forms\/([\w-]+)/);
      createdId = match?.[1];

      // Form name should be visible in editor header
      await expect(authedPage.getByText("E2E Created Form")).toBeVisible();
    } finally {
      if (createdId) await deleteFormDefinition(createdId);
    }
  });

  test("validates required name field", async ({ authedPage }) => {
    await authedPage.goto("/editor/forms/new");

    await expect(authedPage.getByText("Create Form").first()).toBeVisible();

    // Click Create Form without filling name
    await authedPage.getByRole("button", { name: "Create Form" }).click();

    // Should show validation error (stays on same page)
    await expect(authedPage).toHaveURL(/\/editor\/forms\/new/);
  });
});
