import { test, expect } from "../helpers/slate-fixtures";
import { deletePublication } from "../helpers/slate-db";

test.describe("Publications (/slate/publications)", () => {
  test("displays heading and New Publication button", async ({
    authedPage,
  }) => {
    await authedPage.goto("/slate/publications");

    await expect(
      authedPage.getByRole("heading", { name: "Publications" }),
    ).toBeVisible();
    await expect(
      authedPage.getByRole("link", { name: "New Publication" }).first(),
    ).toBeVisible();
  });

  test("shows seed publication in list", async ({ authedPage, slateData }) => {
    await authedPage.goto("/slate/publications");

    await expect(authedPage.getByText(slateData.publication.name)).toBeVisible({
      timeout: 10_000,
    });
  });

  test("filters by Active status", async ({ authedPage, slateData }) => {
    await authedPage.goto("/slate/publications");

    // Wait for data to load
    await expect(authedPage.getByText(slateData.publication.name)).toBeVisible({
      timeout: 10_000,
    });

    // Active tab — seed pub is ACTIVE, should be visible
    await authedPage.getByRole("button", { name: "Active" }).click();
    await expect(
      authedPage.getByText(slateData.publication.name),
    ).toBeVisible();

    // Archived tab — should show empty state
    await authedPage.getByRole("button", { name: "Archived" }).click();
    await expect(
      authedPage.getByText("No publications", { exact: true }),
    ).toBeVisible();
  });

  test("search filters by name", async ({ authedPage, slateData }) => {
    await authedPage.goto("/slate/publications");

    // Wait for data to load
    await expect(authedPage.getByText(slateData.publication.name)).toBeVisible({
      timeout: 10_000,
    });

    // Search for existing pub
    await authedPage
      .getByPlaceholder("Search by name...")
      .fill(slateData.publication.name);
    await expect(
      authedPage.getByText(slateData.publication.name),
    ).toBeVisible();

    // Search for nonexistent
    await authedPage
      .getByPlaceholder("Search by name...")
      .fill("nonexistent-xyz-999");
    await expect(
      authedPage.getByText("No publications", { exact: true }),
    ).toBeVisible();
  });

  test("creates new publication via form", async ({ authedPage }) => {
    const suffix = Date.now().toString(36);
    const pubName = `E2E Created Pub ${suffix}`;
    const pubSlug = `e2e-created-pub-${suffix}`;
    let createdId: string | undefined;

    try {
      await authedPage.goto("/slate/publications/new");

      await expect(
        authedPage.getByRole("heading", { name: "New Publication" }),
      ).toBeVisible();

      await authedPage.getByLabel("Name").fill(pubName);
      await authedPage.getByLabel("Slug").fill(pubSlug);
      await authedPage.getByLabel("Description").fill("Created by E2E test");

      await authedPage
        .getByRole("button", { name: "Create Publication" })
        .click();

      // Should redirect to detail page
      await expect(authedPage).toHaveURL(/\/slate\/publications\//, {
        timeout: 10_000,
      });
      await expect(authedPage.getByText(pubName)).toBeVisible();

      // Extract ID from URL for cleanup
      const url = authedPage.url();
      const match = url.match(/\/slate\/publications\/([0-9a-f-]+)/);
      createdId = match?.[1];
    } finally {
      if (createdId) {
        await deletePublication(createdId);
      }
    }
  });

  test("navigates to detail page", async ({ authedPage, slateData }) => {
    await authedPage.goto("/slate/publications");

    // Wait for data to load
    await expect(authedPage.getByText(slateData.publication.name)).toBeVisible({
      timeout: 10_000,
    });

    // Click publication name
    await authedPage.getByText(slateData.publication.name).click();

    await expect(authedPage).toHaveURL(
      new RegExp(`/slate/publications/${slateData.publication.id}`),
    );
    await expect(
      authedPage.getByText(slateData.publication.name),
    ).toBeVisible();
  });
});
