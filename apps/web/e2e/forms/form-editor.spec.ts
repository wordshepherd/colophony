import { test, expect } from "../helpers/forms-fixtures";
import {
  createFormDefinition,
  deleteFormDefinition,
} from "../helpers/forms-db";

test.describe("Form Editor (/editor/forms/[formId])", () => {
  test("displays editor with field palette and empty canvas", async ({
    authedPage,
    seedOrg,
    seedAdmin,
  }) => {
    const form = await createFormDefinition({
      orgId: seedOrg.id,
      name: "E2E Empty Form",
      createdBy: seedAdmin.id,
    });

    try {
      await authedPage.goto(`/editor/forms/${form.id}`);

      // Palette heading
      await expect(authedPage.getByText("Add Field")).toBeVisible({
        timeout: 10_000,
      });

      // Empty canvas state
      await expect(authedPage.getByText("No fields yet")).toBeVisible();
    } finally {
      await deleteFormDefinition(form.id);
    }
  });

  test("adds a Short Text field from palette", async ({
    authedPage,
    seedOrg,
    seedAdmin,
  }) => {
    const form = await createFormDefinition({
      orgId: seedOrg.id,
      name: "E2E Add Field Form",
      createdBy: seedAdmin.id,
    });

    try {
      await authedPage.goto(`/editor/forms/${form.id}`);

      await expect(authedPage.getByText("No fields yet")).toBeVisible({
        timeout: 10_000,
      });

      // Click Short Text in palette
      await authedPage.getByRole("button", { name: "Short Text" }).click();

      // Field should appear on canvas (empty state disappears)
      await expect(authedPage.getByText("No fields yet")).not.toBeVisible({
        timeout: 10_000,
      });

      // The generated field label "Text 1" (or "Text") should be visible
      await expect(
        authedPage.getByText("Short Text", { exact: false }).last(),
      ).toBeVisible();
    } finally {
      await deleteFormDefinition(form.id);
    }
  });

  test("shows field properties when field is selected", async ({
    authedPage,
    formData,
  }) => {
    await authedPage.goto(`/editor/forms/${formData.form.id}`);

    // Wait for fields to load
    await expect(authedPage.getByText("Title")).toBeVisible({
      timeout: 10_000,
    });

    // Click on the Title field in the canvas
    await authedPage
      .locator("button")
      .filter({ hasText: "Title" })
      .first()
      .click();

    // Properties panel should show Label input with the field's label
    await expect(authedPage.getByLabel("Label")).toBeVisible();
  });

  test("toggles preview mode", async ({ authedPage, formData }) => {
    await authedPage.goto(`/editor/forms/${formData.form.id}`);

    // Wait for editor to load
    await expect(authedPage.getByText("Add Field")).toBeVisible({
      timeout: 10_000,
    });

    // Click Preview button
    await authedPage.getByRole("button", { name: "Preview" }).click();

    // Preview mode: palette should be gone, Editor button should appear
    await expect(
      authedPage.getByRole("button", { name: "Editor" }),
    ).toBeVisible();

    // Click Editor button to return
    await authedPage.getByRole("button", { name: "Editor" }).click();

    // Palette should be back
    await expect(authedPage.getByText("Add Field")).toBeVisible();
  });

  test("adds multiple field types", async ({
    authedPage,
    seedOrg,
    seedAdmin,
  }) => {
    const form = await createFormDefinition({
      orgId: seedOrg.id,
      name: "E2E Multi Field Form",
      createdBy: seedAdmin.id,
    });

    try {
      await authedPage.goto(`/editor/forms/${form.id}`);

      await expect(authedPage.getByText("No fields yet")).toBeVisible({
        timeout: 10_000,
      });

      // Add Short Text
      await authedPage.getByRole("button", { name: "Short Text" }).click();
      await expect(authedPage.getByText("No fields yet")).not.toBeVisible({
        timeout: 10_000,
      });

      // Add Long Text
      await authedPage.getByRole("button", { name: "Long Text" }).click();

      // Add Dropdown
      await authedPage.getByRole("button", { name: "Dropdown" }).click();

      // Should have 3 remove buttons (one per field)
      await expect(
        authedPage.getByRole("button", { name: "Remove field" }),
      ).toHaveCount(3, { timeout: 10_000 });
    } finally {
      await deleteFormDefinition(form.id);
    }
  });

  test("removes a field from canvas", async ({
    authedPage,
    seedOrg,
    seedAdmin,
  }) => {
    const form = await createFormDefinition({
      orgId: seedOrg.id,
      name: "E2E Canvas Cleanup Form",
      createdBy: seedAdmin.id,
    });

    try {
      await authedPage.goto(`/editor/forms/${form.id}`);

      await expect(authedPage.getByText("No fields yet")).toBeVisible({
        timeout: 10_000,
      });

      // Add a field
      await authedPage.getByRole("button", { name: "Short Text" }).click();
      await expect(authedPage.getByText("No fields yet")).not.toBeVisible({
        timeout: 10_000,
      });

      // Remove the field
      await authedPage.getByRole("button", { name: "Remove field" }).click();

      // Canvas should be empty again
      await expect(authedPage.getByText("No fields yet")).toBeVisible({
        timeout: 10_000,
      });
    } finally {
      await deleteFormDefinition(form.id);
    }
  });
});
