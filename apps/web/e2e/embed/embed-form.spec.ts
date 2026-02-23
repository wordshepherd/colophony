import { test, expect, EMBED_TEST_EMAIL } from "../helpers/embed-fixtures";
import {
  createEmbedToken,
  deleteEmbedToken,
  deleteSubmissionsByEmail,
  deleteGuestUser,
} from "../helpers/embed-db";
import {
  getOrgBySlug,
  getUserByEmail,
  getOpenSubmissionPeriod,
} from "../helpers/db";

test.describe("Embed Form (/embed/:token)", () => {
  test("loads form and shows identity step", async ({ page, embedData }) => {
    await page.goto(`/embed/${embedData.plainToken}`);

    await expect(
      page.getByRole("heading", { name: embedData.periodName }),
    ).toBeVisible();
    await expect(page.getByLabel(/email/i)).toBeVisible();
    await expect(page.getByLabel(/name/i)).toBeVisible();
    await expect(page.getByRole("button", { name: "Continue" })).toBeVisible();
  });

  test("shows error for invalid token", async ({ page }) => {
    await page.goto("/embed/col_emb_invalidtoken00000000000000000000");

    await expect(
      page.getByRole("heading", { name: "Invalid Link" }),
    ).toBeVisible();
  });

  test("identity step requires valid email", async ({ page, embedData }) => {
    await page.goto(`/embed/${embedData.plainToken}`);

    await page.getByLabel(/email/i).fill("not-an-email");
    await page.getByRole("button", { name: "Continue" }).click();

    // Browser's native type="email" validation prevents form submission.
    // Verify the identity step is still visible (form did not proceed).
    await expect(
      page.getByRole("heading", { name: embedData.periodName }),
    ).toBeVisible();
    await expect(page.getByLabel(/email/i)).toBeVisible();
  });

  test("completes identity step and shows form fields", async ({
    page,
    embedData,
  }) => {
    await page.goto(`/embed/${embedData.plainToken}`);

    await page.getByLabel(/email/i).fill(EMBED_TEST_EMAIL);
    await page.getByRole("button", { name: "Continue" }).click();

    // Wait for form step to load
    await expect(page.getByLabel("Title *")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByLabel("Content")).toBeVisible();
    await expect(page.getByLabel("Cover Letter")).toBeVisible();
    await expect(page.getByText("Genre")).toBeVisible();
    await expect(page.getByText("Author Bio")).toBeVisible();
    await expect(page.getByRole("button", { name: "Submit" })).toBeVisible();
  });

  test("title is required on form step", async ({ page, embedData }) => {
    await page.goto(`/embed/${embedData.plainToken}`);

    // Complete identity
    await page.getByLabel(/email/i).fill(EMBED_TEST_EMAIL);
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page.getByLabel("Title *")).toBeVisible({ timeout: 10_000 });

    // Select genre (required custom field) to isolate the title validation
    await page.getByRole("combobox").click();
    await page.getByRole("option", { name: "Fiction", exact: true }).click();

    // Submit without title
    await page.getByRole("button", { name: "Submit" }).click();

    await expect(page.getByText("Title is required")).toBeVisible();
  });

  test("submits form successfully and shows success page", async ({
    page,
    embedData,
  }) => {
    await page.goto(`/embed/${embedData.plainToken}`);

    // Complete identity
    await page.getByLabel(/email/i).fill(EMBED_TEST_EMAIL);
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page.getByLabel("Title *")).toBeVisible({ timeout: 10_000 });

    // Fill form
    await page.getByLabel("Title *").fill("E2E Embed Test Submission");
    await page.getByRole("combobox").click();
    await page.getByRole("option", { name: "Fiction", exact: true }).click();

    // Submit
    await page.getByRole("button", { name: "Submit" }).click();

    // Success page
    await expect(
      page.getByRole("heading", { name: "Submission Received" }),
    ).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(embedData.periodName)).toBeVisible();
    await expect(page.getByText(/Confirmation ID/)).toBeVisible();
  });

  test("submits with minimal fields (title + required custom)", async ({
    page,
    embedData,
  }) => {
    const minimalEmail = "embed-minimal@example.com";

    await page.goto(`/embed/${embedData.plainToken}`);

    // Complete identity with unique email
    await page.getByLabel(/email/i).fill(minimalEmail);
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page.getByLabel("Title *")).toBeVisible({ timeout: 10_000 });

    // Fill only required fields
    await page.getByLabel("Title *").fill("Minimal Submission");
    await page.getByRole("combobox").click();
    await page.getByRole("option", { name: "Poetry" }).click();

    // Submit
    await page.getByRole("button", { name: "Submit" }).click();

    await expect(
      page.getByRole("heading", { name: "Submission Received" }),
    ).toBeVisible({ timeout: 15_000 });

    // Cleanup for this specific email
    await deleteSubmissionsByEmail(minimalEmail);
    await deleteGuestUser(minimalEmail);
  });

  test("shows error for expired token", async ({ page }) => {
    // Manual setup: create an expired token
    const org = await getOrgBySlug("quarterly-review");
    if (!org) throw new Error("Seed org not found");
    const user = await getUserByEmail("writer@example.com");
    if (!user) throw new Error("Seed user not found");
    const period = await getOpenSubmissionPeriod(org.id);
    if (!period) throw new Error("No open period found");

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    const token = await createEmbedToken({
      orgId: org.id,
      submissionPeriodId: period.id,
      createdBy: user.id,
      expiresAt: yesterday,
    });

    try {
      await page.goto(`/embed/${token.plainToken}`);

      await expect(
        page.getByRole("heading", { name: "Submissions Closed" }),
      ).toBeVisible();
    } finally {
      await deleteEmbedToken(token.id);
    }
  });
});
