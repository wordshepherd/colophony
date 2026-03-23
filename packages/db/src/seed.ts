/**
 * Seed script — deterministic dev/test data for local development.
 *
 * Runs as the superuser (DATABASE_URL) so RLS does not apply.
 * Idempotent: skips if seed data already exists.
 * Recovery from partial state: `pnpm db:reset && pnpm db:seed`
 *
 * Usage: pnpm --filter @colophony/db seed
 */

import { createHash } from "node:crypto";
import { eq } from "drizzle-orm";
import { db, pool } from "./client";
import type { DrizzleDb } from "./context";
import {
  organizations,
  users,
  organizationMembers,
  submissionPeriods,
  submissions,
  manuscripts,
  manuscriptVersions,
  files,
  submissionHistory,
  payments,
  apiKeys,
  auditEvents,
  retentionPolicies,
  publications,
  pipelineItems,
  pipelineHistory,
  contractTemplates,
  contracts,
  issues,
  issueSections,
  issueItems,
  cmsConnections,
} from "./schema";

// ---------------------------------------------------------------------------
// Known seed API key (printed in output for dev use)
// ---------------------------------------------------------------------------
const SEED_API_KEY = "col_live_00000000000000000000000000000000";
const SEED_API_KEY_PREFIX = "col_live_000";
const SEED_API_KEY_HASH = createHash("sha256")
  .update(SEED_API_KEY)
  .digest("hex");

// ---------------------------------------------------------------------------
// Date helpers (exported for reuse by seed-staging.ts)
// ---------------------------------------------------------------------------
export const now = new Date();
export const daysAgo = (n: number) => new Date(now.getTime() - n * 86_400_000);
export const daysFromNow = (n: number) =>
  new Date(now.getTime() + n * 86_400_000);

// ---------------------------------------------------------------------------
// SeedResult — all entities created by the base seed
// ---------------------------------------------------------------------------
export interface SeedResult {
  org1: typeof organizations.$inferSelect;
  org2: typeof organizations.$inferSelect;
  adminUser: typeof users.$inferSelect;
  editorUser: typeof users.$inferSelect;
  writerUser: typeof users.$inferSelect;
  inkwellAdmin: typeof users.$inferSelect;
  openPeriod: typeof submissionPeriods.$inferSelect;
  winterPeriod: typeof submissionPeriods.$inferSelect;
  inkwellPeriod: typeof submissionPeriods.$inferSelect;
  submittedSub: typeof submissions.$inferSelect;
  underReviewSub: typeof submissions.$inferSelect;
  acceptedSub: typeof submissions.$inferSelect;
  acceptedSub2: typeof submissions.$inferSelect;
  manuscript1: typeof manuscripts.$inferSelect;
  version1: typeof manuscriptVersions.$inferSelect;
  pub1: typeof publications.$inferSelect;
  pub2: typeof publications.$inferSelect;
  pipeItem1: typeof pipelineItems.$inferSelect;
  pipeItem2: typeof pipelineItems.$inferSelect;
  template1: typeof contractTemplates.$inferSelect;
  issue1: typeof issues.$inferSelect;
  poetrySection: typeof issueSections.$inferSelect;
  fictionSection: typeof issueSections.$inferSelect;
}

/**
 * Core seed logic — creates base dev/test data inside a transaction.
 * Exported so seed-staging.ts can call it and layer additional data.
 */
