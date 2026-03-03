import { test, expect } from "../helpers/workspace-fixtures";
import { deleteExternalSubmission } from "../helpers/workspace-db";

test.describe("External Submissions (/workspace/external)", () => {
  test("shows heading and Track Submission button", async ({ authedPage }) => {
    await authedPage.goto("/workspace/external");

    const main = authedPage.locator("main");
    await expect(
      main.getByRole("heading", { name: "External Submissions" }),
    ).toBeVisible();
    await expect(
      main.getByRole("link", { name: /Track Submission/ }),
    ).toBeVisible();
  });

  test("displays external submission in list", async ({
    authedPage,
    workspaceData,
  }) => {
    await authedPage.goto("/workspace/external");

    const main = authedPage.locator("main");
    await expect(
      main.getByText(workspaceData.externalSubmission.journalName),
    ).toBeVisible({ timeout: 10_000 });
  });

  test("creates new external submission", async ({ authedPage }) => {
    const suffix = Date.now().toString(36);
    const journalName = `E2E Created Journal ${suffix}`;
    let createdId: string | undefined;

    try {
      await authedPage.goto("/workspace/external/new");

      const main = authedPage.locator("main");
      await expect(
        main.getByRole("heading", { name: /Track External Submission/ }),
      ).toBeVisible();

      // Fill journal name — use the form input, not the label
      await main.getByLabel("Journal Name").fill(journalName);

      // Submit
      await main.getByRole("button", { name: "Track Submission" }).click();

      // Should redirect to external submissions list or detail
      await expect(authedPage).toHaveURL(/\/workspace\/external/, {
        timeout: 10_000,
      });

      // Wait for the new entry to appear
      await expect(
        authedPage.locator("main").getByText(journalName),
      ).toBeVisible({
        timeout: 10_000,
      });

      // Click to get to detail page for the ID
      await authedPage.locator("main").getByText(journalName).click();
      const url = authedPage.url();
      const match = url.match(/\/workspace\/external\/([0-9a-f-]+)/);
      createdId = match?.[1];
    } finally {
      if (createdId) {
        await deleteExternalSubmission(createdId);
      }
    }
  });

  test("requires journal name", async ({ authedPage }) => {
    await authedPage.goto("/workspace/external/new");

    const main = authedPage.locator("main");

    // Click submit without filling anything
    await main.getByRole("button", { name: "Track Submission" }).click();

    // Should show validation error — use .first() since the error message
    // text "Journal name is required" also partial-matches the "Journal Name" label
    await expect(
      main.getByText("Journal name is required").first(),
    ).toBeVisible();
  });

  test("detail page shows info and action buttons", async ({
    authedPage,
    workspaceData,
  }) => {
    await authedPage.goto(
      `/workspace/external/${workspaceData.externalSubmission.id}`,
    );

    const main = authedPage.locator("main");

    // Heading shows journal name
    await expect(
      main.getByRole("heading", {
        name: workspaceData.externalSubmission.journalName,
      }),
    ).toBeVisible({ timeout: 10_000 });

    // Action buttons
    await expect(main.getByRole("button", { name: /Edit/ })).toBeVisible();
    await expect(main.getByRole("button", { name: /Delete/ })).toBeVisible();
    await expect(
      main.getByRole("button", { name: /Log Message/ }),
    ).toBeVisible();
  });

  test("deletes external submission", async ({ authedPage, workspaceData }) => {
    await authedPage.goto(
      `/workspace/external/${workspaceData.externalSubmission.id}`,
    );

    const main = authedPage.locator("main");

    // Wait for page to load
    await expect(
      main.getByRole("heading", {
        name: workspaceData.externalSubmission.journalName,
      }),
    ).toBeVisible({ timeout: 10_000 });

    // Click Delete
    await main.getByRole("button", { name: /Delete/ }).click();

    // Confirm in dialog — dialog is outside main, use page-level
    await expect(authedPage.getByText("Delete submission?")).toBeVisible();
    await authedPage
      .getByRole("button", { name: "Delete", exact: true })
      .click();

    // Should redirect to list
    await expect(authedPage).toHaveURL(/\/workspace\/external$/, {
      timeout: 10_000,
    });

    // Journal name should no longer be visible in main content
    await expect(
      authedPage
        .locator("main")
        .getByText(workspaceData.externalSubmission.journalName),
    ).not.toBeVisible();
  });
});
