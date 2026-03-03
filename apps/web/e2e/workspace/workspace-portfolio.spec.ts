import { test, expect } from "../helpers/workspace-fixtures";

test.describe("Portfolio (/workspace/portfolio)", () => {
  test("displays Portfolio heading and filter controls", async ({
    authedPage,
  }) => {
    await authedPage.goto("/workspace/portfolio");

    await expect(
      authedPage.getByRole("heading", { name: "Portfolio" }),
    ).toBeVisible();

    // Filter controls
    await expect(
      authedPage.getByPlaceholder("Search titles, journals..."),
    ).toBeVisible();

    // Group by piece toggle
    await expect(authedPage.getByText("Group by piece")).toBeVisible();
  });

  test("shows external submission in portfolio", async ({
    authedPage,
    workspaceData,
  }) => {
    await authedPage.goto("/workspace/portfolio");

    await expect(
      authedPage.getByText(workspaceData.externalSubmission.journalName),
    ).toBeVisible({ timeout: 10_000 });
  });

  test("source filter Colophony hides external items", async ({
    authedPage,
    workspaceData,
  }) => {
    await authedPage.goto("/workspace/portfolio");

    // Wait for data to load
    await expect(
      authedPage.getByText(workspaceData.externalSubmission.journalName),
    ).toBeVisible({ timeout: 10_000 });

    // Select "Colophony" source filter
    await authedPage.getByRole("combobox").last().click();
    await authedPage.getByRole("option", { name: "Colophony" }).click();

    // External item should no longer be visible
    await expect(
      authedPage.getByText(workspaceData.externalSubmission.journalName),
    ).not.toBeVisible();
  });
});
