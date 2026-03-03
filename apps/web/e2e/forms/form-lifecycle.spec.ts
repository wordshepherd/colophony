import { test, expect } from "../helpers/forms-fixtures";
import {
  createFormDefinition,
  createFormField,
  publishFormDefinition,
  deleteFormDefinition,
} from "../helpers/forms-db";

test.describe("Form Lifecycle", () => {
  test("publishes a draft form", async ({ authedPage, seedOrg, seedAdmin }) => {
    const form = await createFormDefinition({
      orgId: seedOrg.id,
      name: "E2E Publish Form",
      createdBy: seedAdmin.id,
    });

    // Add at least one field (some implementations require it)
    await createFormField({
      formDefinitionId: form.id,
      fieldKey: "title",
      fieldType: "text",
      label: "Title",
      sortOrder: 0,
    });

    try {
      await authedPage.goto(`/editor/forms/${form.id}`);

      // Wait for editor to load
      await expect(authedPage.getByText("E2E Publish Form")).toBeVisible({
        timeout: 10_000,
      });

      // Click Publish (exact match avoids form name button "E2E Publish Form")
      await authedPage
        .getByRole("button", { name: "Publish", exact: true })
        .click();

      // Status badge should show Published
      await expect(authedPage.getByText("Published")).toBeVisible({
        timeout: 10_000,
      });

      // Publish button should be gone (only shows for DRAFT)
      await expect(
        authedPage.getByRole("button", { name: "Publish", exact: true }),
      ).not.toBeVisible();
    } finally {
      await deleteFormDefinition(form.id);
    }
  });

  test("archives a published form", async ({
    authedPage,
    seedOrg,
    seedAdmin,
  }) => {
    const form = await createFormDefinition({
      orgId: seedOrg.id,
      name: "E2E Archive Form",
      createdBy: seedAdmin.id,
    });
    await publishFormDefinition(form.id);

    try {
      await authedPage.goto(`/editor/forms/${form.id}`);

      await expect(authedPage.getByText("E2E Archive Form")).toBeVisible({
        timeout: 10_000,
      });

      // Click Archive (exact match avoids form name button "E2E Archive Form")
      await authedPage
        .getByRole("button", { name: "Archive", exact: true })
        .click();

      // Status badge should show Archived
      await expect(authedPage.getByText("Archived")).toBeVisible({
        timeout: 10_000,
      });
    } finally {
      await deleteFormDefinition(form.id);
    }
  });

  test("duplicates a form", async ({ authedPage, formData }) => {
    let duplicateId: string | undefined;

    try {
      await authedPage.goto(`/editor/forms/${formData.form.id}`);

      await expect(authedPage.getByText(formData.form.name)).toBeVisible({
        timeout: 10_000,
      });

      // Click Duplicate
      await authedPage.getByRole("button", { name: "Duplicate" }).click();

      // Should show success toast
      await expect(authedPage.getByText("Form duplicated")).toBeVisible({
        timeout: 10_000,
      });

      // Navigate to list and verify the duplicate exists
      await authedPage.goto("/editor/forms");
      const copyName = `${formData.form.name} (Copy)`;
      await expect(authedPage.getByText(copyName)).toBeVisible({
        timeout: 10_000,
      });

      // Extract duplicate ID for cleanup by clicking into it
      const copyLink = authedPage.getByRole("link", { name: copyName });
      const href = await copyLink.getAttribute("href");
      const match = href?.match(/\/editor\/forms\/([\w-]+)/);
      duplicateId = match?.[1];
    } finally {
      if (duplicateId) await deleteFormDefinition(duplicateId);
    }
  });

  test("deletes a draft form", async ({ authedPage, seedOrg, seedAdmin }) => {
    const form = await createFormDefinition({
      orgId: seedOrg.id,
      name: "E2E Delete Form",
      createdBy: seedAdmin.id,
    });

    // No try/finally needed — the test is deleting the form via UI
    await authedPage.goto(`/editor/forms/${form.id}`);

    await expect(authedPage.getByText("E2E Delete Form")).toBeVisible({
      timeout: 10_000,
    });

    // Click Delete (exact match avoids form name button "E2E Delete Form")
    await authedPage
      .getByRole("button", { name: "Delete", exact: true })
      .click();

    // Should redirect to form list
    await expect(authedPage).toHaveURL(/\/editor\/forms$/, {
      timeout: 10_000,
    });

    // Form should not be in the list
    await expect(authedPage.getByText("E2E Delete Form")).not.toBeVisible();
  });

  test("published form shows read-only notice", async ({
    authedPage,
    seedOrg,
    seedAdmin,
  }) => {
    const form = await createFormDefinition({
      orgId: seedOrg.id,
      name: "E2E ReadOnly Form",
      createdBy: seedAdmin.id,
    });
    await publishFormDefinition(form.id);

    try {
      await authedPage.goto(`/editor/forms/${form.id}`);

      await expect(authedPage.getByText("E2E ReadOnly Form")).toBeVisible({
        timeout: 10_000,
      });

      // Read-only notice
      await expect(authedPage.getByText("cannot be edited")).toBeVisible();

      // Palette buttons should be disabled
      const shortTextBtn = authedPage.getByRole("button", {
        name: "Short Text",
      });
      await expect(shortTextBtn).toBeDisabled();
    } finally {
      await deleteFormDefinition(form.id);
    }
  });
});
