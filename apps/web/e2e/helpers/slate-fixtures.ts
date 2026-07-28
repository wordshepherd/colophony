/**
 * Slate-specific Playwright test fixtures.
 *
 * Uses the ADMIN user (editor@quarterlyreview.org) instead of the READER
 * user (writer@example.com) from base fixtures — Slate mutations require
 * admin access.
 *
 * Provides `slateData` fixture with pre-created Slate entities for test use,
 * with automatic cleanup in teardown.
 */

import { test as base, expect, type Page } from "@playwright/test";
import { createAuthedContext, ADMIN_USER_PROFILE } from "./auth";
import {
  getOrgBySlug,
  getUserByEmail,
  createSubmission,
  deleteSubmission,
} from "./db";
import {
  createPublication,
  createPipelineItem,
  createContractTemplate,
  createIssue,
  createIssueSection,
  createCmsConnection,
  cleanupSlateData,
} from "./slate-db";

interface SeedOrg {
  id: string;
  name: string;
  slug: string;
}

interface SeedUser {
  id: string;
  email: string;
}

interface SlateData {
  publication: { id: string; name: string; slug: string };
  acceptedSubmission: { id: string; title: string | null };
  pipelineItem: { id: string };
  contractTemplate: { id: string; name: string };
  issue: { id: string; title: string };
  issueSection: { id: string; title: string };
  cmsConnection: { id: string; name: string };
}

export const test = base.extend<{
  seedOrg: SeedOrg;
  seedAdmin: SeedUser;
  authedPage: Page;
  slateData: SlateData;
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

  slateData: async ({ seedOrg, seedAdmin }, use) => {
    const suffix = Date.now().toString(36);

    // Create publication
    const publication = await createPublication({
      orgId: seedOrg.id,
      name: `E2E Test Review ${suffix}`,
      slug: `e2e-test-review-${suffix}`,
      description: "E2E test publication",
    });

    // Create an ACCEPTED submission for pipeline
    const acceptedSubmission = await createSubmission({
      orgId: seedOrg.id,
      submitterId: seedAdmin.id,
      title: `E2E Pipeline Submission ${suffix}`,
      status: "ACCEPTED",
    });

    // Create pipeline item
    const pipelineItem = await createPipelineItem({
      orgId: seedOrg.id,
      submissionId: acceptedSubmission.id,
      publicationId: publication.id,
      stage: "COPYEDIT_PENDING",
    });

    // Create contract template
    const contractTemplate = await createContractTemplate({
      orgId: seedOrg.id,
      name: `E2E Standard Agreement ${suffix}`,
      body: "<p>This is an E2E test contract template.</p>",
      mergeFields: [
        { key: "author_name", label: "Author Name", source: "manual" },
      ],
    });

    // Create issue
    const issue = await createIssue({
      orgId: seedOrg.id,
      publicationId: publication.id,
      title: `E2E Spring 2026 ${suffix}`,
      volume: 1,
      issueNumber: 1,
      status: "PLANNING",
    });

    // Create issue section
    const issueSection = await createIssueSection({
      issueId: issue.id,
      title: "Poetry",
      sortOrder: 0,
    });

    // Create CMS connection
    const cmsConnection = await createCmsConnection({
      orgId: seedOrg.id,
      name: `E2E WordPress ${suffix}`,
      adapterType: "WORDPRESS",
      config: {
        siteUrl: "https://e2e-test.example.com",
        username: "admin",
        applicationPassword: "xxxx xxxx xxxx xxxx",
      },
      publicationId: publication.id,
    });

    await use({
      publication,
      acceptedSubmission,
      pipelineItem,
      contractTemplate,
      issue,
      issueSection,
      cmsConnection,
    });

    // Cleanup in reverse dependency order
    await cleanupSlateData({
      cmsConnections: [cmsConnection.id],
      issueSections: [issueSection.id],
      issues: [issue.id],
      contractTemplates: [contractTemplate.id],
      pipelineItems: [pipelineItem.id],
      publications: [publication.id],
    });
    await deleteSubmission(acceptedSubmission.id);
  },
});

export { expect };
