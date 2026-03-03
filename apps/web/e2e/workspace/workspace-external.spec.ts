import { test, expect } from "../helpers/workspace-fixtures";
import { deleteExternalSubmission } from "../helpers/workspace-db";

test.describe("External Submissions (/workspace/external)", () => {
  test("shows heading and Track Submission button", async ({ authedPage }) => {
    await authedPage.goto("/workspace/external");

    await expect(
      authedPage.getByRole("heading", { name: "External Submissions" }),
    ).toBeVisible();
    await expect(
      authedPage.getByRole("link", { name: /Track Submission/ }),
    ).toBeVisible();
  });

  test("displays external submission in list", async ({
    authedPage,
    workspaceData,
  }) => {
    await authedPage.goto("/workspace/external");

    await expect(
      authedPage.getByText(workspaceData.externalSubmission.journalName),
    ).toBeVisible({ timeout: 10_000 });
  });

  test("creates new external submission", async ({ authedPage }) => {
    const suffix = Date.now().toString(36);
    const journalName = `E2E Created Journal ${suffix}`;
    let createdId: string | undefined;

    try {
      await authedPage.goto("/workspace/external/new");

      await expect(
        authedPage.getByRole("heading", {
          name: /Track External Submission/,
        }),
      ).toBeVisible();

      // Fill journal name
      await authedPage.getByLabel("Journal Name").fill(journalName);

      // Submit
      await authedPage
        .getByRole("button", { name: "Track Submission" })
        .click();

      // Should redirect to external submissions list
      await expect(authedPage).toHaveURL(/\/workspace\/external/, {
        timeout: 10_000,
      });

      // Extract created ID from the list for cleanup — navigate to find it
      await expect(authedPage.getByText(journalName)).toBeVisible({
        timeout: 10_000,
      });

      // Click to get to detail page for the ID
      await authedPage.getByText(journalName).click();
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

    // Click submit without filling anything
    await authedPage.getByRole("button", { name: "Track Submission" }).click();

    // Should show validation error
    await expect(authedPage.getByText(/journal name|required/i)).toBeVisible();
  });

  test("detail page shows info and action buttons", async ({
    authedPage,
    workspaceData,
  }) => {
    await authedPage.goto(
      `/workspace/external/${workspaceData.externalSubmission.id}`,
    );

    // Heading shows journal name
    await expect(
      authedPage.getByRole("heading", {
        name: workspaceData.externalSubmission.journalName,
      }),
    ).toBeVisible({ timeout: 10_000 });

    // Action buttons
    await expect(
      authedPage.getByRole("button", { name: /Edit/ }),
    ).toBeVisible();
    await expect(
      authedPage.getByRole("button", { name: /Delete/ }),
    ).toBeVisible();
    await expect(
      authedPage.getByRole("button", { name: /Log Message/ }),
    ).toBeVisible();
  });

  test("deletes external submission", async ({ authedPage, workspaceData }) => {
    await authedPage.goto(
      `/workspace/external/${workspaceData.externalSubmission.id}`,
    );

    // Wait for page to load
    await expect(
      authedPage.getByRole("heading", {
        name: workspaceData.externalSubmission.journalName,
      }),
    ).toBeVisible({ timeout: 10_000 });

    // Click Delete
    await authedPage.getByRole("button", { name: /Delete/ }).click();

    // Confirm in dialog
    await expect(authedPage.getByText("Delete submission?")).toBeVisible();
    await authedPage
      .getByRole("button", { name: "Delete", exact: true })
      .click();

    // Should redirect to list
    await expect(authedPage).toHaveURL(/\/workspace\/external$/, {
      timeout: 10_000,
    });

    // Journal name should no longer be visible
    await expect(
      authedPage.getByText(workspaceData.externalSubmission.journalName),
    ).not.toBeVisible();
  });
});
