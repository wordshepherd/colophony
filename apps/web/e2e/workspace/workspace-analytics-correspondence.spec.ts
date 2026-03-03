import { test, expect } from "../helpers/workspace-fixtures";

test.describe("Writer Analytics (/workspace/analytics)", () => {
  test("displays Writer Analytics heading and overview cards", async ({
    authedPage,
  }) => {
    await authedPage.goto("/workspace/analytics");

    await expect(
      authedPage.getByRole("heading", { name: "Writer Analytics" }),
    ).toBeVisible();

    // Overview stat labels
    await expect(authedPage.getByText("Total Submissions")).toBeVisible({
      timeout: 10_000,
    });
    await expect(authedPage.getByText("Acceptance Rate")).toBeVisible();
    await expect(authedPage.getByText("Avg Response Time")).toBeVisible();
  });

  test("shows date filter inputs", async ({ authedPage }) => {
    await authedPage.goto("/workspace/analytics");

    await expect(authedPage.getByLabel("From")).toBeVisible();
    await expect(authedPage.getByLabel("To")).toBeVisible();
  });
});

test.describe("Correspondence (/workspace/correspondence)", () => {
  test("displays Correspondence heading", async ({ authedPage }) => {
    await authedPage.goto("/workspace/correspondence");

    await expect(
      authedPage.getByRole("heading", { name: "Correspondence" }),
    ).toBeVisible();
  });

  test("shows seeded correspondence item", async ({
    authedPage,
    workspaceData: _workspaceData,
  }) => {
    await authedPage.goto("/workspace/correspondence");

    await expect(authedPage.getByText("Re: Your Submission")).toBeVisible({
      timeout: 10_000,
    });
    await expect(authedPage.getByText("Editor Smith")).toBeVisible();
  });

  test("log correspondence from detail page", async ({
    authedPage,
    workspaceData,
  }) => {
    // Navigate to external submission detail
    await authedPage.goto(
      `/workspace/external/${workspaceData.externalSubmission.id}`,
    );

    // Wait for page to load
    await expect(
      authedPage.getByRole("heading", {
        name: workspaceData.externalSubmission.journalName,
      }),
    ).toBeVisible({ timeout: 10_000 });

    // Click Log Message
    await authedPage.getByRole("button", { name: /Log Message/ }).click();

    // Fill the correspondence form
    await expect(authedPage.getByText(/Log Correspondence/)).toBeVisible();

    // Fill required body/message field
    await authedPage
      .getByPlaceholder(/Paste or type the message content/)
      .fill("Test correspondence message from E2E");

    // Submit
    await authedPage
      .getByRole("button", { name: "Log Message", exact: true })
      .click();

    // Wait for success toast
    await expect(authedPage.getByText(/Correspondence logged/i)).toBeVisible({
      timeout: 10_000,
    });
  });
});
