import { test, expect } from "../helpers/forms-fixtures";

test.describe("Form List (/editor/forms)", () => {
  test("displays heading and New Form button", async ({ authedPage }) => {
    await authedPage.goto("/editor/forms");

    await expect(
      authedPage.getByRole("heading", { name: "Forms" }),
    ).toBeVisible();
    await expect(
      authedPage.getByRole("link", { name: "New Form" }),
    ).toBeVisible();
  });

  test("shows seeded form in list", async ({ authedPage, formData }) => {
    await authedPage.goto("/editor/forms");

    await expect(authedPage.getByText(formData.form.name)).toBeVisible({
      timeout: 10_000,
    });
  });

  test("filters by Drafts tab", async ({ authedPage, formData }) => {
    await authedPage.goto("/editor/forms");

    // Wait for form list to load
    await expect(authedPage.getByText(formData.form.name)).toBeVisible({
      timeout: 10_000,
    });

    // Click Drafts tab — seeded form is DRAFT so it should appear
    await authedPage.getByRole("tab", { name: "Drafts" }).click();
    await expect(authedPage.getByText(formData.form.name)).toBeVisible();

    // Click Published tab — draft form should not appear
    await authedPage.getByRole("tab", { name: "Published" }).click();
    await authedPage.waitForTimeout(400);
    await expect(authedPage.getByText(formData.form.name)).not.toBeVisible();
  });
});
