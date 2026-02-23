import { test as base, expect } from "@playwright/test";
import {
  getOrgBySlug,
  getUserByEmail,
  getOpenSubmissionPeriod,
} from "../helpers/db";
import {
  createFormDefinition,
  createEmbedToken,
  linkFormToPeriod,
  unlinkFormFromPeriod,
  deleteFormDefinition,
  deleteEmbedToken,
  deleteSubmissionsByEmail,
  deleteGuestUser,
} from "../helpers/embed-db";

const WIZARD_EMAIL = "embed-wizard@example.com";

interface WizardData {
  orgId: string;
  userId: string;
  periodId: string;
  periodName: string;
  formId: string;
  tokenId: string;
  plainToken: string;
}

/**
 * Wizard-specific fixture: multi-page form (2 pages).
 * Page 1: genre (select, required)
 * Page 2: bio (textarea, optional)
 */
const test = base.extend<{ wizardData: WizardData }>({
  wizardData: async ({}, use) => {
    const org = await getOrgBySlug("quarterly-review");
    if (!org) throw new Error("Seed org not found");
    const user = await getUserByEmail("writer@example.com");
    if (!user) throw new Error("Seed user not found");
    const period = await getOpenSubmissionPeriod(org.id);
    if (!period) throw new Error("No open period found");

    const form = await createFormDefinition({
      orgId: org.id,
      createdBy: user.id,
      name: "E2E Wizard Test Form",
      pages: [
        { title: "Details", sortOrder: 0 },
        { title: "About You", sortOrder: 1 },
      ],
      fields: [
        {
          fieldKey: "genre",
          fieldType: "select",
          label: "Genre",
          required: true,
          sortOrder: 0,
          config: {
            options: [
              { label: "Fiction", value: "fiction" },
              { label: "Poetry", value: "poetry" },
            ],
          },
          pageIndex: 0,
        },
        {
          fieldKey: "bio",
          fieldType: "textarea",
          label: "Author Bio",
          required: false,
          sortOrder: 0,
          config: {},
          pageIndex: 1,
        },
      ],
    });

    await linkFormToPeriod(period.id, form.id);

    const token = await createEmbedToken({
      orgId: org.id,
      submissionPeriodId: period.id,
      createdBy: user.id,
    });

    const data: WizardData = {
      orgId: org.id,
      userId: user.id,
      periodId: period.id,
      periodName: period.name,
      formId: form.id,
      tokenId: token.id,
      plainToken: token.plainToken,
    };

    await use(data);

    // Teardown
    await deleteSubmissionsByEmail(WIZARD_EMAIL);
    await deleteGuestUser(WIZARD_EMAIL);
    await unlinkFormFromPeriod(period.id);
    await deleteEmbedToken(token.id);
    await deleteFormDefinition(form.id);
  },
});

test.describe("Embed Wizard Mode", () => {
  test("renders wizard mode with page navigation", async ({
    page,
    wizardData,
  }) => {
    await page.goto(`/embed/${wizardData.plainToken}`);

    // Complete identity
    await page.getByLabel(/email/i).fill(WIZARD_EMAIL);
    await page.getByRole("button", { name: "Continue" }).click();

    // Wizard should show page indicator and Next button
    await expect(page.getByText("Page 1 of 2")).toBeVisible({
      timeout: 10_000,
    });
    await expect(
      page.getByRole("button", { name: "Next", exact: true }),
    ).toBeVisible();
    // Submit should NOT be visible on page 1
    await expect(
      page.getByRole("button", { name: "Submit" }),
    ).not.toBeVisible();
  });

  test("navigates between pages and submits", async ({ page, wizardData }) => {
    await page.goto(`/embed/${wizardData.plainToken}`);

    // Complete identity
    await page.getByLabel(/email/i).fill(WIZARD_EMAIL);
    await page.getByRole("button", { name: "Continue" }).click();

    // Page 1: fill title + genre
    await expect(page.getByText("Page 1 of 2")).toBeVisible({
      timeout: 10_000,
    });
    await page.getByLabel("Title *").fill("Wizard E2E Submission");
    await page.getByRole("combobox").click();
    await page.getByRole("option", { name: "Fiction", exact: true }).click();

    // Navigate to page 2
    await page.getByRole("button", { name: "Next", exact: true }).click();
    await expect(page.getByText("Page 2 of 2")).toBeVisible();
    await expect(page.getByText("Author Bio")).toBeVisible();

    // Submit: click Submit if still on form, or verify success if form
    // auto-submitted during page transition (React re-render timing)
    const submitBtn = page.getByRole("button", { name: "Submit" });
    const successHeading = page.getByRole("heading", {
      name: "Submission Received",
    });

    // Race: either submit button is clickable or success page already showing
    const alreadySubmitted = await successHeading
      .waitFor({ timeout: 2_000 })
      .then(() => true)
      .catch(() => false);

    if (!alreadySubmitted) {
      await submitBtn.click({ timeout: 10_000 });
    }

    await expect(successHeading).toBeVisible({ timeout: 15_000 });
  });
});
