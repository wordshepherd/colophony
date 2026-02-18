import { test, expect } from "../helpers/fixtures";
import { deleteSubmission } from "../helpers/db";

test.describe("Submission Create (/submissions/new)", () => {
  const createdIds: string[] = [];

  test.afterEach(async () => {
    // Clean up any submissions created during tests
    for (const id of createdIds) {
      await deleteSubmission(id);
    }
    createdIds.length = 0;
  });

  test("displays form with title, content, and cover letter fields", async ({
    authedPage,
  }) => {
    await authedPage.goto("/submissions/new");

    await expect(
      authedPage.getByRole("heading", { name: "New Submission" }),
    ).toBeVisible();
    await expect(authedPage.getByLabel("Title *")).toBeVisible();
    await expect(authedPage.getByLabel("Content")).toBeVisible();
    await expect(authedPage.getByLabel("Cover Letter")).toBeVisible();
  });

  test("title is required — empty submit shows validation error", async ({
    authedPage,
  }) => {
    await authedPage.goto("/submissions/new");

    // Click Create Draft without filling any fields
    await authedPage.getByRole("button", { name: "Create Draft" }).click();

    // Should show validation error
    await expect(authedPage.getByText("Title is required")).toBeVisible();
  });

  test("creates draft with title only and redirects to detail page", async ({
    authedPage,
  }) => {
    await authedPage.goto("/submissions/new");

    await authedPage.getByLabel("Title *").fill("E2E Test: Title Only Draft");
    await authedPage.getByRole("button", { name: "Create Draft" }).click();

    // Should redirect to detail page
    await expect(authedPage).toHaveURL(/\/submissions\/[a-f0-9-]+$/, {
      timeout: 10_000,
    });

    // Extract submission ID from URL for cleanup
    const url = authedPage.url();
    const id = url.split("/submissions/")[1];
    if (id) createdIds.push(id);

    // Detail page should show the title
    await expect(
      authedPage.getByRole("heading", { name: "E2E Test: Title Only Draft" }),
    ).toBeVisible();
  });

  test("creates draft with all fields and redirects to detail page", async ({
    authedPage,
  }) => {
    await authedPage.goto("/submissions/new");

    await authedPage.getByLabel("Title *").fill("E2E Test: Full Draft");
    await authedPage
      .getByLabel("Content")
      .fill("This is the content of the submission.");
    await authedPage
      .getByLabel("Cover Letter")
      .fill("Dear editors, please consider this piece.");

    await authedPage.getByRole("button", { name: "Create Draft" }).click();

    // Should redirect to detail page
    await expect(authedPage).toHaveURL(/\/submissions\/[a-f0-9-]+$/, {
      timeout: 10_000,
    });

    const url = authedPage.url();
    const id = url.split("/submissions/")[1];
    if (id) createdIds.push(id);

    await expect(
      authedPage.getByRole("heading", { name: "E2E Test: Full Draft" }),
    ).toBeVisible();
  });

  test("new submission appears in the list", async ({ authedPage }) => {
    await authedPage.goto("/submissions/new");

    const title = `E2E Test: List Check ${Date.now()}`;
    await authedPage.getByLabel("Title *").fill(title);
    await authedPage.getByRole("button", { name: "Create Draft" }).click();

    // Wait for redirect to detail page
    await expect(authedPage).toHaveURL(/\/submissions\/[a-f0-9-]+$/, {
      timeout: 10_000,
    });

    const url = authedPage.url();
    const id = url.split("/submissions/")[1];
    if (id) createdIds.push(id);

    // Navigate to list and verify the new submission appears
    await authedPage.goto("/submissions");
    await expect(authedPage.getByText(title)).toBeVisible({ timeout: 10_000 });
  });
});
