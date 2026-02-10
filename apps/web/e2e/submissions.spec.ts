import { test, expect } from "@playwright/test";
import {
  createSubmission as apiCreateSubmission,
  submitSubmission,
} from "./helpers/api-client";
import { loginAsBrowser, setupTestUser } from "./helpers/auth";
import { deleteOrg, deleteUser, disconnectDb } from "./helpers/db";

test.describe("Submissions", () => {
  const cleanup: Array<{ orgId?: string; userId?: string }> = [];

  test.afterEach(async ({ page }) => {
    await page.evaluate(() => localStorage.clear());
  });

  test.afterAll(async () => {
    for (const item of cleanup) {
      if (item.orgId) await deleteOrg(item.orgId);
      if (item.userId) await deleteUser(item.userId);
    }
    await disconnectDb();
  });

  test("navigate to /submissions/new shows create form", async ({ page }) => {
    const user = await setupTestUser("ADMIN");
    cleanup.push({ orgId: user.orgId, userId: user.userId });

    await loginAsBrowser(page, user.tokens, user.orgId);
    await page.goto("/submissions/new");

    await expect(
      page.getByRole("heading", { name: "New Submission" }),
    ).toBeVisible({
      timeout: 10_000,
    });
    await expect(page.getByLabel("Title *")).toBeVisible();
    await expect(page.getByLabel("Content")).toBeVisible();
    await expect(page.getByLabel("Cover Letter")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Create Draft" }),
    ).toBeVisible();
  });

  test("create submission redirects to detail page", async ({ page }) => {
    const user = await setupTestUser("ADMIN");
    cleanup.push({ orgId: user.orgId, userId: user.userId });

    await loginAsBrowser(page, user.tokens, user.orgId);
    await page.goto("/submissions/new");

    const title = `E2E Test Submission ${Date.now()}`;
    await page.getByLabel("Title *").fill(title);
    await page
      .getByLabel("Content")
      .fill("This is test content for the E2E submission.");
    await page.getByRole("button", { name: "Create Draft" }).click();

    // Should redirect to submission detail page
    await page.waitForURL("**/submissions/**", { timeout: 10_000 });
    await expect(page.getByText(title)).toBeVisible({ timeout: 10_000 });
    // Detail page shows status badge
    await expect(page.getByText("DRAFT", { exact: true })).toBeVisible();
  });

  test("edit submission form is pre-filled and save works", async ({
    page,
  }) => {
    const user = await setupTestUser("ADMIN");
    cleanup.push({ orgId: user.orgId, userId: user.userId });

    // Create submission via API
    const title = `E2E Edit Test ${Date.now()}`;
    const sub = await apiCreateSubmission(user.tokens.accessToken, user.orgId, {
      title,
      content: "Original content",
    });

    await loginAsBrowser(page, user.tokens, user.orgId);
    await page.goto(`/submissions/${sub.id}/edit`);

    // Form should be pre-filled
    await expect(page.getByLabel("Title *")).toHaveValue(title, {
      timeout: 10_000,
    });
    await expect(page.getByLabel("Content")).toHaveValue("Original content");

    // Edit and save
    const updatedTitle = `${title} (Updated)`;
    await page.getByLabel("Title *").clear();
    await page.getByLabel("Title *").fill(updatedTitle);
    await page.getByRole("button", { name: "Save Draft" }).click();

    // Toast should appear
    await expect(page.getByText("Submission saved")).toBeVisible({
      timeout: 10_000,
    });
  });

  test("submission list shows cards with status badges", async ({ page }) => {
    const user = await setupTestUser("ADMIN");
    cleanup.push({ orgId: user.orgId, userId: user.userId });

    // Create a submission via API
    const title = `E2E List Card ${Date.now()}`;
    await apiCreateSubmission(user.tokens.accessToken, user.orgId, {
      title,
      content: "List test content",
    });

    await loginAsBrowser(page, user.tokens, user.orgId);
    await page.goto("/submissions");

    // Should show the submission card
    await expect(
      page.getByRole("heading", { name: "My Submissions" }),
    ).toBeVisible({
      timeout: 10_000,
    });
    await expect(page.getByText(title)).toBeVisible({ timeout: 10_000 });
    // Draft badge should be visible
    await expect(page.getByText("DRAFT").first()).toBeVisible();
  });

  test("filter submissions by status updates list", async ({ page }) => {
    const user = await setupTestUser("ADMIN");
    cleanup.push({ orgId: user.orgId, userId: user.userId });

    // Create a draft submission
    const draftTitle = `E2E Draft ${Date.now()}`;
    await apiCreateSubmission(user.tokens.accessToken, user.orgId, {
      title: draftTitle,
    });

    // Create and submit another submission
    const submittedTitle = `E2E Submitted ${Date.now()}`;
    const sub = await apiCreateSubmission(user.tokens.accessToken, user.orgId, {
      title: submittedTitle,
    });
    await submitSubmission(user.tokens.accessToken, user.orgId, sub.id);

    await loginAsBrowser(page, user.tokens, user.orgId);
    await page.goto("/submissions");

    // "All" tab should show both
    await expect(page.getByText(draftTitle)).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(submittedTitle)).toBeVisible();

    // Click "Drafts" tab
    await page.getByRole("tab", { name: "Drafts" }).click();
    await expect(page.getByText(draftTitle)).toBeVisible({ timeout: 5_000 });
    // Submitted one should not be visible when filtering by Draft
    await expect(page.getByText(submittedTitle)).not.toBeVisible();

    // Click "Submitted" tab
    await page.getByRole("tab", { name: "Submitted" }).click();
    await expect(page.getByText(submittedTitle)).toBeVisible({
      timeout: 5_000,
    });
    await expect(page.getByText(draftTitle)).not.toBeVisible();
  });

  test("submit for review changes status", async ({ page }) => {
    const user = await setupTestUser("ADMIN");
    cleanup.push({ orgId: user.orgId, userId: user.userId });

    // Create submission via API
    const title = `E2E Submit Review ${Date.now()}`;
    const sub = await apiCreateSubmission(user.tokens.accessToken, user.orgId, {
      title,
    });

    await loginAsBrowser(page, user.tokens, user.orgId);
    await page.goto(`/submissions/${sub.id}/edit`);

    // Wait for form to load
    await expect(page.getByLabel("Title *")).toHaveValue(title, {
      timeout: 10_000,
    });

    // Click "Submit for Review"
    await page.getByRole("button", { name: "Submit for Review" }).click();

    // Should redirect to detail page with updated status
    await page.waitForURL(`**/submissions/${sub.id}`, { timeout: 10_000 });
    await expect(page.getByText("SUBMITTED")).toBeVisible({ timeout: 10_000 });
  });

  test("cannot edit non-draft submission shows alert", async ({ page }) => {
    const user = await setupTestUser("ADMIN");
    cleanup.push({ orgId: user.orgId, userId: user.userId });

    // Create and submit a submission via API
    const title = `E2E Non-Draft Edit ${Date.now()}`;
    const sub = await apiCreateSubmission(user.tokens.accessToken, user.orgId, {
      title,
    });
    await submitSubmission(user.tokens.accessToken, user.orgId, sub.id);

    await loginAsBrowser(page, user.tokens, user.orgId);
    await page.goto(`/submissions/${sub.id}/edit`);

    // Should show alert that submission cannot be edited
    await expect(
      page.getByText("cannot be edited because it has already been submitted"),
    ).toBeVisible({ timeout: 10_000 });
  });
});
