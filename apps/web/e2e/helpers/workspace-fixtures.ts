/**
 * Workspace-specific Playwright test fixtures.
 *
 * Uses the WRITER user (writer@example.com) — workspace features are
 * user-scoped (not org-admin-scoped like Slate).
 *
 * Provides `workspaceData` fixture with pre-created external submission
 * and correspondence for test use, with automatic cleanup in teardown.
 */

import { test as base, expect, type Page } from "@playwright/test";
import { createAuthedContext, WRITER_USER_PROFILE } from "./auth";
import { getOrgBySlug, getUserByEmail } from "./db";
import {
  createExternalSubmission,
  createCorrespondence,
  cleanupWorkspaceData,
} from "./workspace-db";

interface SeedOrg {
  id: string;
  name: string;
  slug: string;
}

interface SeedUser {
  id: string;
  email: string;
}

interface WorkspaceData {
  externalSubmission: { id: string; journalName: string; status: string };
  correspondence: { id: string };
}

export const test = base.extend<{
  seedOrg: SeedOrg;
  seedWriter: SeedUser;
  authedPage: Page;
  workspaceData: WorkspaceData;
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

  seedWriter: async ({}, use) => {
    const user = await getUserByEmail("writer@example.com");
    if (!user) {
      throw new Error(
        'Seed writer "writer@example.com" not found. Run `pnpm db:seed` first.',
      );
    }
    await use(user);
  },

  authedPage: async ({ browser, seedOrg, seedWriter, baseURL }, use) => {
    const { context, page } = await createAuthedContext(
      browser,
      baseURL ?? undefined,
      seedOrg.id,
      seedWriter.id,
      WRITER_USER_PROFILE,
    );

    await use(page);

    await context.close();
  },

  workspaceData: async ({ seedWriter }, use) => {
    const suffix = Date.now().toString(36);

    // Create external submission
    const extSub = await createExternalSubmission({
      userId: seedWriter.id,
      journalName: `E2E Test Journal ${suffix}`,
      status: "sent",
      sentAt: new Date("2025-06-01"),
      method: "Submittable",
    });

    // Create correspondence for that submission
    const corr = await createCorrespondence({
      userId: seedWriter.id,
      externalSubmissionId: extSub.id,
      direction: "inbound",
      channel: "email",
      sentAt: new Date("2025-06-15"),
      subject: "Re: Your Submission",
      body: "Thank you for your submission. We are currently reviewing it.",
      senderName: "Editor Smith",
    });

    await use({
      externalSubmission: extSub,
      correspondence: corr,
    });

    // Cleanup in reverse dependency order
    await cleanupWorkspaceData({
      correspondence: [corr.id],
      externalSubmissions: [extSub.id],
    });
  },
});

export { expect };
