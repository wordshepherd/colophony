import { test, expect } from "../helpers/fixtures";
import {
  createSubmission,
  deleteSubmission,
  getOpenSubmissionPeriod,
} from "../helpers/db";

test.describe("Submission Detail & Edit", () => {
  let draftId: string;
  let submitFlowId: string;
  let submitTestId: string;
  let deleteTestId: string;

  test.beforeAll(async () => {
    // We need seed org/user IDs — look them up directly
    const { getOrgBySlug, getUserByEmail } = await import("../helpers/db");
    const org = await getOrgBySlug("quarterly-review");
    const user = await getUserByEmail("writer@example.com");
    if (!org || !user) throw new Error("Seed data not found");

    const period = await getOpenSubmissionPeriod(org.id);

    // Create test submissions for this describe block
    const draft = await createSubmission({
      orgId: org.id,
      submitterId: user.id,
      submissionPeriodId: period?.id,
      title: "E2E Detail: View Test",
      content: "Content for the detail view test.",
      coverLetter: "Cover letter for editors.",
    });
    draftId = draft.id;

    // DRAFT submission for the "Submit for Review" transition test
    const submitFlow = await createSubmission({
      orgId: org.id,
      submitterId: user.id,
      submissionPeriodId: period?.id,
      title: "E2E Detail: Submit Flow",
      content: "Content for the submit flow test.",
    });
    submitFlowId = submitFlow.id;

    // Pre-SUBMITTED submission for Withdraw tests (avoids inter-test dependency)
    const submitTest = await createSubmission({
      orgId: org.id,
      submitterId: user.id,
      submissionPeriodId: period?.id,
      title: "E2E Detail: Withdraw Test",
      content: "Content for the withdraw test.",
      status: "SUBMITTED",
    });
    submitTestId = submitTest.id;

    const deleteTest = await createSubmission({
      orgId: org.id,
      submitterId: user.id,
      submissionPeriodId: period?.id,
      title: "E2E Detail: Delete Test",
    });
    deleteTestId = deleteTest.id;
  });

  test.afterAll(async () => {
    // Clean up — ignore errors if already deleted by tests
    await deleteSubmission(draftId).catch(() => {});
    await deleteSubmission(submitFlowId).catch(() => {});
    await deleteSubmission(submitTestId).catch(() => {});
    await deleteSubmission(deleteTestId).catch(() => {});
  });

  test("displays submission title and DRAFT status badge", async ({
    authedPage,
  }) => {
    await authedPage.goto(`/submissions/${draftId}`);

    await expect(
      authedPage.getByRole("heading", { name: "E2E Detail: View Test" }),
    ).toBeVisible({ timeout: 10_000 });

    // Status badge should show Draft (exact match to avoid colliding with
    // "DRAFT" in history badges)
    await expect(authedPage.getByText("Draft", { exact: true })).toBeVisible();
  });

  test("shows Edit and Delete buttons for DRAFT submission", async ({
    authedPage,
  }) => {
    await authedPage.goto(`/submissions/${draftId}`);

    await expect(
      authedPage.getByRole("heading", { name: "E2E Detail: View Test" }),
    ).toBeVisible({ timeout: 10_000 });

    // Edit/Delete depend on user profile loading (isOwner check)
    await expect(authedPage.getByRole("link", { name: /Edit/ })).toBeVisible({
      timeout: 10_000,
    });
    await expect(
      authedPage.getByRole("button", { name: /Delete/ }),
    ).toBeVisible();
  });

  test("edit page loads with pre-filled form fields", async ({
    authedPage,
  }) => {
    await authedPage.goto(`/submissions/${draftId}/edit`);

    // Wait for form to load with existing data
    await expect(authedPage.getByLabel("Title *")).toHaveValue(
      "E2E Detail: View Test",
      { timeout: 10_000 },
    );
    await expect(authedPage.getByLabel("Content")).toHaveValue(
      "Content for the detail view test.",
    );
    await expect(authedPage.getByLabel("Cover Letter")).toHaveValue(
      "Cover letter for editors.",
    );
  });

  test("save draft changes updates the title", async ({ authedPage }) => {
    await authedPage.goto(`/submissions/${draftId}/edit`);

    // Wait for form to load
    await expect(authedPage.getByLabel("Title *")).toHaveValue(
      "E2E Detail: View Test",
      { timeout: 10_000 },
    );

    // Update the title
    await authedPage.getByLabel("Title *").clear();
    await authedPage
      .getByLabel("Title *")
      .fill("E2E Detail: View Test (Updated)");
    await authedPage.getByRole("button", { name: "Save Draft" }).click();

    // Should show success toast
    await expect(authedPage.getByText("Submission saved")).toBeVisible({
      timeout: 5_000,
    });

    // Navigate to detail page and verify updated title
    await authedPage.goto(`/submissions/${draftId}`);
    await expect(
      authedPage.getByRole("heading", {
        name: "E2E Detail: View Test (Updated)",
      }),
    ).toBeVisible({ timeout: 10_000 });
  });

  test("Submit for Review transitions DRAFT to SUBMITTED", async ({
    authedPage,
  }) => {
    await authedPage.goto(`/submissions/${submitFlowId}/edit`);

    // Wait for form to load
    await expect(authedPage.getByLabel("Title *")).toHaveValue(
      "E2E Detail: Submit Flow",
      { timeout: 10_000 },
    );

    // Click Submit for Review
    await authedPage.getByRole("button", { name: "Submit for Review" }).click();

    // Should redirect to detail page
    await expect(authedPage).toHaveURL(
      new RegExp(`/submissions/${submitFlowId}$`),
      { timeout: 10_000 },
    );

    // Reload to bust TanStack Query cache (staleTime=60s means the detail
    // page may show cached DRAFT data after client-side navigation)
    await authedPage.reload();

    // Status badge should now show "Submitted" (exact match avoids
    // colliding with "SUBMITTED" in the history badges)
    await expect(
      authedPage.getByText("Submitted", { exact: true }),
    ).toBeVisible({ timeout: 10_000 });
  });

  test("SUBMITTED submission shows Withdraw button, no Edit button", async ({
    authedPage,
  }) => {
    // submitTestId is created as SUBMITTED in beforeAll (no inter-test dependency)
    await authedPage.goto(`/submissions/${submitTestId}`);

    await expect(
      authedPage.getByRole("heading", { name: "E2E Detail: Withdraw Test" }),
    ).toBeVisible({ timeout: 10_000 });

    // Withdraw should be visible (depends on user profile loading via
    // users.me query — may take longer than default 5s in CI)
    await expect(
      authedPage.getByRole("button", { name: "Withdraw" }),
    ).toBeVisible({ timeout: 10_000 });
    await expect(
      authedPage.getByRole("link", { name: /Edit/ }),
    ).not.toBeVisible();
  });

  test("withdraw dialog changes status to WITHDRAWN", async ({
    authedPage,
  }) => {
    await authedPage.goto(`/submissions/${submitTestId}`);

    await expect(
      authedPage.getByRole("heading", { name: "E2E Detail: Withdraw Test" }),
    ).toBeVisible({ timeout: 10_000 });

    // Wait for user profile + network to settle (users.me, listReviewers, getHistory etc.)
    await expect(
      authedPage.getByRole("button", { name: "Withdraw" }),
    ).toBeVisible({ timeout: 10_000 });

    // Click Withdraw
    await authedPage.getByRole("button", { name: "Withdraw" }).click();

    // Confirmation dialog should appear
    await expect(authedPage.getByText("Withdraw submission?")).toBeVisible();

    // Confirm withdrawal
    await authedPage.getByRole("button", { name: "Withdraw" }).last().click();

    // Should show success toast
    await expect(authedPage.getByText("Submission withdrawn")).toBeVisible({
      timeout: 5_000,
    });

    // Status badge should now show "Withdrawn" (exact match to avoid
    // colliding with "WITHDRAWN" in history badges)
    await expect(
      authedPage.getByText("Withdrawn", { exact: true }),
    ).toBeVisible({ timeout: 5_000 });
  });

  test("delete confirmation dialog deletes the submission", async ({
    authedPage,
  }) => {
    await authedPage.goto(`/submissions/${deleteTestId}`);

    await expect(
      authedPage.getByRole("heading", { name: "E2E Detail: Delete Test" }),
    ).toBeVisible({ timeout: 10_000 });

    // Wait for Delete button (depends on user profile loading for isOwner check)
    await expect(
      authedPage.getByRole("button", { name: /Delete/ }),
    ).toBeVisible({ timeout: 10_000 });
    await authedPage.getByRole("button", { name: /Delete/ }).click();

    // Confirmation dialog should appear
    await expect(authedPage.getByText("Delete submission?")).toBeVisible();

    // Confirm deletion
    await authedPage
      .getByRole("button", { name: /Delete/ })
      .last()
      .click();

    // Should redirect to submissions list
    await expect(authedPage).toHaveURL(/\/submissions$/, {
      timeout: 10_000,
    });
  });
});
