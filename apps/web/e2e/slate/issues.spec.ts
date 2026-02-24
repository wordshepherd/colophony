import { test, expect } from "../helpers/slate-fixtures";
import { createSubmission, deleteSubmission } from "../helpers/db";
import {
  createPipelineItem,
  createIssue,
  createIssueItem,
  deleteIssue,
  deletePipelineItem,
} from "../helpers/slate-db";

test.describe("Issues (/slate/issues)", () => {
  test("displays heading and New Issue button", async ({ authedPage }) => {
    await authedPage.goto("/slate/issues");

    await expect(
      authedPage.getByRole("heading", { name: "Issues" }),
    ).toBeVisible();
    await expect(
      authedPage.getByRole("link", { name: "New Issue" }),
    ).toBeVisible();
  });

  test("shows seed issue in list", async ({ authedPage, slateData }) => {
    await authedPage.goto("/slate/issues");

    await expect(authedPage.getByText(slateData.issue.title)).toBeVisible({
      timeout: 10_000,
    });
  });

  test("creates new issue via form", async ({ authedPage, slateData }) => {
    const suffix = Date.now().toString(36);
    const issueTitle = `E2E Created Issue ${suffix}`;
    let createdId: string | undefined;

    try {
      await authedPage.goto("/slate/issues/new");

      await expect(
        authedPage.getByRole("heading", { name: "New Issue" }),
      ).toBeVisible();

      // Select publication — use combobox role to avoid matching "Publication Date"
      await authedPage.getByRole("combobox", { name: "Publication" }).click();
      await authedPage
        .getByRole("option", { name: slateData.publication.name })
        .click();

      await authedPage.getByLabel("Title").fill(issueTitle);
      await authedPage.getByLabel("Volume").fill("2");
      await authedPage.getByLabel("Issue Number").fill("3");

      await authedPage.getByRole("button", { name: "Create Issue" }).click();

      // Should redirect to detail page
      await expect(authedPage).toHaveURL(/\/slate\/issues\//, {
        timeout: 10_000,
      });
      await expect(authedPage.getByText(issueTitle)).toBeVisible();

      // Extract ID for cleanup
      const url = authedPage.url();
      const match = url.match(/\/slate\/issues\/([0-9a-f-]+)/);
      createdId = match?.[1];
    } finally {
      if (createdId) {
        await deleteIssue(createdId);
      }
    }
  });

  test("navigates to detail with overview", async ({
    authedPage,
    slateData,
  }) => {
    await authedPage.goto("/slate/issues");

    await expect(authedPage.getByText(slateData.issue.title)).toBeVisible({
      timeout: 10_000,
    });

    await authedPage.getByRole("link", { name: slateData.issue.title }).click();

    await expect(authedPage).toHaveURL(
      new RegExp(`/slate/issues/${slateData.issue.id}`),
    );
    await expect(
      authedPage.getByRole("heading", { name: slateData.issue.title }),
    ).toBeVisible({ timeout: 10_000 });
    // "Planning" appears in both status badge and metadata — use first()
    await expect(authedPage.getByText("Planning").first()).toBeVisible();
  });

  test("detail shows Assembly tab with section", async ({
    authedPage,
    slateData,
  }) => {
    await authedPage.goto(`/slate/issues/${slateData.issue.id}`);

    await expect(
      authedPage.getByRole("heading", { name: slateData.issue.title }),
    ).toBeVisible({ timeout: 10_000 });

    // Click Assembly tab
    await authedPage.getByRole("tab", { name: "Assembly" }).click();

    // Section header should be visible
    await expect(
      authedPage.getByText(slateData.issueSection.title),
    ).toBeVisible();
  });

  test("adds item to issue via Add Items dialog", async ({
    authedPage,
    seedOrg,
    seedAdmin,
    slateData,
  }) => {
    // Create separate issue + pipeline item to avoid uniqueness conflict
    const suffix = Date.now().toString(36);
    const extraSub = await createSubmission({
      orgId: seedOrg.id,
      submitterId: seedAdmin.id,
      title: `E2E AddItem Sub ${suffix}`,
      status: "ACCEPTED",
    });
    const extraPipeline = await createPipelineItem({
      orgId: seedOrg.id,
      submissionId: extraSub.id,
      publicationId: slateData.publication.id,
      stage: "READY_TO_PUBLISH",
    });
    const extraIssue = await createIssue({
      orgId: seedOrg.id,
      publicationId: slateData.publication.id,
      title: `E2E Assembly Issue ${suffix}`,
      status: "ASSEMBLING",
    });

    try {
      await authedPage.goto(`/slate/issues/${extraIssue.id}`);

      await expect(
        authedPage.getByRole("heading", { name: extraIssue.title }),
      ).toBeVisible({ timeout: 10_000 });

      // Go to Assembly tab
      await authedPage.getByRole("tab", { name: "Assembly" }).click();

      // Click Add Items button
      await authedPage.getByRole("button", { name: "Add Items" }).click();

      // Dialog should open
      await expect(
        authedPage.getByRole("heading", { name: "Add Pipeline Item" }),
      ).toBeVisible();

      // Dialog table shows submissionId (first 8 chars)
      const truncatedSubId = extraSub.id.slice(0, 8);
      await authedPage.getByText(truncatedSubId).click();

      // Click "Add Item" button in dialog
      await authedPage.getByRole("button", { name: "Add Item" }).click();

      // Assembly list shows pipelineItemId (first 8 chars), not submissionId
      const truncatedPipelineId = extraPipeline.id.slice(0, 8);
      await expect(authedPage.getByText(truncatedPipelineId)).toBeVisible({
        timeout: 5_000,
      });
    } finally {
      // Cleanup: issue items cascade with issue delete
      await deleteIssue(extraIssue.id);
      await deletePipelineItem(extraPipeline.id);
      await deleteSubmission(extraSub.id);
    }
  });

  test("removes item from issue assembly", async ({
    authedPage,
    seedOrg,
    seedAdmin,
    slateData,
  }) => {
    // Create separate entities
    const suffix = Date.now().toString(36);
    const extraSub = await createSubmission({
      orgId: seedOrg.id,
      submitterId: seedAdmin.id,
      title: `E2E RemoveItem Sub ${suffix}`,
      status: "ACCEPTED",
    });
    const extraPipeline = await createPipelineItem({
      orgId: seedOrg.id,
      submissionId: extraSub.id,
      publicationId: slateData.publication.id,
      stage: "READY_TO_PUBLISH",
    });
    const extraIssue = await createIssue({
      orgId: seedOrg.id,
      publicationId: slateData.publication.id,
      title: `E2E Remove Issue ${suffix}`,
      status: "ASSEMBLING",
    });
    await createIssueItem({
      issueId: extraIssue.id,
      pipelineItemId: extraPipeline.id,
    });

    try {
      await authedPage.goto(`/slate/issues/${extraIssue.id}`);

      await expect(
        authedPage.getByRole("heading", { name: extraIssue.title }),
      ).toBeVisible({ timeout: 10_000 });

      // Go to Assembly tab
      await authedPage.getByRole("tab", { name: "Assembly" }).click();

      // Assembly list shows pipelineItemId (first 8 chars), not submissionId
      const truncatedPipelineId = extraPipeline.id.slice(0, 8);
      await expect(authedPage.getByText(truncatedPipelineId)).toBeVisible({
        timeout: 5_000,
      });

      // Click remove button (aria-label="Remove item" on the Trash2 icon button)
      await authedPage.getByRole("button", { name: "Remove item" }).click();

      // Item should be removed
      await expect(authedPage.getByText(truncatedPipelineId)).not.toBeVisible({
        timeout: 10_000,
      });
    } finally {
      await deleteIssue(extraIssue.id);
      await deletePipelineItem(extraPipeline.id);
      await deleteSubmission(extraSub.id);
    }
  });
});
