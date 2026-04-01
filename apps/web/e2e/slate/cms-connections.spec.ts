import { test, expect } from "../helpers/slate-fixtures";
import { deleteCmsConnection } from "../helpers/slate-db";

test.describe("CMS Connections (/slate/cms)", () => {
  test("displays heading and New Connection button", async ({ authedPage }) => {
    await authedPage.goto("/slate/cms");

    await expect(
      authedPage.getByRole("heading", { name: "CMS Connections" }),
    ).toBeVisible();
    await expect(
      authedPage.getByRole("link", { name: "New Connection" }),
    ).toBeVisible();
  });

  test("shows seed connection in list", async ({ authedPage, slateData }) => {
    await authedPage.goto("/slate/cms");

    await expect(
      authedPage.getByText(slateData.cmsConnection.name),
    ).toBeVisible({ timeout: 10_000 });

    // WordPress badge in the same table row as the fixture connection
    const row = authedPage
      .locator("table tr")
      .filter({ hasText: slateData.cmsConnection.name });
    await expect(row.getByText("WordPress", { exact: true })).toBeVisible();
  });

  test("filters by adapter type", async ({ authedPage, slateData }) => {
    await authedPage.goto("/slate/cms");

    // Wait for data to load
    await expect(
      authedPage.getByText(slateData.cmsConnection.name),
    ).toBeVisible({ timeout: 10_000 });

    // WordPress tab — seed connection is WordPress
    await authedPage.getByRole("button", { name: "WordPress" }).click();
    await expect(
      authedPage.getByText(slateData.cmsConnection.name),
    ).toBeVisible();

    // Ghost tab — should show empty state
    await authedPage.getByRole("button", { name: "Ghost" }).click();
    await expect(authedPage.getByText("No CMS connections yet")).toBeVisible();
  });

  test("creates connection via form", async ({ authedPage }) => {
    const suffix = Date.now().toString(36);
    const connName = `E2E Ghost ${suffix}`;
    let createdId: string | undefined;

    try {
      await authedPage.goto("/slate/cms/new");

      await expect(
        authedPage.getByRole("heading", { name: "New CMS Connection" }),
      ).toBeVisible();

      // Fill name
      await authedPage.getByLabel("Name").fill(connName);

      // Select Ghost adapter type — Radix Select with FormLabel "Adapter Type"
      await authedPage.getByLabel("Adapter Type").click();
      await authedPage.getByRole("option", { name: "Ghost" }).click();

      // Fill Ghost config fields
      await authedPage
        .getByPlaceholder("https://your-site.ghost.io")
        .fill("https://e2e-ghost.example.com");
      await authedPage
        .getByPlaceholder("xxxxxxxxxxxxxxxxxxxxxxxx:yyyyyyyy")
        .fill("test-admin-api-key:abcdefgh");

      // Submit
      await authedPage
        .getByRole("button", { name: "Create Connection" })
        .click();

      // Should redirect to detail
      await expect(authedPage).toHaveURL(/\/slate\/cms\//, {
        timeout: 10_000,
      });
      await expect(authedPage.getByText(connName)).toBeVisible();

      // Extract ID for cleanup
      const url = authedPage.url();
      const match = url.match(/\/slate\/cms\/([0-9a-f-]+)/);
      createdId = match?.[1];
    } finally {
      if (createdId) {
        await deleteCmsConnection(createdId);
      }
    }
  });
});
