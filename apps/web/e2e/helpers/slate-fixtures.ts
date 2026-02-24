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

import { test as base, expect, type Page, devices } from "@playwright/test";
import { buildStorageState, setupPageAuth } from "./auth";
import {
  getOrgBySlug,
  getUserByEmail,
  createApiKey,
  deleteApiKey,
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

/** Admin user profile (ADMIN role in quarterly-review org) */
const ADMIN_USER_PROFILE = {
  sub: "seed-zitadel-admin-001",
  email: "editor@quarterlyreview.org",
  name: "Test Admin",
};

/** All scopes needed for Slate E2E tests */
const SLATE_E2E_SCOPES = [
  "publications:read",
  "publications:write",
  "pipeline:read",
  "pipeline:write",
  "issues:read",
  "issues:write",
  "contracts:read",
  "contracts:write",
  "cms:read",
  "cms:write",
  "submissions:read",
  "users:read",
  "organizations:read",
];

interface SeedOrg {
  id: string;
  name: string;
  slug: string;
}

interface SeedUser {
  id: string;
  email: string;
}

interface TestApiKey {
  id: string;
  plainKey: string;
}

interface SlateData {
  publication: { id: string; name: string; slug: string };
  acceptedSubmission: { id: string; title: string };
  pipelineItem: { id: string };
  contractTemplate: { id: string; name: string };
  issue: { id: string; title: string };
  issueSection: { id: string; title: string };
  cmsConnection: { id: string; name: string };
}

export const test = base.extend<{
  seedOrg: SeedOrg;
  seedAdmin: SeedUser;
  testApiKey: TestApiKey;
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

  testApiKey: async ({ seedOrg, seedAdmin }, use) => {
    const key = await createApiKey({
      orgId: seedOrg.id,
      userId: seedAdmin.id,
      scopes: SLATE_E2E_SCOPES,
      name: `e2e-slate-${Date.now()}`,
    });

    await use(key);

    await deleteApiKey(key.id);
  },

  authedPage: async ({ browser, seedOrg, testApiKey, baseURL }, use) => {
    const context = await browser.newContext({
      ...devices["Desktop Chrome"],
      baseURL: baseURL ?? undefined,
      storageState: buildStorageState(seedOrg.id, ADMIN_USER_PROFILE),
    });

    const page = await context.newPage();

    await setupPageAuth(
      page,
      seedOrg.id,
      testApiKey.plainKey,
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
