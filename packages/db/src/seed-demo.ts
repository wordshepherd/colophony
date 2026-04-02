/**
 * Demo seed — curated data for the Colophony product demo video.
 *
 * Creates three fictional magazines, a writer with multiple manuscripts
 * and version history, simultaneous submissions across magazines, a full
 * editorial pipeline, and contributor payment records.
 *
 * Runs as superuser (DATABASE_URL) so RLS does not apply.
 * Idempotent: skips if demo data already exists (meridian-review org).
 *
 * Usage: pnpm --filter @colophony/db seed:demo
 */

import { eq } from "drizzle-orm";
import { db, pool } from "./client";
import type { DrizzleDb } from "./context";
import { demoPoetryDoc, demoFictionDoc } from "./seed-demo-content";
import { creativeNonfictionDoc } from "./seed-content";
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
  submissionReviewers,
  submissionDiscussions,
  submissionVotes,
  publications,
  pipelineItems,
  pipelineHistory,
  pipelineComments,
  contractTemplates,
  contracts,
  issues,
  issueSections,
  issueItems,
  cmsConnections,
  contributors,
  contributorPublications,
  rightsAgreements,
  paymentTransactions,
  payments,
  workspaceCollections,
  workspaceItems,
} from "./schema";

// ---------------------------------------------------------------------------
// Stable demo user IDs (deterministic, survive resets, referenced by DEMO_USER_IDS env var)
// ---------------------------------------------------------------------------
export const DEMO_WRITER_ID = "00000000-0000-4000-a000-000000000001";
export const DEMO_EDITOR_ID = "00000000-0000-4000-a000-000000000002";

// ---------------------------------------------------------------------------
// Date helpers
// ---------------------------------------------------------------------------
const now = new Date();
const daysAgo = (n: number) => new Date(now.getTime() - n * 86_400_000);
const daysFromNow = (n: number) => new Date(now.getTime() + n * 86_400_000);

