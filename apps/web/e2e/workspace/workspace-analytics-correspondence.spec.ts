import { test, expect } from "../helpers/workspace-fixtures";

test.describe("Writer Analytics (/workspace/analytics)", () => {
  test("displays Writer Analytics heading and overview cards", async ({
    authedPage,
  }) => {
    await authedPage.goto("/workspace/analytics");

    const main = authedPage.locator("main");
    await expect(
      main.getByRole("heading", { name: "Writer Analytics" }),
    ).toBeVisible();

    // Overview stat labels
    await expect(main.getByText("Total Submissions")).toBeVisible({
      timeout: 10_000,
    });
    await expect(main.getByText("Acceptance Rate")).toBeVisible();
    await expect(main.getByText("Avg Response Time")).toBeVisible();
  });

  test("shows date filter inputs", async ({ authedPage }) => {
    await authedPage.goto("/workspace/analytics");

    const main = authedPage.locator("main");
    await expect(main.getByLabel("From")).toBeVisible();
    // Use the specific input ID to avoid matching other "To" text on page
    await expect(main.locator("#end-date")).toBeVisible();
  });

  test("displays Status Breakdown chart", async ({ authedPage }) => {
    await authedPage.goto("/workspace/analytics");

    const main = authedPage.locator("main");
    await expect(main.getByText("Status Breakdown")).toBeVisible({
      timeout: 10_000,
    });
  });

  test("displays Submissions Over Time chart", async ({ authedPage }) => {
    await authedPage.goto("/workspace/analytics");

    const main = authedPage.locator("main");
    await expect(main.getByText("Submissions Over Time")).toBeVisible({
      timeout: 10_000,
    });
  });

  test("displays Response Time Distribution chart", async ({ authedPage }) => {
    await authedPage.goto("/workspace/analytics");

    const main = authedPage.locator("main");
    await expect(main.getByText("Response Time Distribution")).toBeVisible({
      timeout: 10_000,
    });
  });
});

test.describe("Correspondence (/workspace/correspondence)", () => {
  test("displays Correspondence heading", async ({ authedPage }) => {
    await authedPage.goto("/workspace/correspondence");

    const main = authedPage.locator("main");
    await expect(
      main.getByRole("heading", { name: "Correspondence" }),
    ).toBeVisible();
  });

  test("shows seeded correspondence item", async ({
    authedPage,
    workspaceData: _workspaceData,
  }) => {
    await authedPage.goto("/workspace/correspondence");

    const main = authedPage.locator("main");
    await expect(main.getByText("Re: Your Submission")).toBeVisible({
      timeout: 10_000,
    });
    await expect(main.getByText("Editor Smith")).toBeVisible();
  });

  test("log correspondence from detail page", async ({
    authedPage,
    workspaceData,
  }) => {
    // Navigate to external submission detail
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

    // Click Log Message
    await main.getByRole("button", { name: /Log Message/ }).click();

    // Fill the correspondence form — dialog is outside main, use page-level
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
