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
import {
  organizations,
  users,
  organizationMembers,
  submissionPeriods,
  submissions,
  submissionFiles,
  submissionHistory,
  payments,
  apiKeys,
  auditEvents,
  retentionPolicies,
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
// Date helpers
// ---------------------------------------------------------------------------
const now = new Date();
const daysAgo = (n: number) => new Date(now.getTime() - n * 86_400_000);
const daysFromNow = (n: number) => new Date(now.getTime() + n * 86_400_000);

async function main() {
  // Idempotency check
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
        description:
          "Open call for poetry and short fiction, up to 5,000 words.",
        opensAt: daysAgo(14),
        closesAt: daysFromNow(45),
        fee: "5.00",
        maxSubmissions: 500,
      })
      .returning();

    await tx.insert(submissionPeriods).values({
      organizationId: org1!.id,
      name: "Winter 2025 Reading Period",
      description: "Closed. Thank you for your submissions.",
      opensAt: daysAgo(120),
      closesAt: daysAgo(60),
      fee: "3.00",
      maxSubmissions: 300,
    });

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

    // ----- Submission Files (on the SUBMITTED submission) -----
    await tx.insert(submissionFiles).values([
      {
        submissionId: submittedSub!.id,
        filename: "the-weight-of-small-things.pdf",
        mimeType: "application/pdf",
        size: 245_760,
        storageKey: `submissions/${org1!.id}/${submittedSub!.id}/the-weight-of-small-things.pdf`,
        scanStatus: "CLEAN",
        scannedAt: daysAgo(4),
      },
      {
        submissionId: submittedSub!.id,
        filename: "cover-letter.pdf",
        mimeType: "application/pdf",
        size: 51_200,
        storageKey: `submissions/${org1!.id}/${submittedSub!.id}/cover-letter.pdf`,
        scanStatus: "CLEAN",
        scannedAt: daysAgo(4),
      },
    ]);

    console.log("  Submission files: 2");

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
  });

  console.log("\nSeed complete.");
  console.log(`\nSeed API key (quarterly-review, read-only): ${SEED_API_KEY}`);
}

main()
  .catch((e) => {
    console.error("Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await pool.end();
  });