// ---------------------------------------------------------------------------
// Main seed function
// ---------------------------------------------------------------------------
async function seedDemo(tx: DrizzleDb) {
  console.log("Seeding demo data...\n");

  // =========================================================================
  // ORGANIZATIONS (three fictional magazines)
  // =========================================================================
  const [meridian] = await tx
    .insert(organizations)
    .values({
      name: "The Meridian Review",
      slug: "meridian-review",
      settings: {
        maxFileSize: 10_485_760,
        allowedMimeTypes: ["application/pdf", "application/msword"],
        votingEnabled: true,
        scoringEnabled: true,
        scoreMin: 1,
        scoreMax: 5,
      },
    })
    .returning();

  const [saltwater] = await tx
    .insert(organizations)
    .values({
      name: "Saltwater Quarterly",
      slug: "saltwater-quarterly",
      settings: {
        maxFileSize: 5_242_880,
        allowedMimeTypes: ["application/pdf"],
      },
    })
    .returning();

  const [glassRiver] = await tx
    .insert(organizations)
    .values({
      name: "Glass River Literary",
      slug: "glass-river-literary",
      settings: { maxFileSize: 5_242_880 },
    })
    .returning();

  console.log(
    `  Organizations: ${meridian!.name}, ${saltwater!.name}, ${glassRiver!.name}`,
  );

  // =========================================================================
  // USERS
  // =========================================================================
  const [writer] = await tx
    .insert(users)
    .values({
      id: DEMO_WRITER_ID,
      email: "elena.vasquez@example.com",
      displayName: "Elena Vasquez",
      zitadelUserId: "demo-zitadel-writer-001",
      emailVerified: true,
      emailVerifiedAt: daysAgo(60),
    })
    .returning();

  const [meridianEditor] = await tx
    .insert(users)
    .values({
      id: DEMO_EDITOR_ID,
      email: "margaret.chen@meridianreview.org",
      displayName: "Margaret Chen",
      zitadelUserId: "demo-zitadel-meridian-editor-001",
      emailVerified: true,
      emailVerifiedAt: daysAgo(90),
    })
    .returning();

  const [meridianReader] = await tx
    .insert(users)
    .values({
      email: "james.okoro@meridianreview.org",
      displayName: "James Okoro",
      zitadelUserId: "demo-zitadel-meridian-reader-001",
      emailVerified: true,
      emailVerifiedAt: daysAgo(45),
    })
    .returning();

  const [saltwaterEditor] = await tx
    .insert(users)
    .values({
      email: "sarah.lindqvist@saltwaterquarterly.org",
      displayName: "Sarah Lindqvist",
      zitadelUserId: "demo-zitadel-saltwater-editor-001",
      emailVerified: true,
      emailVerifiedAt: daysAgo(30),
    })
    .returning();

  const [glassRiverEditor] = await tx
    .insert(users)
    .values({
      email: "dev.patel@glassriverliterary.org",
      displayName: "Dev Patel",
      zitadelUserId: "demo-zitadel-glassriver-editor-001",
      emailVerified: true,
      emailVerifiedAt: daysAgo(30),
    })
    .returning();

  console.log(
    `  Users: ${[writer, meridianEditor, meridianReader, saltwaterEditor, glassRiverEditor].map((u) => u!.displayName).join(", ")}`,
  );

  // =========================================================================
  // ORGANIZATION MEMBERS
  // =========================================================================
  await tx.insert(organizationMembers).values([
    // Meridian Review
    {
      organizationId: meridian!.id,
      userId: meridianEditor!.id,
      roles: ["ADMIN"],
    },
    {
      organizationId: meridian!.id,
      userId: meridianReader!.id,
      roles: ["READER"],
    },
    { organizationId: meridian!.id, userId: writer!.id, roles: ["READER"] },
    // Saltwater Quarterly
    {
      organizationId: saltwater!.id,
      userId: saltwaterEditor!.id,
      roles: ["ADMIN"],
    },
    { organizationId: saltwater!.id, userId: writer!.id, roles: ["READER"] },
    // Glass River Literary
    {
      organizationId: glassRiver!.id,
      userId: glassRiverEditor!.id,
      roles: ["ADMIN"],
    },
    { organizationId: glassRiver!.id, userId: writer!.id, roles: ["READER"] },
  ]);

  console.log("  Organization members: 7");

  // =========================================================================
  // SUBMISSION PERIODS
  // =========================================================================
  const [meridianPeriod] = await tx
    .insert(submissionPeriods)
    .values({
      organizationId: meridian!.id,
      name: "Spring 2026 Open Reading",
      description:
        "Poetry, fiction, and creative nonfiction. Up to 5,000 words for prose; up to 5 poems.",
      opensAt: daysAgo(30),
      closesAt: daysFromNow(60),
      fee: "5.00",
      maxSubmissions: 400,
      simSubPolicy: { type: "allowed_notify" },
    })
    .returning();

  const [saltwaterPeriod] = await tx
    .insert(submissionPeriods)
    .values({
      organizationId: saltwater!.id,
      name: "Issue 14 — Summer 2026",
      description:
        "We are especially interested in work that engages with landscape and place.",
      opensAt: daysAgo(21),
      closesAt: daysFromNow(45),
      fee: "3.00",
      maxSubmissions: 250,
      simSubPolicy: { type: "allowed" },
    })
    .returning();

  const [glassRiverPeriod] = await tx
    .insert(submissionPeriods)
    .values({
      organizationId: glassRiver!.id,
      name: "2026 General Submissions",
      description:
        "Rolling reading period. Poetry and short fiction. No reading fee.",
      opensAt: daysAgo(60),
      closesAt: daysFromNow(120),
      simSubPolicy: { type: "allowed" },
    })
    .returning();

  console.log("  Submission periods: 3");

  // =========================================================================
  // MANUSCRIPTS (writer's personal library)
  // =========================================================================

  // --- Manuscript 1: "Tidewater Elegies" (poetry — the star of the demo) ---
  const [poetryMs] = await tx
    .insert(manuscripts)
    .values({
      ownerId: writer!.id,
      title: "Tidewater Elegies",
      description:
        "A sequence of three poems on grief, landscape, and the persistence of memory.",
      genre: { primary: "poetry", sub: null, hybrid: [] },
    })
    .returning();

  // v1 — first draft (early attempt)
  const [_poetryV1] = await tx
    .insert(manuscriptVersions)
    .values({
      manuscriptId: poetryMs!.id,
      versionNumber: 1,
      label: "First draft",
      content: demoPoetryDoc(), // Simplified v1 — same doc for demo simplicity
      contentFormat: "prosemirror_v1",
      contentExtractionStatus: "COMPLETE",
      createdAt: daysAgo(45),
    })
    .returning();

  // v2 — revised (the version submitted everywhere)
  const [poetryV2] = await tx
    .insert(manuscriptVersions)
    .values({
      manuscriptId: poetryMs!.id,
      versionNumber: 2,
      label: "Revised — workshop feedback",
      content: demoPoetryDoc(),
      contentFormat: "prosemirror_v1",
      contentExtractionStatus: "COMPLETE",
      createdAt: daysAgo(28),
    })
    .returning();

  // v3 — minor polish
  await tx.insert(manuscriptVersions).values({
    manuscriptId: poetryMs!.id,
    versionNumber: 3,
    label: "Final polish",
    content: demoPoetryDoc(),
    contentFormat: "prosemirror_v1",
    contentExtractionStatus: "COMPLETE",
    createdAt: daysAgo(14),
  });

  // Files on v2 (the submitted version)
  await tx.insert(files).values({
    manuscriptVersionId: poetryV2!.id,
    filename: "tidewater-elegies.pdf",
    mimeType: "application/pdf",
    size: 187_392,
    storageKey: `manuscripts/${writer!.id}/${poetryMs!.id}/v2/tidewater-elegies.pdf`,
    scanStatus: "CLEAN",
    scannedAt: daysAgo(27),
  });

  // --- Manuscript 2: "The Cartographer's Daughter" (fiction) ---
  const [fictionMs] = await tx
    .insert(manuscripts)
    .values({
      ownerId: writer!.id,
      title: "The Cartographer\u2019s Daughter",
      description:
        "A short story about a woman who inherits her father\u2019s collection of maps of vanished places.",
      genre: { primary: "fiction", sub: "short_fiction", hybrid: [] },
    })
    .returning();

  const [fictionV1] = await tx
    .insert(manuscriptVersions)
    .values({
      manuscriptId: fictionMs!.id,
      versionNumber: 1,
      label: "Complete draft",
      content: demoFictionDoc(),
      contentFormat: "prosemirror_v1",
      contentExtractionStatus: "COMPLETE",
      createdAt: daysAgo(35),
    })
    .returning();

  await tx.insert(files).values({
    manuscriptVersionId: fictionV1!.id,
    filename: "the-cartographers-daughter.pdf",
    mimeType: "application/pdf",
    size: 312_832,
    storageKey: `manuscripts/${writer!.id}/${fictionMs!.id}/v1/the-cartographers-daughter.pdf`,
    scanStatus: "CLEAN",
    scannedAt: daysAgo(34),
  });

  // --- Manuscript 3: "Notes from the Understory" (creative nonfiction) ---
  const [nonfictionMs] = await tx
    .insert(manuscripts)
    .values({
      ownerId: writer!.id,
      title: "Notes from the Understory",
      description:
        "An essay on ecological grief and the language of environmental loss.",
      genre: { primary: "creative_nonfiction", sub: null, hybrid: [] },
    })
    .returning();

  const [nonfictionV1] = await tx
    .insert(manuscriptVersions)
    .values({
      manuscriptId: nonfictionMs!.id,
      versionNumber: 1,
      label: "Initial submission",
      content: creativeNonfictionDoc(),
      contentFormat: "prosemirror_v1",
      contentExtractionStatus: "COMPLETE",
      createdAt: daysAgo(40),
    })
    .returning();

  await tx.insert(files).values({
    manuscriptVersionId: nonfictionV1!.id,
    filename: "notes-from-the-understory.docx",
    mimeType:
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    size: 425_984,
    storageKey: `manuscripts/${writer!.id}/${nonfictionMs!.id}/v1/notes-from-the-understory.docx`,
    scanStatus: "CLEAN",
    scannedAt: daysAgo(39),
  });

  console.log(
    "  Manuscripts: 3 (poetry: 3 versions, fiction: 1, nonfiction: 1)",
  );

  // =========================================================================
  // SUBMISSIONS — "Tidewater Elegies" v2 sent to all three magazines
  // =========================================================================

  // Meridian Review → ACCEPTED (the big moment)
  const [meridianSub] = await tx
    .insert(submissions)
    .values({
      organizationId: meridian!.id,
      submitterId: writer!.id,
      submissionPeriodId: meridianPeriod!.id,
      manuscriptVersionId: poetryV2!.id,
      title: "Tidewater Elegies",
      coverLetter:
        "Dear editors of The Meridian Review,\n\nI am submitting a sequence of three poems, \u201CTidewater Elegies,\u201D for your consideration. These poems emerged from two years living on the Carolina coast, where I watched the salt marshes I\u2019d known since childhood reshape themselves with each tidal cycle.\n\nThank you for your time and attention.\n\nElena Vasquez",
      status: "ACCEPTED",
      submittedAt: daysAgo(21),
      simSubCheckResult: "CLEAR",
      simSubCheckedAt: daysAgo(21),
    })
    .returning();

  // Saltwater Quarterly → SUBMITTED (pending — awaiting withdrawal)
  const [saltwaterSub] = await tx
    .insert(submissions)
    .values({
      organizationId: saltwater!.id,
      submitterId: writer!.id,
      submissionPeriodId: saltwaterPeriod!.id,
      manuscriptVersionId: poetryV2!.id,
      title: "Tidewater Elegies",
      coverLetter:
        "Dear editors,\n\nPlease find enclosed \u201CTidewater Elegies,\u201D a three-poem sequence about coastal landscapes and memory. I believe these poems align with your interest in work that engages with place.\n\nThis is a simultaneous submission.\n\nBest,\nElena Vasquez",
      status: "SUBMITTED",
      submittedAt: daysAgo(18),
      simSubCheckResult: "CLEAR",
      simSubCheckedAt: daysAgo(18),
    })
    .returning();

  // Glass River Literary → UNDER_REVIEW (pending — awaiting withdrawal)
  const [glassRiverSub] = await tx
    .insert(submissions)
    .values({
      organizationId: glassRiver!.id,
      submitterId: writer!.id,
      submissionPeriodId: glassRiverPeriod!.id,
      manuscriptVersionId: poetryV2!.id,
      title: "Tidewater Elegies",
      coverLetter:
        "Dear Glass River editors,\n\nI\u2019m submitting \u201CTidewater Elegies\u201D \u2014 three poems on grief and landscape. This is a simultaneous submission.\n\nThank you,\nElena Vasquez",
      status: "UNDER_REVIEW",
      submittedAt: daysAgo(20),
      simSubCheckResult: "CLEAR",
      simSubCheckedAt: daysAgo(20),
    })
    .returning();

  // Additional submissions (other manuscripts, to fill out the dashboard)
  const [fictionSub] = await tx
    .insert(submissions)
    .values({
      organizationId: meridian!.id,
      submitterId: writer!.id,
      submissionPeriodId: meridianPeriod!.id,
      manuscriptVersionId: fictionV1!.id,
      title: "The Cartographer\u2019s Daughter",
      coverLetter:
        "A short story about inherited grief and the maps we make of vanished places.",
      status: "UNDER_REVIEW",
      submittedAt: daysAgo(14),
    })
    .returning();

  const [nonfictionSub] = await tx
    .insert(submissions)
    .values({
      organizationId: saltwater!.id,
      submitterId: writer!.id,
      submissionPeriodId: saltwaterPeriod!.id,
      manuscriptVersionId: nonfictionV1!.id,
      title: "Notes from the Understory",
      coverLetter:
        "An essay on ecological grief, submitted for your Landscape issue.",
      status: "SUBMITTED",
      submittedAt: daysAgo(10),
    })
    .returning();

  console.log(
    "  Submissions: 5 (3 for Tidewater Elegies across magazines, 2 others)",
  );

  // =========================================================================
  // SUBMISSION HISTORY
  // =========================================================================

  // Meridian Review — full arc: DRAFT → SUBMITTED → UNDER_REVIEW → ACCEPTED
  await tx.insert(submissionHistory).values([
    {
      submissionId: meridianSub!.id,
      fromStatus: "DRAFT",
      toStatus: "SUBMITTED",
      changedBy: writer!.id,
      changedAt: daysAgo(21),
    },
    {
      submissionId: meridianSub!.id,
      fromStatus: "SUBMITTED",
      toStatus: "UNDER_REVIEW",
      changedBy: meridianEditor!.id,
      comment: "Assigned to first reader.",
      changedAt: daysAgo(18),
    },
    {
      submissionId: meridianSub!.id,
      fromStatus: "UNDER_REVIEW",
      toStatus: "ACCEPTED",
      changedBy: meridianEditor!.id,
      comment: "Unanimous yes from the editorial team. Exceptional work.",
      changedAt: daysAgo(2),
    },
  ]);

  // Saltwater — DRAFT → SUBMITTED
  await tx.insert(submissionHistory).values({
    submissionId: saltwaterSub!.id,
    fromStatus: "DRAFT",
    toStatus: "SUBMITTED",
    changedBy: writer!.id,
    changedAt: daysAgo(18),
  });

  // Glass River — DRAFT → SUBMITTED → UNDER_REVIEW
  await tx.insert(submissionHistory).values([
    {
      submissionId: glassRiverSub!.id,
      fromStatus: "DRAFT",
      toStatus: "SUBMITTED",
      changedBy: writer!.id,
      changedAt: daysAgo(20),
    },
    {
      submissionId: glassRiverSub!.id,
      fromStatus: "SUBMITTED",
      toStatus: "UNDER_REVIEW",
      changedBy: glassRiverEditor!.id,
      changedAt: daysAgo(15),
    },
  ]);

  // Fiction sub — DRAFT → SUBMITTED → UNDER_REVIEW
  await tx.insert(submissionHistory).values([
    {
      submissionId: fictionSub!.id,
      fromStatus: "DRAFT",
      toStatus: "SUBMITTED",
      changedBy: writer!.id,
      changedAt: daysAgo(14),
    },
    {
      submissionId: fictionSub!.id,
      fromStatus: "SUBMITTED",
      toStatus: "UNDER_REVIEW",
      changedBy: meridianEditor!.id,
      changedAt: daysAgo(10),
    },
  ]);

  // Nonfiction sub — DRAFT → SUBMITTED
  await tx.insert(submissionHistory).values({
    submissionId: nonfictionSub!.id,
    fromStatus: "DRAFT",
    toStatus: "SUBMITTED",
    changedBy: writer!.id,
    changedAt: daysAgo(10),
  });

  console.log("  Submission history: 10 entries");

  // =========================================================================
  // SUBMISSION FEES (payments)
  // =========================================================================
  await tx.insert(payments).values([
    {
      organizationId: meridian!.id,
      submissionId: meridianSub!.id,
      stripePaymentId: "pi_demo_meridian_001",
      stripeSessionId: "cs_demo_meridian_001",
      amount: 500,
      currency: "usd",
      status: "SUCCEEDED",
      metadata: { submissionTitle: "Tidewater Elegies" },
    },
    {
      organizationId: saltwater!.id,
      submissionId: saltwaterSub!.id,
      stripePaymentId: "pi_demo_saltwater_001",
      stripeSessionId: "cs_demo_saltwater_001",
      amount: 300,
      currency: "usd",
      status: "SUCCEEDED",
      metadata: { submissionTitle: "Tidewater Elegies" },
    },
  ]);

  console.log("  Submission fees: 2 payments");

  // =========================================================================
  // EDITORIAL REVIEW — Meridian Review (for the accepted poem)
  // =========================================================================

  // Assign reviewer
  await tx.insert(submissionReviewers).values({
    organizationId: meridian!.id,
    submissionId: meridianSub!.id,
    reviewerUserId: meridianReader!.id,
    assignedBy: meridianEditor!.id,
    assignedAt: daysAgo(18),
    readAt: daysAgo(16),
  });

  // Votes
  await tx.insert(submissionVotes).values([
    {
      organizationId: meridian!.id,
      submissionId: meridianSub!.id,
      voterUserId: meridianReader!.id,
      decision: "ACCEPT",
      score: "4.50",
      createdAt: daysAgo(15),
    },
    {
      organizationId: meridian!.id,
      submissionId: meridianSub!.id,
      voterUserId: meridianEditor!.id,
      decision: "ACCEPT",
      score: "5.00",
      createdAt: daysAgo(5),
    },
  ]);

  // Discussion thread
  await tx.insert(submissionDiscussions).values([
    {
      organizationId: meridian!.id,
      submissionId: meridianSub!.id,
      authorId: meridianReader!.id,
      content:
        "The stepped indentation in \u201CLow Country\u201D mirrors the tidal movement beautifully. The caesura before \u201Cthe oyster\u2019s slow cathedral\u201D is perfectly placed. Strong yes.",
      createdAt: daysAgo(15),
    },
    {
      organizationId: meridian!.id,
      submissionId: meridianSub!.id,
      authorId: meridianEditor!.id,
      content:
        "Agreed. The sequence holds together remarkably well. \u201CInventory\u201D is the strongest of the three \u2014 the image of reading \u201Cthe braille of empty rooms\u201D is extraordinary. Let\u2019s take this.",
      createdAt: daysAgo(5),
    },
  ]);

  console.log("  Editorial review: 1 reviewer, 2 votes, 2 discussion comments");

  // =========================================================================
  // PUBLICATION PIPELINE (Meridian Review — Slate)
  // =========================================================================

  // Publication
  const [meridianPub] = await tx
    .insert(publications)
    .values({
      organizationId: meridian!.id,
      name: "The Meridian Review",
      slug: "the-meridian-review",
      description:
        "A journal of poetry, fiction, and essays published since 2003.",
      status: "ACTIVE",
    })
    .returning();

  // Pipeline item for the accepted poem
  const [poemPipeItem] = await tx
    .insert(pipelineItems)
    .values({
      organizationId: meridian!.id,
      submissionId: meridianSub!.id,
      publicationId: meridianPub!.id,
      stage: "COPYEDIT_IN_PROGRESS",
      assignedCopyeditorId: meridianEditor!.id,
      copyeditDueAt: daysFromNow(14),
    })
    .returning();

  // Pipeline item for the fiction piece (further along)
  const [fictionPipeItem] = await tx
    .insert(pipelineItems)
    .values({
      organizationId: meridian!.id,
      submissionId: fictionSub!.id,
      publicationId: meridianPub!.id,
      stage: "READY_TO_PUBLISH",
    })
    .returning();

  // Pipeline history
  await tx.insert(pipelineHistory).values([
    {
      pipelineItemId: poemPipeItem!.id,
      fromStage: null,
      toStage: "COPYEDIT_PENDING",
      changedBy: meridianEditor!.id,
      comment: "Moved to publication pipeline.",
      changedAt: daysAgo(2),
    },
    {
      pipelineItemId: poemPipeItem!.id,
      fromStage: "COPYEDIT_PENDING",
      toStage: "COPYEDIT_IN_PROGRESS",
      changedBy: meridianEditor!.id,
      comment: "Beginning copyedit pass.",
      changedAt: daysAgo(1),
    },
    // Fiction piece — completed pipeline
    {
      pipelineItemId: fictionPipeItem!.id,
      fromStage: null,
      toStage: "COPYEDIT_PENDING",
      changedBy: meridianEditor!.id,
      changedAt: daysAgo(8),
    },
    {
      pipelineItemId: fictionPipeItem!.id,
      fromStage: "COPYEDIT_PENDING",
      toStage: "COPYEDIT_IN_PROGRESS",
      changedBy: meridianEditor!.id,
      changedAt: daysAgo(6),
    },
    {
      pipelineItemId: fictionPipeItem!.id,
      fromStage: "COPYEDIT_IN_PROGRESS",
      toStage: "AUTHOR_REVIEW",
      changedBy: meridianEditor!.id,
      changedAt: daysAgo(4),
    },
    {
      pipelineItemId: fictionPipeItem!.id,
      fromStage: "AUTHOR_REVIEW",
      toStage: "PROOFREAD",
      changedBy: meridianEditor!.id,
      changedAt: daysAgo(3),
    },
    {
      pipelineItemId: fictionPipeItem!.id,
      fromStage: "PROOFREAD",
      toStage: "READY_TO_PUBLISH",
      changedBy: meridianEditor!.id,
      comment: "Proofread complete.",
      changedAt: daysAgo(1),
    },
  ]);

  // Pipeline comments
  await tx.insert(pipelineComments).values([
    {
      pipelineItemId: poemPipeItem!.id,
      authorId: meridianEditor!.id,
      content:
        "Light copyedit only \u2014 the line breaks and spacing are intentional. Do not normalize indentation.",
      stage: "COPYEDIT_IN_PROGRESS",
      createdAt: daysAgo(1),
    },
  ]);

  console.log("  Pipeline items: 2, history: 7, comments: 1");

  // =========================================================================
  // CONTRACT
  // =========================================================================
  const [contractTemplate] = await tx
    .insert(contractTemplates)
    .values({
      organizationId: meridian!.id,
      name: "Standard First Serial Rights",
      description:
        "Grant of first North American serial rights for a single work.",
      body: [
        "PUBLICATION AGREEMENT",
        "",
        "This agreement is between {{authorName}} (\u201CAuthor\u201D) and {{publicationName}} (\u201CPublisher\u201D).",
        "",
        "The Author grants the Publisher first North American serial rights to the work titled \u201C{{title}}\u201D for publication in {{issueName}}.",
        "",
        "Rights revert to the Author 90 days after publication.",
        "",
        "Compensation: {{paymentAmount}}",
        "",
        "Date: {{date}}",
        "",
        "Author signature: ________________________",
        "Editor signature: ________________________",
      ].join("\n"),
      mergeFields: [
        { key: "authorName", label: "Author Name", source: "auto" as const },
        { key: "title", label: "Work Title", source: "auto" as const },
        {
          key: "publicationName",
          label: "Publication Name",
          source: "auto" as const,
          defaultValue: "The Meridian Review",
        },
        { key: "issueName", label: "Issue Name", source: "auto" as const },
        {
          key: "paymentAmount",
          label: "Payment Amount",
          source: "manual" as const,
        },
        { key: "date", label: "Date", source: "auto" as const },
      ],
      isDefault: true,
    })
    .returning();

  await tx.insert(contracts).values({
    organizationId: meridian!.id,
    pipelineItemId: poemPipeItem!.id,
    contractTemplateId: contractTemplate!.id,
    status: "SIGNED",
    renderedBody: [
      "PUBLICATION AGREEMENT",
      "",
      "This agreement is between Elena Vasquez (\u201CAuthor\u201D) and The Meridian Review (\u201CPublisher\u201D).",
      "",
      "The Author grants the Publisher first North American serial rights to the work titled \u201CTidewater Elegies\u201D for publication in Spring 2026.",
      "",
      "Rights revert to the Author 90 days after publication.",
      "",
      "Compensation: $150.00",
      "",
      `Date: ${new Date().toISOString().split("T")[0]}`,
      "",
      "Author signature: Elena Vasquez",
      "Editor signature: ________________________",
    ].join("\n"),
    mergeData: {
      authorName: "Elena Vasquez",
      title: "Tidewater Elegies",
      publicationName: "The Meridian Review",
      issueName: "Spring 2026",
      paymentAmount: "$150.00",
      date: new Date().toISOString().split("T")[0],
    },
    signedAt: daysAgo(1),
  });

  console.log("  Contract: 1 (SIGNED)");

  // =========================================================================
  // ISSUE ASSEMBLY
  // =========================================================================
  const [springIssue] = await tx
    .insert(issues)
    .values({
      organizationId: meridian!.id,
      publicationId: meridianPub!.id,
      title: "Spring 2026",
      volume: 12,
      issueNumber: 1,
      description:
        "The Spring 2026 issue featuring new poetry, fiction, and essays.",
      status: "ASSEMBLING",
      publicationDate: daysFromNow(45),
    })
    .returning();

  const [poetrySection] = await tx
    .insert(issueSections)
    .values({ issueId: springIssue!.id, title: "Poetry", sortOrder: 0 })
    .returning();

  const [fictionSection] = await tx
    .insert(issueSections)
    .values({ issueId: springIssue!.id, title: "Fiction", sortOrder: 1 })
    .returning();

  await tx.insert(issueItems).values([
    {
      issueId: springIssue!.id,
      pipelineItemId: poemPipeItem!.id,
      issueSectionId: poetrySection!.id,
      sortOrder: 0,
    },
    {
      issueId: springIssue!.id,
      pipelineItemId: fictionPipeItem!.id,
      issueSectionId: fictionSection!.id,
      sortOrder: 0,
    },
  ]);

  console.log("  Issue: Spring 2026 (ASSEMBLING), 2 sections, 2 items");

  // =========================================================================
  // CMS CONNECTION
  // =========================================================================
  await tx.insert(cmsConnections).values({
    organizationId: meridian!.id,
    publicationId: meridianPub!.id,
    adapterType: "GHOST",
    name: "Meridian Review Website",
    config: {
      siteUrl: "https://meridianreview.example.com",
      contentApiKey: "demo-content-key",
      adminApiKey: "demo-admin-key",
    },
    isActive: true,
  });

  console.log("  CMS connection: 1 (Ghost)");

  // =========================================================================
  // CONTRIBUTORS & PAYMENTS (Business Ops)
  // =========================================================================
  const [contributorRecord] = await tx
    .insert(contributors)
    .values({
      organizationId: meridian!.id,
      userId: writer!.id,
      displayName: "Elena Vasquez",
      bio: "Elena Vasquez is a poet and essayist from the Carolina coast. Her work has appeared in Ploughshares, The Southern Review, and AGNI.",
      pronouns: "she/her",
      email: "elena.vasquez@example.com",
      website: "https://elenavasquez.example.com",
      mailingAddress: "123 Marsh Lane\nBeaufort, SC 29902",
    })
    .returning();

  // Link contributor to pipeline item
  await tx.insert(contributorPublications).values({
    contributorId: contributorRecord!.id,
    pipelineItemId: poemPipeItem!.id,
    role: "author",
    displayOrder: 0,
  });

  // Rights agreement
  await tx.insert(rightsAgreements).values({
    organizationId: meridian!.id,
    contributorId: contributorRecord!.id,
    pipelineItemId: poemPipeItem!.id,
    rightsType: "first_north_american_serial",
    status: "SIGNED",
    grantedAt: daysAgo(1),
    expiresAt: daysFromNow(90),
  });

  // Contributor payment
  await tx.insert(paymentTransactions).values({
    organizationId: meridian!.id,
    contributorId: contributorRecord!.id,
    type: "contributor_payment",
    direction: "outbound",
    amount: 15000, // $150.00 in cents
    currency: "usd",
    status: "SUCCEEDED",
    description:
      "Payment for \u201CTidewater Elegies\u201D — Spring 2026 issue",
    processedAt: daysAgo(1),
  });

  console.log("  Contributor: 1, rights agreement: 1, payment: $150.00");

  // =========================================================================
  // EDITOR WORKSPACE — reading collection with position restoration
  // =========================================================================
  const [readingList] = await tx
    .insert(workspaceCollections)
    .values({
      organizationId: meridian!.id,
      ownerId: meridianEditor!.id,
      name: "Spring 2026 — First Read",
      description: "Submissions for first-read review this period.",
      visibility: "team",
      typeHint: "reading_list",
    })
    .returning();

  await tx.insert(workspaceItems).values([
    {
      collectionId: readingList!.id,
      submissionId: meridianSub!.id,
      position: 0,
      readingAnchor: { nodeIndex: 8 }, // Mid-poem — reading position saved
      notes: "Strong sequence. Return to the third poem.",
    },
    {
      collectionId: readingList!.id,
      submissionId: fictionSub!.id,
      position: 1,
    },
  ]);

  console.log(
    "  Editor workspace: 1 collection, 2 items (with reading position)",
  );

  console.log("\nDemo seed complete.");
  console.log("\n--- Demo accounts ---");
  console.log(
    "  Writer:   elena.vasquez@example.com (demo-zitadel-writer-001)",
  );
  console.log(
    "  Editor:   margaret.chen@meridianreview.org (demo-zitadel-meridian-editor-001)",
  );
  console.log(
    "  Reader:   james.okoro@meridianreview.org (demo-zitadel-meridian-reader-001)",
  );
  console.log("\n--- Key flows ---");
  console.log(
    '  Writer dashboard: "Tidewater Elegies" at 3 magazines (1 Accepted, 2 pending)',
  );
  console.log("  Editor queue: Meridian Review submissions queue");
  console.log(
    "  Pipeline: Contract signed, copyedit in progress, issue assembling",
  );
}

// ---------------------------------------------------------------------------
// CLI entry point
// ---------------------------------------------------------------------------
async function main() {
  const existing = await db
    .select({ id: organizations.id })
    .from(organizations)
    .where(eq(organizations.slug, "meridian-review"))
    .limit(1);

  if (existing.length > 0) {
    console.log(
      "Demo data already exists (meridian-review org found). Skipping.",
    );
    console.log("Run `pnpm db:reset && pnpm db:seed:demo` to start fresh.");
    return;
  }

  await db.transaction(async (tx) => {
    await seedDemo(tx as unknown as DrizzleDb);
  });
}

main()
  .catch((e) => {
    console.error("Demo seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await pool.end();
  });
