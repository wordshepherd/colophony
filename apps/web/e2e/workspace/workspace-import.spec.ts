import { test, expect } from "../helpers/workspace-fixtures";
import { deleteExternalSubmission } from "../helpers/workspace-db";

const VALID_CSV =
  "Title,Status,Date Submitted\nThe Paris Review,New,2025-01-15\nPloughshares,Accepted,2025-02-01\n";
const EMPTY_CSV = "Title,Status,Date Submitted\n";

test.describe("Import Submissions (/workspace/import)", () => {
  test("displays heading and stepper steps", async ({ authedPage }) => {
    await authedPage.goto("/workspace/import");

    await expect(
      authedPage.getByRole("heading", { name: "Import Submissions" }),
    ).toBeVisible();

    // Stepper step labels
    await expect(authedPage.getByText("Select File")).toBeVisible();
    await expect(authedPage.getByText("Map Columns")).toBeVisible();
    await expect(authedPage.getByText("Map Statuses")).toBeVisible();
    await expect(authedPage.getByText("Review")).toBeVisible();
  });

  test("rejects empty CSV", async ({ authedPage }) => {
    await authedPage.goto("/workspace/import");

    // Upload empty CSV
    await authedPage.locator('input[type="file"]').setInputFiles({
      name: "test.csv",
      mimeType: "text/csv",
      buffer: Buffer.from(EMPTY_CSV),
    });

    // Should show error about no data rows
    await expect(authedPage.getByText(/no data|empty|no rows/i)).toBeVisible({
      timeout: 5_000,
    });
  });

  test("full wizard import with Submittable preset", async ({ authedPage }) => {
    const createdIds: string[] = [];

    try {
      await authedPage.goto("/workspace/import");

      // Upload valid CSV
      await authedPage.locator('input[type="file"]').setInputFiles({
        name: "test.csv",
        mimeType: "text/csv",
        buffer: Buffer.from(VALID_CSV),
      });

      // Wait for preview to show
      await expect(authedPage.getByText(/preview/i)).toBeVisible({
        timeout: 5_000,
      });

      // Click Next to move to Map Columns
      await authedPage.getByRole("button", { name: /Next/ }).click();

      // Wait for Map Columns step
      await expect(authedPage.getByText("Column Mapping")).toBeVisible({
        timeout: 5_000,
      });

      // Click Next to Map Statuses
      await authedPage.getByRole("button", { name: /Next/ }).click();

      // Wait for Map Statuses step
      await expect(authedPage.getByText("Status Mapping")).toBeVisible({
        timeout: 5_000,
      });

      // Click Next to Review
      await authedPage.getByRole("button", { name: /Next/ }).click();

      // Wait for Review step
      await expect(
        authedPage.getByRole("button", { name: /Import/ }),
      ).toBeVisible({ timeout: 5_000 });

      // Click Import
      await authedPage.getByRole("button", { name: /Import/ }).click();

      // Wait for success
      await expect(
        authedPage.getByText(/success|imported|complete/i),
      ).toBeVisible({ timeout: 10_000 });

      // Navigate to external submissions list to find created entries
      await authedPage.goto("/workspace/external");
      await authedPage.waitForTimeout(2_000);

      // Look for our imported entries and capture IDs for cleanup
      for (const name of ["The Paris Review", "Ploughshares"]) {
        const link = authedPage.getByText(name).first();
        if ((await link.count()) > 0) {
          await link.click();
          const url = authedPage.url();
          const match = url.match(/\/workspace\/external\/([0-9a-f-]+)/);
          if (match?.[1]) {
            createdIds.push(match[1]);
          }
          await authedPage.goto("/workspace/external");
          await authedPage.waitForTimeout(1_000);
        }
      }
    } finally {
      for (const id of createdIds) {
        await deleteExternalSubmission(id);
      }
    }
  });
});