export async function seedBase(tx: DrizzleDb): Promise<SeedResult> {
  // ----- Organizations -----
  const [org1] = await tx
    .insert(organizations)
    .values({
      name: "The Quarterly Review",
      slug: "quarterly-review",
      settings: {
        maxFileSize: 10_485_760,
        allowedMimeTypes: ["application/pdf", "application/msword"],
      },
    })
    .returning();

  const [org2] = await tx
    .insert(organizations)
    .values({
      name: "Inkwell Press",
      slug: "inkwell-press",
      settings: { maxFileSize: 5_242_880 },
    })
    .returning();

  console.log(`  Organizations: ${org1!.name}, ${org2!.name}`);

  // ----- Users -----
  const [adminUser] = await tx
    .insert(users)
    .values({
      email: "editor@quarterlyreview.org",
      zitadelUserId: "seed-zitadel-admin-001",
      emailVerified: true,
      emailVerifiedAt: daysAgo(90),
    })
    .returning();

  const [editorUser] = await tx
    .insert(users)
    .values({
      email: "reader@quarterlyreview.org",
      zitadelUserId: "seed-zitadel-editor-001",
      emailVerified: true,
      emailVerifiedAt: daysAgo(60),
    })
    .returning();

  const [writerUser] = await tx
    .insert(users)
    .values({
      email: "writer@example.com",
      zitadelUserId: "seed-zitadel-writer-001",
      emailVerified: true,
      emailVerifiedAt: daysAgo(30),
    })
    .returning();

  const [inkwellAdmin] = await tx
    .insert(users)
    .values({
      email: "admin@inkwellpress.org",
      zitadelUserId: "seed-zitadel-inkwell-001",
      emailVerified: true,
      emailVerifiedAt: daysAgo(45),
    })
    .returning();

  console.log(
    `  Users: ${[adminUser, editorUser, writerUser, inkwellAdmin].map((u) => u!.email).join(", ")}`,
  );

  // ----- Organization Members -----
  // Org 1: admin, editor, reader (submitter)
  await tx.insert(organizationMembers).values([
    {
      organizationId: org1!.id,
      userId: adminUser!.id,
      role: "ADMIN",
    },
    {
      organizationId: org1!.id,
      userId: editorUser!.id,
      role: "EDITOR",
    },
    {
      organizationId: org1!.id,
      userId: writerUser!.id,
      role: "READER",
    },
  ]);

  // Org 2: admin + shared writer (cross-org membership)
  await tx.insert(organizationMembers).values([
    {
      organizationId: org2!.id,
      userId: inkwellAdmin!.id,
      role: "ADMIN",
    },
    {
      organizationId: org2!.id,
      userId: writerUser!.id,
      role: "READER",
    },
  ]);

  console.log(
    "  Organization members: 5 (3 in quarterly-review, 2 in inkwell-press)",
  );

  // ----- Submission Periods -----
  const [openPeriod] = await tx
    .insert(submissionPeriods)
    .values({
      organizationId: org1!.id,
      name: "Spring 2026 Reading Period",
      description: "Open call for poetry and short fiction, up to 5,000 words.",
      opensAt: daysAgo(14),
      closesAt: daysFromNow(45),
      fee: "5.00",
      maxSubmissions: 500,
    })
    .returning();

  const [winterPeriod] = await tx
    .insert(submissionPeriods)
    .values({
      organizationId: org1!.id,
      name: "Winter 2025 Reading Period",
      description: "Closed. Thank you for your submissions.",
      opensAt: daysAgo(120),
      closesAt: daysAgo(60),
      fee: "3.00",
      maxSubmissions: 300,
    })
    .returning();

  const [inkwellPeriod] = await tx
    .insert(submissionPeriods)
    .values({
      organizationId: org2!.id,
      name: "Open Submissions 2026",
      description: "Rolling submissions for flash fiction under 1,000 words.",
      opensAt: daysAgo(7),
      closesAt: daysFromNow(180),
    })
    .returning();

  console.log(
    "  Submission periods: 3 (2 in quarterly-review, 1 in inkwell-press)",
  );

  // ----- Submissions (Org 1) -----
  const [submittedSub] = await tx
    .insert(submissions)
    .values({
      organizationId: org1!.id,
      submitterId: writerUser!.id,
      submissionPeriodId: openPeriod!.id,
      title: "The Weight of Small Things",
      content:
        "A short story about the objects we carry and the memories they hold.",
      coverLetter:
        "Dear Editors, I am submitting my short story for your consideration. It explores themes of memory and loss through everyday objects.",
      status: "SUBMITTED",
      submittedAt: daysAgo(5),
    })
    .returning();

  const [underReviewSub] = await tx
    .insert(submissions)
    .values({
      organizationId: org1!.id,
      submitterId: writerUser!.id,
      submissionPeriodId: openPeriod!.id,
      title: "Cartography of Absence",
      content:
        "A cycle of poems mapping the spaces left behind by those who have departed.",
      coverLetter:
        "These poems emerged from a residency in the Outer Hebrides. They attempt to chart absence as a kind of presence.",
      status: "UNDER_REVIEW",
      submittedAt: daysAgo(10),
    })
    .returning();

  const [acceptedSub] = await tx
    .insert(submissions)
    .values({
      organizationId: org1!.id,
      submitterId: writerUser!.id,
      submissionPeriodId: openPeriod!.id,
      title: "Field Notes on Disappearing",
      content:
        "An essay on ecological grief and the language we use to describe environmental loss.",
      coverLetter:
        "This essay was a finalist for the Pushcart Prize and is previously unpublished.",
      status: "ACCEPTED",
      submittedAt: daysAgo(20),
    })
    .returning();

  // Submission (Org 2) — DRAFT
  await tx.insert(submissions).values({
    organizationId: org2!.id,
    submitterId: writerUser!.id,
    submissionPeriodId: inkwellPeriod!.id,
    title: "Untitled Flash Piece",
    content: null,
    status: "DRAFT",
  });

  console.log("  Submissions: 4 (3 in quarterly-review, 1 in inkwell-press)");

  // ----- Manuscripts + Versions + Files -----
  // Create a manuscript for the writer's submitted work
  const [manuscript1] = await tx
    .insert(manuscripts)
    .values({
      ownerId: writerUser!.id,
      title: "The Weight of Small Things",
      description:
        "A short story about the objects we carry and the memories they hold.",
    })
    .returning();

  const [version1] = await tx
    .insert(manuscriptVersions)
    .values({
      manuscriptId: manuscript1!.id,
      versionNumber: 1,
      label: "Initial submission",
    })
    .returning();

  // Link the submitted submission to this manuscript version
  await tx
    .update(submissions)
    .set({ manuscriptVersionId: version1!.id })
    .where(eq(submissions.id, submittedSub!.id));

  // Create files on the manuscript version (replaces submission_files)
  await tx.insert(files).values([
    {
      manuscriptVersionId: version1!.id,
      filename: "the-weight-of-small-things.pdf",
      mimeType: "application/pdf",
      size: 245_760,
      storageKey: `manuscripts/${writerUser!.id}/${manuscript1!.id}/v1/the-weight-of-small-things.pdf`,
      scanStatus: "CLEAN",
      scannedAt: daysAgo(4),
    },
    {
      manuscriptVersionId: version1!.id,
      filename: "cover-letter.pdf",
      mimeType: "application/pdf",
      size: 51_200,
      storageKey: `manuscripts/${writerUser!.id}/${manuscript1!.id}/v1/cover-letter.pdf`,
      scanStatus: "CLEAN",
      scannedAt: daysAgo(4),
    },
  ]);

  console.log("  Manuscripts: 1, versions: 1, files: 2");

  // ----- Submission History -----
  // SUBMITTED submission: DRAFT → SUBMITTED
  await tx.insert(submissionHistory).values({
    submissionId: submittedSub!.id,
    fromStatus: "DRAFT",
    toStatus: "SUBMITTED",
    changedBy: writerUser!.id,
    comment: "Submitted for review.",
    changedAt: daysAgo(5),
  });

  // UNDER_REVIEW submission: DRAFT → SUBMITTED → UNDER_REVIEW
  await tx.insert(submissionHistory).values([
    {
      submissionId: underReviewSub!.id,
      fromStatus: "DRAFT",
      toStatus: "SUBMITTED",
      changedBy: writerUser!.id,
      changedAt: daysAgo(10),
    },
    {
      submissionId: underReviewSub!.id,
      fromStatus: "SUBMITTED",
      toStatus: "UNDER_REVIEW",
      changedBy: editorUser!.id,
      comment: "Moved to review queue.",
      changedAt: daysAgo(7),
    },
  ]);

  // ACCEPTED submission: DRAFT → SUBMITTED → UNDER_REVIEW → ACCEPTED
  await tx.insert(submissionHistory).values([
    {
      submissionId: acceptedSub!.id,
      fromStatus: "DRAFT",
      toStatus: "SUBMITTED",
      changedBy: writerUser!.id,
      changedAt: daysAgo(20),
    },
    {
      submissionId: acceptedSub!.id,
      fromStatus: "SUBMITTED",
      toStatus: "UNDER_REVIEW",
      changedBy: editorUser!.id,
      changedAt: daysAgo(15),
    },
    {
      submissionId: acceptedSub!.id,
      fromStatus: "UNDER_REVIEW",
      toStatus: "ACCEPTED",
      changedBy: adminUser!.id,
      comment: "Unanimously accepted by editorial board.",
      changedAt: daysAgo(3),
    },
  ]);

  console.log("  Submission history: 6 entries");

  // ----- Payment (on SUBMITTED submission — fee payment) -----
  await tx.insert(payments).values({
    organizationId: org1!.id,
    submissionId: submittedSub!.id,
    stripePaymentId: "pi_seed_001",
    stripeSessionId: "cs_seed_001",
    amount: 500, // $5.00 in cents
    currency: "usd",
    status: "SUCCEEDED",
    metadata: { submissionTitle: "The Weight of Small Things" },
  });

  console.log("  Payments: 1");

  // ----- API Key (Org 1 — all read scopes) -----
  await tx.insert(apiKeys).values({
    organizationId: org1!.id,
    createdBy: adminUser!.id,
    name: "Seed Read-Only Key",
    keyHash: SEED_API_KEY_HASH,
    keyPrefix: SEED_API_KEY_PREFIX,
    scopes: [
      "submissions:read",
      "files:read",
      "organizations:read",
      "users:read",
      "api-keys:read",
      "payments:read",
      "audit:read",
      "periods:read",
      "periods:write",
    ],
  });

  console.log("  API keys: 1");

  // ----- Audit Events -----
  await tx.insert(auditEvents).values([
    {
      organizationId: org1!.id,
      actorId: adminUser!.id,
      action: "organization.create",
      resource: "organizations",
      resourceId: org1!.id,
      createdAt: daysAgo(90),
    },
    {
      organizationId: org1!.id,
      actorId: adminUser!.id,
      action: "submission_period.create",
      resource: "submission_periods",
      resourceId: openPeriod!.id,
      createdAt: daysAgo(14),
    },
    {
      organizationId: org1!.id,
      actorId: writerUser!.id,
      action: "submission.submit",
      resource: "submissions",
      resourceId: submittedSub!.id,
      createdAt: daysAgo(5),
    },
    {
      organizationId: org1!.id,
      actorId: adminUser!.id,
      action: "submission.accept",
      resource: "submissions",
      resourceId: acceptedSub!.id,
      createdAt: daysAgo(3),
    },
    {
      organizationId: org2!.id,
      actorId: inkwellAdmin!.id,
      action: "organization.create",
      resource: "organizations",
      resourceId: org2!.id,
      createdAt: daysAgo(45),
    },
  ]);

  console.log("  Audit events: 5");

  // ----- Retention Policies -----
  // Org 1: submissions retained 365 days
  await tx.insert(retentionPolicies).values({
    organizationId: org1!.id,
    resource: "submissions",
    retentionDays: 365,
  });

  // Global: audit events retained 90 days
  await tx.insert(retentionPolicies).values({
    organizationId: null,
    resource: "audit_events",
    retentionDays: 90,
  });

  console.log("  Retention policies: 2 (1 org-scoped, 1 global)");

  // =====================================================================
  // Slate — Publication Pipeline seed data
  // =====================================================================

  // ----- Second ACCEPTED submission (for two pipeline-eligible pieces) -----
  const [acceptedSub2] = await tx
    .insert(submissions)
    .values({
      organizationId: org1!.id,
      submitterId: writerUser!.id,
      submissionPeriodId: openPeriod!.id,
      title: "The Architecture of Longing",
      content:
        "A sequence of prose poems exploring the spaces between desire and memory.",
      coverLetter:
        "These prose poems were written during a fellowship at the Vermont Studio Center.",
      status: "ACCEPTED",
      submittedAt: daysAgo(18),
    })
    .returning();

  await tx.insert(submissionHistory).values([
    {
      submissionId: acceptedSub2!.id,
      fromStatus: "DRAFT",
      toStatus: "SUBMITTED",
      changedBy: writerUser!.id,
      changedAt: daysAgo(18),
    },
    {
      submissionId: acceptedSub2!.id,
      fromStatus: "SUBMITTED",
      toStatus: "UNDER_REVIEW",
      changedBy: editorUser!.id,
      changedAt: daysAgo(12),
    },
    {
      submissionId: acceptedSub2!.id,
      fromStatus: "UNDER_REVIEW",
      toStatus: "ACCEPTED",
      changedBy: adminUser!.id,
      comment: "Strong work — accepted for Spring issue.",
      changedAt: daysAgo(2),
    },
  ]);

  console.log("  Second accepted submission: The Architecture of Longing");

  // ----- Publications -----
  const [pub1] = await tx
    .insert(publications)
    .values({
      organizationId: org1!.id,
      name: "The Quarterly Review",
      slug: "the-quarterly-review",
      description:
        "Flagship print journal publishing poetry, fiction, and essays since 1985.",
      status: "ACTIVE",
    })
    .returning();

  const [pub2] = await tx
    .insert(publications)
    .values({
      organizationId: org1!.id,
      name: "Quarterly Online",
      slug: "quarterly-online",
      description:
        "Digital companion to The Quarterly Review, featuring web-exclusive content.",
      status: "ACTIVE",
    })
    .returning();

  console.log(`  Publications: ${pub1!.name}, ${pub2!.name}`);

  // ----- Pipeline Items -----
  const [pipeItem1] = await tx
    .insert(pipelineItems)
    .values({
      organizationId: org1!.id,
      submissionId: acceptedSub!.id,
      publicationId: pub1!.id,
      stage: "COPYEDIT_IN_PROGRESS",
      assignedCopyeditorId: editorUser!.id,
      copyeditDueAt: daysFromNow(14),
    })
    .returning();

  const [pipeItem2] = await tx
    .insert(pipelineItems)
    .values({
      organizationId: org1!.id,
      submissionId: acceptedSub2!.id,
      publicationId: pub1!.id,
      stage: "READY_TO_PUBLISH",
    })
    .returning();

  console.log("  Pipeline items: 2 (COPYEDIT_IN_PROGRESS, READY_TO_PUBLISH)");

  // ----- Pipeline History -----
  await tx.insert(pipelineHistory).values([
    // Item 1: entered pipeline → copyedit started
    {
      pipelineItemId: pipeItem1!.id,
      fromStage: null,
      toStage: "COPYEDIT_PENDING",
      changedBy: adminUser!.id,
      comment: "Moved to publication pipeline.",
      changedAt: daysAgo(2),
    },
    {
      pipelineItemId: pipeItem1!.id,
      fromStage: "COPYEDIT_PENDING",
      toStage: "COPYEDIT_IN_PROGRESS",
      changedBy: editorUser!.id,
      comment: "Copyedit started.",
      changedAt: daysAgo(1),
    },
    // Item 2: full pipeline progression to READY_TO_PUBLISH
    {
      pipelineItemId: pipeItem2!.id,
      fromStage: null,
      toStage: "COPYEDIT_PENDING",
      changedBy: adminUser!.id,
      changedAt: daysAgo(10),
    },
    {
      pipelineItemId: pipeItem2!.id,
      fromStage: "COPYEDIT_PENDING",
      toStage: "COPYEDIT_IN_PROGRESS",
      changedBy: editorUser!.id,
      changedAt: daysAgo(8),
    },
    {
      pipelineItemId: pipeItem2!.id,
      fromStage: "COPYEDIT_IN_PROGRESS",
      toStage: "AUTHOR_REVIEW",
      changedBy: editorUser!.id,
      changedAt: daysAgo(5),
    },
    {
      pipelineItemId: pipeItem2!.id,
      fromStage: "AUTHOR_REVIEW",
      toStage: "PROOFREAD",
      changedBy: adminUser!.id,
      changedAt: daysAgo(3),
    },
    {
      pipelineItemId: pipeItem2!.id,
      fromStage: "PROOFREAD",
      toStage: "READY_TO_PUBLISH",
      changedBy: adminUser!.id,
      comment: "Proofread complete, ready for issue assembly.",
      changedAt: daysAgo(1),
    },
  ]);

  console.log("  Pipeline history: 7 entries");

  // ----- Contract Template -----
  const [template1] = await tx
    .insert(contractTemplates)
    .values({
      organizationId: org1!.id,
      name: "Standard Publication Agreement",
      description: "Default contract template for first publication rights.",
      body: [
        "PUBLICATION AGREEMENT",
        "",
        "This agreement is between {{authorName}} (Author) and {{publicationName}} (Publisher).",
        "",
        'The Author grants the Publisher first serial rights to the work titled "{{title}}".',
        "",
        "Date: {{date}}",
        "",
        "Signature: ________________________",
      ].join("\n"),
      mergeFields: [
        { key: "authorName", label: "Author Name", source: "auto" as const },
        { key: "title", label: "Work Title", source: "auto" as const },
        {
          key: "publicationName",
          label: "Publication Name",
          source: "auto" as const,
          defaultValue: "The Quarterly Review",
        },
        { key: "date", label: "Date", source: "auto" as const },
      ],
      isDefault: true,
    })
    .returning();

  console.log(`  Contract templates: ${template1!.name}`);

  // ----- Contract (DRAFT, linked to pipeline item 1) -----
  await tx.insert(contracts).values({
    organizationId: org1!.id,
    pipelineItemId: pipeItem1!.id,
    contractTemplateId: template1!.id,
    status: "DRAFT",
    renderedBody: [
      "PUBLICATION AGREEMENT",
      "",
      "This agreement is between Writer Example (Author) and The Quarterly Review (Publisher).",
      "",
      'The Author grants the Publisher first serial rights to the work titled "Field Notes on Disappearing".',
      "",
      `Date: ${new Date().toISOString().split("T")[0]}`,
      "",
      "Signature: ________________________",
    ].join("\n"),
    mergeData: {
      authorName: "Writer Example",
      title: "Field Notes on Disappearing",
      publicationName: "The Quarterly Review",
      date: new Date().toISOString().split("T")[0],
    },
  });

  console.log("  Contracts: 1 (DRAFT)");

  // ----- Issue -----
  const [issue1] = await tx
    .insert(issues)
    .values({
      organizationId: org1!.id,
      publicationId: pub1!.id,
      title: "Spring 2026",
      volume: 41,
      issueNumber: 2,
      description:
        "Spring 2026 issue featuring new poetry, fiction, and essays.",
      status: "ASSEMBLING",
      publicationDate: daysFromNow(60),
    })
    .returning();

  console.log(`  Issues: ${issue1!.title} (ASSEMBLING)`);

  // ----- Issue Sections -----
  const [poetrySection] = await tx
    .insert(issueSections)
    .values({
      issueId: issue1!.id,
      title: "Poetry",
      sortOrder: 0,
    })
    .returning();

  const [fictionSection] = await tx
    .insert(issueSections)
    .values({
      issueId: issue1!.id,
      title: "Fiction",
      sortOrder: 1,
    })
    .returning();

  console.log("  Issue sections: Poetry, Fiction");

  // ----- Issue Items -----
  await tx.insert(issueItems).values([
    {
      issueId: issue1!.id,
      pipelineItemId: pipeItem2!.id,
      issueSectionId: poetrySection!.id,
      sortOrder: 0,
    },
    {
      issueId: issue1!.id,
      pipelineItemId: pipeItem1!.id,
      issueSectionId: fictionSection!.id,
      sortOrder: 0,
    },
  ]);

  console.log("  Issue items: 2 (one per section)");

  // ----- CMS Connection -----
  await tx.insert(cmsConnections).values({
    organizationId: org1!.id,
    publicationId: pub2!.id,
    adapterType: "WORDPRESS",
    name: "QR WordPress",
    config: {
      siteUrl: "https://example.com/wp-json",
      username: "admin",
      applicationPassword: "xxxx-xxxx-xxxx",
    },
    isActive: true,
  });

  console.log("  CMS connections: 1 (QR WordPress)");

  return {
    org1: org1!,
    org2: org2!,
    adminUser: adminUser!,
    editorUser: editorUser!,
    writerUser: writerUser!,
    inkwellAdmin: inkwellAdmin!,
    openPeriod: openPeriod!,
    winterPeriod: winterPeriod!,
    inkwellPeriod: inkwellPeriod!,
    submittedSub: submittedSub!,
    underReviewSub: underReviewSub!,
    acceptedSub: acceptedSub!,
    acceptedSub2: acceptedSub2!,
    manuscript1: manuscript1!,
    version1: version1!,
    pub1: pub1!,
    pub2: pub2!,
    pipeItem1: pipeItem1!,
    pipeItem2: pipeItem2!,
    template1: template1!,
    issue1: issue1!,
    poetrySection: poetrySection!,
    fictionSection: fictionSection!,
  };
}

// ---------------------------------------------------------------------------
// CLI entry point — runs seedBase inside a transaction with idempotency check
// ---------------------------------------------------------------------------
async function main() {
  const existing = await db
    .select({ id: organizations.id })
    .from(organizations)
    .where(eq(organizations.slug, "quarterly-review"))
    .limit(1);

  if (existing.length > 0) {
    console.log(
      "Seed data already exists (quarterly-review org found). Skipping.",
    );
    return;
  }

  console.log("Seeding database...\n");

  await db.transaction(async (tx) => {
    await seedBase(tx as unknown as DrizzleDb);
  });

  console.log("\nSeed complete.");
  console.log(`\nSeed API key (quarterly-review, read-only): ${SEED_API_KEY}`);
}

// Only run main() when this file is the direct entry point (not imported by seed-staging.ts).
// Check argv[1] to detect if seed.ts is the script being run by tsx.
const isSeedEntryPoint =
  process.argv[1]?.replace(/\\/g, "/").endsWith("/seed.ts") ?? false;
if (isSeedEntryPoint) {
  main()
    .catch((e) => {
      console.error("Seed failed:", e);
      process.exit(1);
    })
    .finally(async () => {
      await pool.end();
    });
}
