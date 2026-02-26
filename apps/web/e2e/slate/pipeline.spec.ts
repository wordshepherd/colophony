import { test, expect } from "../helpers/slate-fixtures";
import { createSubmission, deleteSubmission } from "../helpers/db";
import { createPipelineItem, deletePipelineItem } from "../helpers/slate-db";

test.describe("Pipeline (/slate/pipeline)", () => {
  test("displays heading and stage filter", async ({ authedPage }) => {
    await authedPage.goto("/slate/pipeline");

    await expect(
      authedPage.getByRole("heading", { name: "Pipeline" }),
    ).toBeVisible();
    await expect(authedPage.getByRole("tab", { name: "All" })).toBeVisible();
    await expect(
      authedPage.getByRole("tab", { name: "Pending" }),
    ).toBeVisible();
    await expect(
      authedPage.getByRole("tab", { name: "Copyediting" }),
    ).toBeVisible();
  });

  test("shows pipeline item in list", async ({ authedPage, slateData }) => {
    await authedPage.goto("/slate/pipeline");

    // Pipeline list shows submission title (falls back to truncated ID if missing)
    await expect(
      authedPage.getByText(slateData.acceptedSubmission.title!),
    ).toBeVisible({
      timeout: 10_000,
    });
  });

  test("filters by stage tab", async ({ authedPage, slateData }) => {
    await authedPage.goto("/slate/pipeline");

    const subTitle = slateData.acceptedSubmission.title!;

    // Wait for data to load
    await expect(authedPage.getByText(subTitle)).toBeVisible({
      timeout: 10_000,
    });

    // Pending tab — seed item is COPYEDIT_PENDING, should be visible
    await authedPage.getByRole("tab", { name: "Pending" }).click();
    await expect(authedPage.getByText(subTitle)).toBeVisible();

    // Published tab — should show empty state
    await authedPage.getByRole("tab", { name: "Published" }).click();
    await expect(authedPage.getByText("No pipeline items")).toBeVisible();
  });

  test("navigates to detail page", async ({ authedPage, slateData }) => {
    await authedPage.goto("/slate/pipeline");

    const subTitle = slateData.acceptedSubmission.title!;
    await expect(authedPage.getByText(subTitle)).toBeVisible({
      timeout: 10_000,
    });

    // Click the pipeline item link
    await authedPage.getByText(subTitle).first().click();

    await expect(authedPage).toHaveURL(
      new RegExp(`/slate/pipeline/${slateData.pipelineItem.id}`),
    );
    await expect(
      authedPage.getByRole("heading", { name: "Pipeline Item" }),
    ).toBeVisible({ timeout: 10_000 });
    // "Copyedit Pending" appears in both the badge and metadata — use first()
    await expect(
      authedPage.getByText("Copyedit Pending").first(),
    ).toBeVisible();
  });

  test("detail shows stage transition buttons", async ({
    authedPage,
    slateData,
  }) => {
    await authedPage.goto(`/slate/pipeline/${slateData.pipelineItem.id}`);

    // CardTitle renders as <div>, not <h2> — use getByText
    await expect(authedPage.getByText("Stage Transition")).toBeVisible({
      timeout: 10_000,
    });

    // COPYEDIT_PENDING can transition to COPYEDIT_IN_PROGRESS or WITHDRAWN
    await expect(
      authedPage.getByRole("button", { name: "Copyediting" }),
    ).toBeVisible();
    await expect(
      authedPage.getByRole("button", { name: "Withdrawn" }),
    ).toBeVisible();
  });

  test("transitions to next stage", async ({
    authedPage,
    seedOrg,
    seedAdmin,
  }) => {
    // Create isolated entities to avoid mutating shared slateData
    const suffix = Date.now().toString(36);
    const submission = await createSubmission({
      orgId: seedOrg.id,
      submitterId: seedAdmin.id,
      title: `E2E Transition Sub ${suffix}`,
      status: "ACCEPTED",
    });
    const pipelineItem = await createPipelineItem({
      orgId: seedOrg.id,
      submissionId: submission.id,
      stage: "COPYEDIT_PENDING",
    });

    try {
      await authedPage.goto(`/slate/pipeline/${pipelineItem.id}`);

      // CardTitle renders as <div>, not <h2> — use getByText
      await expect(authedPage.getByText("Stage Transition")).toBeVisible({
        timeout: 10_000,
      });

      // Click "Copyediting" transition button
      await authedPage.getByRole("button", { name: "Copyediting" }).click();

      // Confirm dialog
      await expect(
        authedPage.getByText("Confirm stage transition"),
      ).toBeVisible();
      await authedPage.getByRole("button", { name: "Confirm" }).click();

      // Should now show "Copyediting" badge
      await expect(authedPage.getByText("Stage updated")).toBeVisible({
        timeout: 5_000,
      });
    } finally {
      await deletePipelineItem(pipelineItem.id);
      await deleteSubmission(submission.id);
    }
  });

  test("detail shows comments section", async ({ authedPage, slateData }) => {
    await authedPage.goto(`/slate/pipeline/${slateData.pipelineItem.id}`);

    // CardTitle renders as <div>, not <h2> — use getByText with exact match
    // ("Comments" substring also matches "No comments yet.")
    await expect(authedPage.getByText("Comments", { exact: true })).toBeVisible(
      { timeout: 10_000 },
    );

    // Should show empty state or the comment input
    await expect(authedPage.getByPlaceholder("Add a comment...")).toBeVisible();
  });

  test("adds comment to pipeline item", async ({ authedPage, slateData }) => {
    await authedPage.goto(`/slate/pipeline/${slateData.pipelineItem.id}`);

    await expect(authedPage.getByPlaceholder("Add a comment...")).toBeVisible({
      timeout: 10_000,
    });

    const commentText = `E2E test comment ${Date.now()}`;
    await authedPage.getByPlaceholder("Add a comment...").fill(commentText);
    await authedPage.getByRole("button", { name: "Add Comment" }).click();

    // Comment should appear in list
    await expect(authedPage.getByText(commentText)).toBeVisible({
      timeout: 5_000,
    });
  });
});
