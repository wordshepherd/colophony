import { test, expect } from "../helpers/workspace-fixtures";

test.describe("Portfolio (/workspace/portfolio)", () => {
  test("displays Portfolio heading and filter controls", async ({
    authedPage,
  }) => {
    await authedPage.goto("/workspace/portfolio");

    const main = authedPage.locator("main");
    await expect(
      main.getByRole("heading", { name: "Portfolio" }),
    ).toBeVisible();

    // Filter controls
    await expect(
      main.getByPlaceholder("Search titles, journals..."),
    ).toBeVisible();

    // Group by piece toggle
    await expect(main.getByText("Group by piece")).toBeVisible();
  });

  test("shows external submission in portfolio", async ({
    authedPage,
    workspaceData,
  }) => {
    await authedPage.goto("/workspace/portfolio");

    const main = authedPage.locator("main");
    await expect(
      main.getByText(workspaceData.externalSubmission.journalName).first(),
    ).toBeVisible({ timeout: 10_000 });
  });

  test("source filter Colophony hides external items", async ({
    authedPage,
    workspaceData,
  }) => {
    await authedPage.goto("/workspace/portfolio");

    const main = authedPage.locator("main");

    // Wait for data to load
    await expect(
      main.getByText(workspaceData.externalSubmission.journalName).first(),
    ).toBeVisible({ timeout: 10_000 });

    // Select "Colophony" source filter — use last combobox (source, not status)
    await main.getByRole("combobox").last().click();
    await authedPage.getByRole("option", { name: "Colophony" }).click();

    // External item should no longer be visible
    await expect(
      main.getByText(workspaceData.externalSubmission.journalName),
    ).not.toBeVisible();
  });
});
