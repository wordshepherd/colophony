/**
 * Playwright test fixtures for embed form E2E tests.
 *
 * No OIDC auth needed — embed forms are public.
 * Creates form definition + embed token per test, cleans up after.
 */

import { test as base, expect } from "@playwright/test";
import { getOrgBySlug, getUserByEmail, getOpenSubmissionPeriod } from "./db";
import {
  createFormDefinition,
  createEmbedToken,
  linkFormToPeriod,
  unlinkFormFromPeriod,
  deleteFormDefinition,
  deleteEmbedToken,
  deleteSubmissionsByEmail,
  deleteGuestUser,
} from "./embed-db";

export const EMBED_TEST_EMAIL = "embed-e2e@example.com";

interface EmbedData {
  orgId: string;
  userId: string;
  periodId: string;
  periodName: string;
  formId: string;
  tokenId: string;
  plainToken: string;
}

/**
 * Extended Playwright test with embed fixtures.
 *
 * Fixtures:
 * - `embedData` — form definition + embed token linked to open period (auto-cleanup)
 */
export const test = base.extend<{ embedData: EmbedData }>({
  embedData: async ({}, use) => {
    // Look up seed data
    const org = await getOrgBySlug("quarterly-review");
    if (!org) {
      throw new Error(
        'Seed org "quarterly-review" not found. Run `pnpm db:seed` first.',
      );
    }

    const user = await getUserByEmail("writer@example.com");
    if (!user) {
      throw new Error(
        'Seed user "writer@example.com" not found. Run `pnpm db:seed` first.',
      );
    }

    const period = await getOpenSubmissionPeriod(org.id);
    if (!period) {
      throw new Error(
        "No open submission period found. Run `pnpm db:seed` first.",
      );
    }

    // Create PUBLISHED form with 2 fields (single page / flat mode)
    const form = await createFormDefinition({
      orgId: org.id,
      createdBy: user.id,
      name: "E2E Embed Test Form",
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
              { label: "Non-Fiction", value: "nonfiction" },
            ],
          },
        },
        {
          fieldKey: "bio",
          fieldType: "textarea",
          label: "Author Bio",
          required: false,
          sortOrder: 1,
        },
      ],
    });

    // Save original form linkage so teardown can restore it
    const originalFormDefinitionId = period.formDefinitionId;

    // Link form to period
    await linkFormToPeriod(period.id, form.id);

    // Create embed token
    const token = await createEmbedToken({
      orgId: org.id,
      submissionPeriodId: period.id,
      createdBy: user.id,
    });

    const embedData: EmbedData = {
      orgId: org.id,
      userId: user.id,
      periodId: period.id,
      periodName: period.name,
      formId: form.id,
      tokenId: token.id,
      plainToken: token.plainToken,
    };

    await use(embedData);

    // Teardown: clean up in reverse dependency order
    await deleteSubmissionsByEmail(EMBED_TEST_EMAIL);
    await deleteGuestUser(EMBED_TEST_EMAIL);
    // Restore original form linkage (may have been null or a different form)
    if (originalFormDefinitionId) {
      await linkFormToPeriod(period.id, originalFormDefinitionId);
    } else {
      await unlinkFormFromPeriod(period.id);
    }
    await deleteEmbedToken(token.id);
    await deleteFormDefinition(form.id);
  },
});

export { expect };
