import { test, expect } from "../helpers/workspace-fixtures";
import { deleteExternalSubmission } from "../helpers/workspace-db";

// Headers must match Submittable preset patterns: /publication|category/i → journalName,
// /^status$/i → status, /date\s*submitted/i → sentAt
const VALID_CSV =
  "Publication,Status,Date Submitted\nThe Paris Review,New,2025-01-15\nPloughshares,Accepted,2025-02-01\n";
const EMPTY_CSV = "Publication,Status,Date Submitted\n";

test.describe("Import Submissions (/workspace/import)", () => {
  test("displays heading and stepper steps", async ({ authedPage }) => {
    await authedPage.goto("/workspace/import");

    const main = authedPage.locator("main");
    await expect(
      main.getByRole("heading", { name: "Import Submissions" }),
    ).toBeVisible();

    // Stepper step labels — scope to main and use exact match for "Review"
    await expect(main.getByText("Select File")).toBeVisible();
    await expect(main.getByText("Map Columns")).toBeVisible();
    await expect(main.getByText("Map Statuses")).toBeVisible();
    await expect(main.getByText("Review", { exact: true })).toBeVisible();
  });

  test("rejects empty CSV", async ({ authedPage }) => {
    await authedPage.goto("/workspace/import");

    const main = authedPage.locator("main");

    // Upload empty CSV
    await main.locator('input[type="file"]').setInputFiles({
      name: "test.csv",
      mimeType: "text/csv",
      buffer: Buffer.from(EMPTY_CSV),
    });

    // Should show error about no data rows
    await expect(main.getByText(/no data|empty|no rows/i)).toBeVisible({
      timeout: 5_000,
    });
  });

  test("full wizard import with Submittable preset", async ({ authedPage }) => {
    const createdIds: string[] = [];

    try {
      await authedPage.goto("/workspace/import");

      const main = authedPage.locator("main");

      // Upload valid CSV
      await main.locator('input[type="file"]').setInputFiles({
        name: "test.csv",
        mimeType: "text/csv",
        buffer: Buffer.from(VALID_CSV),
      });

      // Wait for preview to show
      await expect(main.getByText(/preview/i)).toBeVisible({
        timeout: 5_000,
      });

      // Click Next to move to Map Columns — wait for enabled first
      const nextBtn = main.getByRole("button", { name: /Next/ }).first();
      await expect(nextBtn).toBeEnabled({ timeout: 5_000 });
      await nextBtn.click();

      // Wait for Map Columns step
      await expect(main.getByText("Column Mapping")).toBeVisible({
        timeout: 5_000,
      });

      // Next is enabled only when journalName is mapped (auto-mapped via preset)
      const nextBtn2 = main.getByRole("button", { name: /Next/ }).first();
      await expect(nextBtn2).toBeEnabled({ timeout: 5_000 });
      await nextBtn2.click();

      // Wait for Map Statuses step
      await expect(main.getByText("Status Mapping")).toBeVisible({
        timeout: 5_000,
      });

      // Click Next to Review
      const nextBtn3 = main.getByRole("button", { name: /Next/ }).first();
      await expect(nextBtn3).toBeEnabled({ timeout: 5_000 });
      await nextBtn3.click();

      // Wait for Review step — Import button text includes row count: "Import 2 Submissions"
      const importBtn = main.getByRole("button", {
        name: /Import \d+ Submission/,
      });
      await expect(importBtn).toBeVisible({ timeout: 5_000 });

      // Click Import
      await importBtn.click();

      // Wait for success
      await expect(main.getByText(/success|imported|complete/i)).toBeVisible({
        timeout: 10_000,
      });

      // Navigate to external submissions list to find created entries
      await authedPage.goto("/workspace/external");
      await authedPage.waitForTimeout(2_000);

      // Look for our imported entries and capture IDs for cleanup
      const listMain = authedPage.locator("main");
      for (const name of ["The Paris Review", "Ploughshares"]) {
        const link = listMain.getByText(name).first();
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
