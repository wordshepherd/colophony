import { test, expect } from "./fixtures";

test.describe("Submission Analytics Dashboard", () => {
  test("displays Submission Analytics heading and overview stat cards", async ({
    authedPage: page,
  }) => {
    await page.goto("/editor/analytics");

    await expect(
      page.getByRole("heading", { name: "Submission Analytics" }),
    ).toBeVisible();

    // Wait for stat cards to load (data fetched via tRPC)
    const cardLabels = [
      "Total Submissions",
      "Acceptance Rate",
      "Avg Response Time",
      "Pending",
      "This Month",
    ];

    for (const label of cardLabels) {
      await expect(page.getByText(label, { exact: true })).toBeVisible({
        timeout: 10_000,
      });
    }
  });

  test("shows date filter inputs and period selector", async ({
    authedPage: page,
  }) => {
    await page.goto("/editor/analytics");

    // Date inputs
    await expect(page.locator("#startDate")).toBeVisible();
    await expect(page.locator("#endDate")).toBeVisible();

    // Period selector with "All periods" default
    await expect(page.getByText("All periods")).toBeVisible();
  });

  test("renders Status Breakdown and Submission Funnel chart cards", async ({
    authedPage: page,
  }) => {
    await page.goto("/editor/analytics");

    // Wait for overview cards to confirm data is loaded
    await expect(
      page.getByText("Total Submissions", { exact: true }),
    ).toBeVisible({
      timeout: 10_000,
    });

    await expect(page.getByText("Status Breakdown")).toBeVisible();
    await expect(page.getByText("Submission Funnel")).toBeVisible();

    // Verify Recharts renders SVG elements in chart cards
    const statusCard = page
      .locator("text=Status Breakdown")
      .locator("..")
      .locator("..");
    await expect(statusCard.locator(".recharts-wrapper")).toBeVisible({
      timeout: 10_000,
    });

    const funnelCard = page
      .locator("text=Submission Funnel")
      .locator("..")
      .locator("..");
    await expect(funnelCard.locator(".recharts-wrapper")).toBeVisible({
      timeout: 10_000,
    });
  });

  test("renders Submissions Over Time chart with granularity selector", async ({
    authedPage: page,
  }) => {
    await page.goto("/editor/analytics");

    // Wait for data load
    await expect(
      page.getByText("Total Submissions", { exact: true }),
    ).toBeVisible({
      timeout: 10_000,
    });

    await expect(page.getByText("Submissions Over Time")).toBeVisible();

    // Granularity selector defaults to "Monthly"
    await expect(page.getByText("Monthly")).toBeVisible();

    // Change to Daily
    await page.getByText("Monthly").click();
    await page.getByRole("option", { name: "Daily" }).click();

    // Verify selector updated
    await expect(page.getByText("Daily")).toBeVisible();
  });

  test("renders Response Time Distribution and Aging Submissions", async ({
    authedPage: page,
  }) => {
    await page.goto("/editor/analytics");

    // Wait for data load
    await expect(
      page.getByText("Total Submissions", { exact: true }),
    ).toBeVisible({
      timeout: 10_000,
    });

    await expect(page.getByText("Response Time Distribution")).toBeVisible();
    await expect(page.getByText("Aging Submissions")).toBeVisible();

    // Aging table shows either data rows or empty message
    const agingCard = page
      .locator("text=Aging Submissions")
      .locator("..")
      .locator("..");
    const hasData = agingCard.locator("table");
    const hasEmpty = agingCard.getByText("No aging submissions found.");
    await expect(hasData.or(hasEmpty).first()).toBeVisible({ timeout: 10_000 });
  });

  test("date filter updates dashboard data", async ({ authedPage: page }) => {
    await page.goto("/editor/analytics");

    // Wait for initial data to load
    const totalCard = page.getByText("Total Submissions", { exact: true });
    await expect(totalCard).toBeVisible({ timeout: 10_000 });

    // Get the initial total value (the bold number below the label)
    const totalValue = totalCard
      .locator("..")
      .locator("..")
      .locator(".text-2xl");
    await expect(totalValue).not.toHaveText("0");

    // Set start date to far future — should yield 0 submissions
    const futureYear = new Date().getFullYear() + 10;
    await page.locator("#startDate").fill(`${futureYear}-01-01`);

    // Wait for data to reload and show 0
    await expect(totalValue).toHaveText("0", { timeout: 10_000 });
  });
});
