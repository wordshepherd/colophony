/**
 * Forms-specific Playwright test fixtures.
 *
 * Uses the ADMIN user (editor@quarterlyreview.org) — form mutations require
 * EDITOR/ADMIN role.
 *
 * Provides `formData` fixture with a pre-created draft form and fields for
 * test use, with automatic cleanup in teardown.
 */

import { test as base, expect, type Page } from "@playwright/test";
import { createAuthedContext, ADMIN_USER_PROFILE } from "./auth";
import { getOrgBySlug, getUserByEmail } from "./db";
import {
  createFormDefinition,
  createFormField,
  deleteFormDefinition,
} from "./forms-db";

interface SeedOrg {
  id: string;
  name: string;
  slug: string;
}

interface SeedUser {
  id: string;
  email: string;
}

interface FormData {
  form: { id: string; name: string; status: string };
  fields: Array<{ id: string; fieldKey: string }>;
}

export const test = base.extend<{
  seedOrg: SeedOrg;
  seedAdmin: SeedUser;
  authedPage: Page;
  formData: FormData;
}>({
  seedOrg: async ({}, use) => {
    const org = await getOrgBySlug("quarterly-review");
    if (!org) {
      throw new Error(
        'Seed org "quarterly-review" not found. Run `pnpm db:seed` first.',
      );
    }
    await use(org);
  },

  seedAdmin: async ({}, use) => {
    const user = await getUserByEmail("editor@quarterlyreview.org");
    if (!user) {
      throw new Error(
        'Seed admin "editor@quarterlyreview.org" not found. Run `pnpm db:seed` first.',
      );
    }
    await use(user);
  },

  authedPage: async ({ browser, seedOrg, seedAdmin, baseURL }, use) => {
    const { context, page } = await createAuthedContext(
      browser,
      baseURL ?? undefined,
      seedOrg.id,
      seedAdmin.id,
      ADMIN_USER_PROFILE,
    );

    await use(page);

    await context.close();
  },

  formData: async ({ seedOrg, seedAdmin }, use) => {
    const suffix = Date.now().toString(36);

    // Create a draft form
    const form = await createFormDefinition({
      orgId: seedOrg.id,
      name: `E2E Test Form ${suffix}`,
      description: "E2E test form with sample fields",
      createdBy: seedAdmin.id,
    });

    // Add 3 fields (text, textarea, select)
    const field1 = await createFormField({
      formDefinitionId: form.id,
      fieldKey: "title",
      fieldType: "text",
      label: "Title",
      sortOrder: 0,
      required: true,
    });

    const field2 = await createFormField({
      formDefinitionId: form.id,
      fieldKey: "bio",
      fieldType: "textarea",
      label: "Author Bio",
      sortOrder: 1,
    });

    const field3 = await createFormField({
      formDefinitionId: form.id,
      fieldKey: "genre",
      fieldType: "select",
      label: "Genre",
      sortOrder: 2,
      config: {
        options: [
          { label: "Fiction", value: "fiction" },
          { label: "Poetry", value: "poetry" },
          { label: "Non-Fiction", value: "nonfiction" },
        ],
      },
    });

    await use({
      form,
      fields: [field1, field2, field3],
    });

    // Cleanup — cascade deletes fields
    await deleteFormDefinition(form.id);
  },
});

export { expect };
