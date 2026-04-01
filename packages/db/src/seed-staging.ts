/**
 * Staging seed — comprehensive demo/test data for staging and QA.
 *
 * Calls the base seed (seedBase), then layers rich data across all feature
 * areas: forms, editorial workflow, analytics-worthy submission volume,
 * writer workspace, federation, notifications, webhooks, and more.
 *
 * Runs as superuser (DATABASE_URL) so RLS does not apply.
 * Idempotent: skips if staging data already exists (org1 settings.stagingSeeded).
 *
 * Usage: pnpm --filter @colophony/db seed:staging
 */

import {
  createHash,
  generateKeyPairSync,
  randomInt as cryptoRandomInt,
} from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { db, pool } from "./client";
import type { DrizzleDb } from "./context";
import { seedBase, daysAgo } from "./seed";
import {
  proseFictionDoc,
  poetryDoc,
  creativeNonfictionDoc,
} from "./seed-content";
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
  formDefinitions,
  formPages,
  formFields,
  submissionReviewers,
  submissionDiscussions,
  submissionVotes,
  publications,
  contractTemplates,
  issues,
  issueSections,
  pipelineItems,
  pipelineComments,
  pipelineHistory,
  emailTemplates,
  notificationPreferences,
  notificationsInbox,
  webhookEndpoints,
  webhookDeliveries,
  journalDirectory,
  externalSubmissions,
  correspondence,
  writerProfiles,
  federationConfig,
  trustedPeers,
  embedTokens,
  savedQueuePresets,
  userConsents,
  contributors,
  contributorPublications,
  rightsAgreements,
  paymentTransactions,
  contestGroups,
  simsubGroups,
  simsubGroupSubmissions,
  portfolioEntries,
  readerFeedback,
  workspaceCollections,
  workspaceItems,
} from "./schema";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function randomInt(min: number, max: number): number {
  return cryptoRandomInt(min, max + 1);
}

function randomFrom<T>(arr: T[]): T {
  return arr[cryptoRandomInt(0, arr.length)]!;
}

/** Generate an Ed25519 keypair in PEM format */
function generateEd25519() {
  const { publicKey, privateKey } = generateKeyPairSync("ed25519");
  return {
    publicKey: publicKey.export({ type: "spki", format: "pem" }) as string,
    privateKey: privateKey.export({ type: "pkcs8", format: "pem" }) as string,
  };
}

// ---------------------------------------------------------------------------
// Curated content for realistic submissions
// ---------------------------------------------------------------------------

const SUBMISSION_TITLES = [
  "Meridians of Light",
  "What the River Remembers",
  "A Catalogue of Vanishing",
  "The Beekeeper's Almanac",
  "Trespass",
  "Notes Toward a Theory of Grief",
  "The Cartographer's Wife",
  "Vespers at Low Tide",
  "Small Gods of the Kitchen",
  "The Understudy",
  "Lacuna",
  "Praise Song for the Morning",
  "After the Orchard",
  "The Emigrant's Compass",
  "Foxglove",
  "The Museum of Lost Causes",
  "Saltwater Liturgy",
  "Instructions for Departure",
  "The Naturalist's Notebook",
  "An Incomplete Map of Tenderness",
  "The Lamplighter's Daughter",
  "Threshing",
  "Birdsong in a Minor Key",
  "The Glass Menagerie of Memory",
  "At the Edge of the Clearing",
  "Nocturne for a Demolished House",
  "The Correspondence",
  "Watershed",
  "What We Carry When We Go",
  "The Archivist's Dream",
  "Littoral",
  "A Field Guide to Longing",
  "The Porcelain Year",
  "Ember and Ash",
  "The Threadbare Season",
  "Matins",
  "At the Mouth of the Cave",
  "Inventory of Absences",
  "The Watchmaker's Grief",
  "Tidal",
  "The Republic of Silence",
  "Crepuscule",
  "Ghost Nets",
  "The Apothecary's Garden",
  "Still Life with Smoke",
  "The Mapmaker's Error",
  "Canticle",
  "Where the Fence Line Ends",
  "The Vintner's Calendar",
  "At Rest in Moving Water",
  "The Book of Hours",
  "Chimera",
  "Root Systems",
  "The Ornithologist's Confession",
  "Palimpsest",
  "Song for a Difficult Country",
  "The Upholsterer's Art",
  "Winter Fen",
  "A Theory of Ruins",
  "Tidepool",
  "The Taxidermist's Sorrow",
  "Equinox",
  "The Hedgerow Psalms",
  "Undertow",
  "The Lapidary's Secret",
  "Compline",
  "At the Heart of the Gyre",
  "The Papermaker's Lament",
  "Solstice",
  "The Spindle Tree",
  "Marginal Notes",
  "The Chandler's Wife",
  "Backwater",
  "A Bestiary of Small Griefs",
];

const SUBMISSION_STATUSES_SPRING = [
  ...Array(7).fill("SUBMITTED"),
  ...Array(6).fill("UNDER_REVIEW"),
  ...Array(3).fill("ACCEPTED"),
  ...Array(7).fill("REJECTED"),
  ...Array(2).fill("HOLD"),
  ...Array(2).fill("WITHDRAWN"),
  ...Array(1).fill("REVISE_AND_RESUBMIT"),
] as const;

const SUBMISSION_STATUSES_WINTER = [
  ...Array(10).fill("ACCEPTED"),
  ...Array(15).fill("REJECTED"),
  ...Array(3).fill("WITHDRAWN"),
  ...Array(2).fill("HOLD"),
] as const;

const SUBMISSION_STATUSES_INKWELL = [
  ...Array(4).fill("SUBMITTED"),
  ...Array(3).fill("UNDER_REVIEW"),
  ...Array(2).fill("ACCEPTED"),
  ...Array(4).fill("REJECTED"),
  ...Array(1).fill("HOLD"),
  ...Array(1).fill("WITHDRAWN"),
  ...Array(1).fill("REVISE_AND_RESUBMIT"),
] as const;

const JOURNAL_NAMES: {
  name: string;
  url: string;
  ids: Record<string, string>;
}[] = [
  {
    name: "The Paris Review",
    url: "https://www.theparisreview.org",
    ids: { chillsubs: "paris-review" },
  },
  {
    name: "Ploughshares",
    url: "https://www.pshares.org",
    ids: { chillsubs: "ploughshares" },
  },
  { name: "Granta", url: "https://granta.com", ids: { chillsubs: "granta" } },
  {
    name: "Tin House",
    url: "https://tinhouse.com",
    ids: { chillsubs: "tin-house" },
  },
  {
    name: "The Kenyon Review",
    url: "https://kenyonreview.org",
    ids: { chillsubs: "kenyon-review", duotrope: "kr-001" },
  },
  {
    name: "AGNI",
    url: "https://agnionline.bu.edu",
    ids: { chillsubs: "agni" },
  },
  {
    name: "The Georgia Review",
    url: "https://thegeorgiareview.com",
    ids: { chillsubs: "georgia-review" },
  },
  {
    name: "Narrative Magazine",
    url: "https://www.narrativemagazine.com",
    ids: { chillsubs: "narrative" },
  },
  {
    name: "Conjunctions",
    url: "https://www.conjunctions.com",
    ids: { chillsubs: "conjunctions" },
  },
  {
    name: "The Gettysburg Review",
    url: "https://www.gettysburgreview.com",
    ids: { chillsubs: "gettysburg-review" },
  },
  {
    name: "The Southern Review",
    url: "https://thesouthernreview.org",
    ids: { chillsubs: "southern-review" },
  },
  {
    name: "Prairie Schooner",
    url: "https://prairieschooner.unl.edu",
    ids: { chillsubs: "prairie-schooner" },
  },
  {
    name: "The Missouri Review",
    url: "https://www.missourireview.com",
    ids: { chillsubs: "missouri-review" },
  },
  {
    name: "Zyzzyva",
    url: "https://www.zyzzyva.org",
    ids: { chillsubs: "zyzzyva" },
  },
  {
    name: "One Story",
    url: "https://www.one-story.com",
    ids: { chillsubs: "one-story" },
  },
];

const DISCUSSION_COMMENTS = [
  "Strong opening — the imagery in the first paragraph is striking.",
  "I think this needs tighter editing in the middle section. The pacing slows around the midpoint.",
  "Agree with the above. The ending, however, is very strong.",
  "I'm not sure the metaphor in section three quite lands. Thoughts?",
  "This is one of the best submissions we've received this period.",
  "The voice is distinctive but I wonder if it's consistent throughout.",
  "Love the structure here — the fragmented sections mirror the theme beautifully.",
  "Technically accomplished but it left me emotionally cold.",
  "I'd recommend accepting this with minor revisions to the final stanza.",
  "The research is evident without being heavy-handed. Well-crafted essay.",
  "We should discuss this one at the next editorial meeting.",
  "Reminds me of early Claudia Rankine. Very promising.",
  "The line breaks in the poetry feel deliberate and effective.",
  "This would be a perfect fit for the Spring issue's theme.",
  "Not quite right for us, but this writer clearly has talent.",
];

// ---------------------------------------------------------------------------
// Main staging seed
// ---------------------------------------------------------------------------

async function main() {
  // Idempotency: check if staging data was already seeded
  const existing = await db
    .select({ settings: organizations.settings })
    .from(organizations)
    .where(eq(organizations.slug, "quarterly-review"))
    .limit(1);

  if (
    existing.length > 0 &&
    (existing[0]!.settings as Record<string, unknown>)?.stagingSeeded === true
  ) {
    console.log("Staging seed data already exists. Skipping.");
    return;
  }

  // Check if base seed already ran (org exists but no stagingSeeded flag)
  const baseAlreadyRan = existing.length > 0;

  console.log("Seeding staging data...\n");

  await db.transaction(async (rawTx) => {
    const tx = rawTx as unknown as DrizzleDb;

    // -----------------------------------------------------------------------
    // Run base seed first, or load existing entities if base already ran
    // -----------------------------------------------------------------------
    let base: import("./seed").SeedResult;

    if (baseAlreadyRan) {
      console.log("  Base seed already present — loading existing entities.\n");
      // Query all the entities that seedBase() would have created
      const [org1] = await tx
        .select()
        .from(organizations)
        .where(eq(organizations.slug, "quarterly-review"));
      const [org2] = await tx
        .select()
        .from(organizations)
        .where(eq(organizations.slug, "inkwell-press"));
      const [adminUser] = await tx
        .select()
        .from(users)
        .where(eq(users.email, "editor@quarterlyreview.org"));
      const [editorUser] = await tx
        .select()
        .from(users)
        .where(eq(users.email, "reader@quarterlyreview.org"));
      const [writerUser] = await tx
        .select()
        .from(users)
        .where(eq(users.email, "writer@example.com"));
      const [inkwellAdmin] = await tx
        .select()
        .from(users)
        .where(eq(users.email, "admin@inkwellpress.org"));
      const [openPeriod] = await tx
        .select()
        .from(submissionPeriods)
        .where(eq(submissionPeriods.name, "Spring 2026 Reading Period"));
      const [winterPeriod] = await tx
        .select()
        .from(submissionPeriods)
        .where(eq(submissionPeriods.name, "Winter 2025 Reading Period"));
      const [inkwellPeriod] = await tx
        .select()
        .from(submissionPeriods)
        .where(eq(submissionPeriods.name, "Open Submissions 2026"));
      const [submittedSub] = await tx
        .select()
        .from(submissions)
        .where(eq(submissions.title, "The Weight of Small Things"));
      const [underReviewSub] = await tx
        .select()
        .from(submissions)
        .where(eq(submissions.title, "Cartography of Absence"));
      const [acceptedSub] = await tx
        .select()
        .from(submissions)
        .where(eq(submissions.title, "Field Notes on Disappearing"));
      const [acceptedSub2] = await tx
        .select()
        .from(submissions)
        .where(eq(submissions.title, "The Architecture of Longing"));
      const [manuscript1] = await tx
        .select()
        .from(manuscripts)
        .where(eq(manuscripts.title, "The Weight of Small Things"));
      const [version1] = await tx
        .select()
        .from(manuscriptVersions)
        .where(eq(manuscriptVersions.manuscriptId, manuscript1!.id));
      const [pub1] = await tx
        .select()
        .from(publications)
        .where(eq(publications.slug, "the-quarterly-review"));
      const [pub2] = await tx
        .select()
        .from(publications)
        .where(eq(publications.slug, "quarterly-online"));
      const allPipeItems = await tx
        .select()
        .from(pipelineItems)
        .where(eq(pipelineItems.organizationId, org1!.id));
      const pipeItem1 = allPipeItems.find(
        (p) => p.submissionId === acceptedSub!.id,
      )!;
      const pipeItem2 = allPipeItems.find(
        (p) => p.submissionId === acceptedSub2!.id,
      )!;
      const [template1] = await tx
        .select()
        .from(contractTemplates)
        .where(eq(contractTemplates.organizationId, org1!.id));
      const [issue1] = await tx
        .select()
        .from(issues)
        .where(eq(issues.title, "Spring 2026"));
      const allSections = await tx
        .select()
        .from(issueSections)
        .where(eq(issueSections.issueId, issue1!.id));
      const poetrySection = allSections.find((s) => s.title === "Poetry")!;
      const fictionSection = allSections.find((s) => s.title === "Fiction")!;

      base = {
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
        pipeItem1,
        pipeItem2,
        template1: template1!,
        issue1: issue1!,
        poetrySection,
        fictionSection,
      };
    } else {
      base = await seedBase(tx);
      console.log("  Base seed complete.\n");
    }

    // -----------------------------------------------------------------------
    // Section A: Additional users
    // -----------------------------------------------------------------------
    const [writer2] = await tx
      .insert(users)
      .values({
        email: "poet@example.com",
        zitadelUserId: "seed-zitadel-writer-002",
        emailVerified: true,
        emailVerifiedAt: daysAgo(60),
      })
      .returning();

    const [writer3] = await tx
      .insert(users)
      .values({
        email: "novelist@example.com",
        zitadelUserId: "seed-zitadel-writer-003",
        emailVerified: true,
        emailVerifiedAt: daysAgo(45),
      })
      .returning();

    const [writer4] = await tx
      .insert(users)
      .values({
        email: "essayist@example.com",
        zitadelUserId: "seed-zitadel-writer-004",
        emailVerified: true,
        emailVerifiedAt: daysAgo(30),
      })
      .returning();

    const [writer5] = await tx
      .insert(users)
      .values({
        email: "playwright@example.com",
        zitadelUserId: "seed-zitadel-writer-005",
        emailVerified: true,
        emailVerifiedAt: daysAgo(20),
      })
      .returning();

    const [editor2] = await tx
      .insert(users)
      .values({
        email: "poetry-editor@quarterlyreview.org",
        zitadelUserId: "seed-zitadel-editor-002",
        emailVerified: true,
        emailVerifiedAt: daysAgo(90),
      })
      .returning();

    const [editor3] = await tx
      .insert(users)
      .values({
        email: "fiction-editor@quarterlyreview.org",
        zitadelUserId: "seed-zitadel-editor-003",
        emailVerified: true,
        emailVerifiedAt: daysAgo(85),
      })
      .returning();

    // Add new editors to org1
    await tx.insert(organizationMembers).values([
      { organizationId: base.org1.id, userId: editor2!.id, roles: ["EDITOR"] },
      { organizationId: base.org1.id, userId: editor3!.id, roles: ["EDITOR"] },
    ]);

    // -----------------------------------------------------------------------
    // E2E test user — ensure it exists in the DB and is an ADMIN in both orgs.
    // The Zitadel setup script creates this user in Zitadel, but the DB record
    // only appears after first login (webhook sync). We upsert here so the
    // staging site is demo-ready without requiring a prior login.
    //
    // Credentials: e2e-test@colophony.dev / E2eTestPassword1!
    // -----------------------------------------------------------------------
    const E2E_EMAIL = "e2e-test@colophony.dev";

    // Check if the user already exists (created by Zitadel webhook on first login)
    let [e2eUser] = await tx
      .select()
      .from(users)
      .where(eq(users.email, E2E_EMAIL));

    if (!e2eUser) {
      [e2eUser] = await tx
        .insert(users)
        .values({
          email: E2E_EMAIL,
          zitadelUserId: "seed-zitadel-e2e-001",
          emailVerified: true,
          emailVerifiedAt: daysAgo(1),
        })
        .returning();
    }

    // Ensure ADMIN membership in both orgs (idempotent — skip if already a member)
    for (const org of [base.org1, base.org2]) {
      const [existing] = await tx
        .select({ id: organizationMembers.id })
        .from(organizationMembers)
        .where(
          sql`${organizationMembers.organizationId} = ${org.id} AND ${organizationMembers.userId} = ${e2eUser!.id}`,
        );

      if (!existing) {
        await tx.insert(organizationMembers).values({
          organizationId: org.id,
          userId: e2eUser!.id,
          roles: ["ADMIN"],
        });
      }
    }

    // Create submissions owned by the E2E user (writer POV for portfolio/tracker)
    const e2eSubmissionData = [
      {
        title: "The Librarian's Ghost",
        status: "ACCEPTED" as const,
        daysBack: 45,
      },
      {
        title: "Ode to a Broken Window",
        status: "UNDER_REVIEW" as const,
        daysBack: 12,
      },
      {
        title: "What the Sparrows Know",
        status: "REJECTED" as const,
        daysBack: 90,
      },
      {
        title: "The Cartographer's Apprentice",
        status: "SUBMITTED" as const,
        daysBack: 5,
      },
      {
        title: "Still Life with Bees",
        status: "REVISE_AND_RESUBMIT" as const,
        daysBack: 30,
      },
    ];

    for (const [subIdx, sub] of e2eSubmissionData.entries()) {
      const [s] = await tx
        .insert(submissions)
        .values({
          organizationId: base.org1.id,
          submitterId: e2eUser!.id,
          submissionPeriodId: base.openPeriod.id,
          title: sub.title,
          content: `Submission text for "${sub.title}".`,
          coverLetter: `Dear Editors, please consider "${sub.title}" for publication.`,
          status: sub.status,
          submittedAt: daysAgo(sub.daysBack),
        })
        .returning();

      // Manuscript + version for each — cycle genres and extraction statuses
      const genreBuilders = [proseFictionDoc, poetryDoc, creativeNonfictionDoc];
      const genreNames = ["fiction", "poetry", "creative_nonfiction"] as const;
      const genreIdx = subIdx % genreBuilders.length;
      const [ms] = await tx
        .insert(manuscripts)
        .values({
          ownerId: e2eUser!.id,
          title: sub.title,
          genre: { primary: genreNames[genreIdx], sub: null, hybrid: [] },
        })
        .returning();
      // ~70% COMPLETE, ~15% PENDING, ~15% FAILED
      const extractionStatus =
        subIdx % 7 === 0
          ? ("FAILED" as const)
          : subIdx % 7 === 3
            ? ("PENDING" as const)
            : ("COMPLETE" as const);
      const doc =
        extractionStatus === "COMPLETE" ? genreBuilders[genreIdx]() : undefined;
      const [ver] = await tx
        .insert(manuscriptVersions)
        .values({
          manuscriptId: ms!.id,
          versionNumber: 1,
          label: "Submitted version",
          ...(doc
            ? {
                content: doc,
                contentFormat: "prosemirror_v1",
                contentExtractionStatus: "COMPLETE",
              }
            : { contentExtractionStatus: extractionStatus }),
        })
        .returning();
      await tx
        .update(submissions)
        .set({ manuscriptVersionId: ver!.id })
        .where(eq(submissions.id, s!.id));

      // History entries
      type AnyStatus =
        | "DRAFT"
        | "SUBMITTED"
        | "UNDER_REVIEW"
        | "ACCEPTED"
        | "REJECTED"
        | "HOLD"
        | "WITHDRAWN"
        | "REVISE_AND_RESUBMIT";
      const histories: {
        submissionId: string;
        fromStatus: AnyStatus | null;
        toStatus: AnyStatus;
        changedBy: string;
        changedAt: Date;
        comment?: string;
      }[] = [
        {
          submissionId: s!.id,
          fromStatus: "DRAFT" as const,
          toStatus: "SUBMITTED" as const,
          changedBy: e2eUser!.id,
          changedAt: daysAgo(sub.daysBack),
        },
      ];

      if (!["SUBMITTED", "DRAFT"].includes(sub.status)) {
        histories.push({
          submissionId: s!.id,
          fromStatus: "SUBMITTED" as const,
          toStatus: "UNDER_REVIEW" as const,
          changedBy: base.editorUser.id,
          changedAt: daysAgo(sub.daysBack - 3),
        });
      }

      if (
        ["ACCEPTED", "REJECTED", "REVISE_AND_RESUBMIT"].includes(sub.status)
      ) {
        histories.push({
          submissionId: s!.id,
          fromStatus: "UNDER_REVIEW" as const,
          toStatus: sub.status,
          changedBy: base.adminUser.id,
          changedAt: daysAgo(Math.max(1, sub.daysBack - 10)),
          comment:
            sub.status === "ACCEPTED"
              ? "Wonderful piece — accepted for the Spring issue."
              : sub.status === "REJECTED"
                ? "Thank you for submitting. Not the right fit this time."
                : "Strong work — we'd love to see a revised version addressing our notes.",
        });
      }

      await tx.insert(submissionHistory).values(histories);

      // Correspondence on the accepted submission
      if (sub.status === "ACCEPTED") {
        await tx.insert(correspondence).values({
          userId: e2eUser!.id,
          submissionId: s!.id,
          direction: "outbound",
          channel: "email",
          sentAt: daysAgo(Math.max(1, sub.daysBack - 12)),
          subject: `Acceptance: ${sub.title}`,
          body: `Dear writer, we are delighted to accept "${sub.title}" for publication in The Quarterly Review. We'll be in touch about next steps.`,
          senderName: "The Quarterly Review",
          senderEmail: "editor@quarterlyreview.org",
          isPersonalized: true,
          source: "auto",
        });
      }
    }

    // External submissions tracked by the E2E user (writer workspace tracker)
    const e2eExternalSubs = [
      {
        journal: "The Paris Review",
        status: "rejected" as const,
        daysBack: 120,
      },
      { journal: "Ploughshares", status: "sent" as const, daysBack: 8 },
      { journal: "Tin House", status: "accepted" as const, daysBack: 60 },
      { journal: "AGNI", status: "no_response" as const, daysBack: 150 },
      {
        journal: "Narrative Magazine",
        status: "in_review" as const,
        daysBack: 25,
      },
      {
        journal: "The Kenyon Review",
        status: "rejected" as const,
        daysBack: 95,
      },
    ];

    for (const ext of e2eExternalSubs) {
      await tx.insert(externalSubmissions).values({
        userId: e2eUser!.id,
        journalName: ext.journal,
        status: ext.status,
        sentAt: daysAgo(ext.daysBack),
        respondedAt: ["accepted", "rejected"].includes(ext.status)
          ? daysAgo(ext.daysBack - randomInt(20, 50))
          : null,
        method: "Submittable",
        notes: ext.status === "accepted" ? "Accepted for Fall issue!" : null,
      });
    }

    // Writer profile for the E2E user
    await tx.insert(writerProfiles).values({
      userId: e2eUser!.id,
      platform: "chillsubs",
      externalId: "e2e-demo-user",
      profileUrl: "https://chillsubs.com/user/e2e-demo",
    });

    console.log(
      `  E2E demo user: ${E2E_EMAIL} (ADMIN in both orgs, 5 submissions, 6 external, 1 profile)`,
    );

    // -----------------------------------------------------------------------
    // Section A2: Dev user writer-side data (david@mahaffey.me)
    //
    // The dev user typically exists from Zitadel login; if not, create it.
    // Adds writer-side submissions, manuscripts, and workspace data so the
    // account has content on both editor and writer sides.
    // -----------------------------------------------------------------------
    const DEV_EMAIL = "david@mahaffey.me";

    let [devUser] = await tx
      .select()
      .from(users)
      .where(eq(users.email, DEV_EMAIL));

    if (!devUser) {
      [devUser] = await tx
        .insert(users)
        .values({
          email: DEV_EMAIL,
          zitadelUserId: "seed-zitadel-dev-001",
          emailVerified: true,
          emailVerifiedAt: daysAgo(180),
        })
        .returning();
    }

    // Ensure membership in org1 (editor side already set up manually; this is
    // idempotent — skip if already a member)
    const [devMembership] = await tx
      .select({ id: organizationMembers.id })
      .from(organizationMembers)
      .where(
        sql`${organizationMembers.organizationId} = ${base.org1.id} AND ${organizationMembers.userId} = ${devUser!.id}`,
      );

    if (!devMembership) {
      await tx.insert(organizationMembers).values({
        organizationId: base.org1.id,
        userId: devUser!.id,
        roles: ["ADMIN"],
      });
    }

    // Writer-side submissions with manuscripts and full content
    const devSubmissionData = [
      {
        title: "The Apiarist's Lament",
        status: "ACCEPTED" as const,
        daysBack: 60,
        genre: "fiction" as const,
      },
      {
        title: "Nocturne for a Rust Belt Town",
        status: "UNDER_REVIEW" as const,
        daysBack: 14,
        genre: "poetry" as const,
      },
      {
        title: "On Forgetting How to Read",
        status: "SUBMITTED" as const,
        daysBack: 7,
        genre: "creative_nonfiction" as const,
      },
      {
        title: "Every House a Reliquary",
        status: "REJECTED" as const,
        daysBack: 110,
        genre: "fiction" as const,
      },
      {
        title: "Field Guide to Small Silences",
        status: "REVISE_AND_RESUBMIT" as const,
        daysBack: 35,
        genre: "poetry" as const,
      },
      {
        title: "The Secondhand Sublime",
        status: "ACCEPTED" as const,
        daysBack: 25,
        genre: "creative_nonfiction" as const,
      },
    ];

    const devGenreBuilderMap = {
      fiction: proseFictionDoc,
      poetry: poetryDoc,
      creative_nonfiction: creativeNonfictionDoc,
    } as const;

    for (const sub of devSubmissionData) {
      const [s] = await tx
        .insert(submissions)
        .values({
          organizationId: base.org1.id,
          submitterId: devUser!.id,
          submissionPeriodId: base.openPeriod.id,
          title: sub.title,
          content: `Submission text for "${sub.title}".`,
          coverLetter: `Dear Editors, please consider "${sub.title}" for publication.`,
          status: sub.status,
          submittedAt: daysAgo(sub.daysBack),
        })
        .returning();

      const [ms] = await tx
        .insert(manuscripts)
        .values({
          ownerId: devUser!.id,
          title: sub.title,
          genre: { primary: sub.genre, sub: null, hybrid: [] },
        })
        .returning();

      const [ver] = await tx
        .insert(manuscriptVersions)
        .values({
          manuscriptId: ms!.id,
          versionNumber: 1,
          label: "Submitted version",
          content: devGenreBuilderMap[sub.genre](),
          contentFormat: "prosemirror_v1",
          contentExtractionStatus: "COMPLETE",
        })
        .returning();

      await tx
        .update(submissions)
        .set({ manuscriptVersionId: ver!.id })
        .where(eq(submissions.id, s!.id));

      // History entries
      type AnyStatus =
        | "DRAFT"
        | "SUBMITTED"
        | "UNDER_REVIEW"
        | "ACCEPTED"
        | "REJECTED"
        | "HOLD"
        | "WITHDRAWN"
        | "REVISE_AND_RESUBMIT";
      const histories: {
        submissionId: string;
        fromStatus: AnyStatus | null;
        toStatus: AnyStatus;
        changedBy: string;
        changedAt: Date;
        comment?: string;
      }[] = [
        {
          submissionId: s!.id,
          fromStatus: "DRAFT" as const,
          toStatus: "SUBMITTED" as const,
          changedBy: devUser!.id,
          changedAt: daysAgo(sub.daysBack),
        },
      ];

      if (!["SUBMITTED", "DRAFT"].includes(sub.status)) {
        histories.push({
          submissionId: s!.id,
          fromStatus: "SUBMITTED" as const,
          toStatus: "UNDER_REVIEW" as const,
          changedBy: base.editorUser.id,
          changedAt: daysAgo(sub.daysBack - 3),
        });
      }

      if (
        ["ACCEPTED", "REJECTED", "REVISE_AND_RESUBMIT"].includes(sub.status)
      ) {
        histories.push({
          submissionId: s!.id,
          fromStatus: "UNDER_REVIEW" as const,
          toStatus: sub.status,
          changedBy: base.adminUser.id,
          changedAt: daysAgo(Math.max(1, sub.daysBack - 10)),
          comment:
            sub.status === "ACCEPTED"
              ? "Accepted for publication."
              : sub.status === "REJECTED"
                ? "Thank you for submitting. Not the right fit for us."
                : "Strong work — we'd love a revised version.",
        });
      }

      await tx.insert(submissionHistory).values(histories);

      // Correspondence on accepted submissions
      if (sub.status === "ACCEPTED") {
        await tx.insert(correspondence).values({
          userId: devUser!.id,
          submissionId: s!.id,
          direction: "outbound",
          channel: "email",
          sentAt: daysAgo(Math.max(1, sub.daysBack - 12)),
          subject: `Acceptance: ${sub.title}`,
          body: `Dear writer, we are delighted to accept "${sub.title}" for publication in The Quarterly Review.`,
          senderName: "The Quarterly Review",
          senderEmail: "editor@quarterlyreview.org",
          isPersonalized: true,
          source: "auto",
        });
      }
    }

    // External submissions tracked by the dev user
    const devExternalSubs = [
      {
        journal: "Granta",
        status: "sent" as const,
        daysBack: 10,
      },
      {
        journal: "The Sewanee Review",
        status: "rejected" as const,
        daysBack: 85,
      },
      {
        journal: "A Public Space",
        status: "accepted" as const,
        daysBack: 50,
      },
    ];

    for (const ext of devExternalSubs) {
      await tx.insert(externalSubmissions).values({
        userId: devUser!.id,
        journalName: ext.journal,
        status: ext.status,
        sentAt: daysAgo(ext.daysBack),
        respondedAt: ["accepted", "rejected"].includes(ext.status)
          ? daysAgo(ext.daysBack - randomInt(15, 40))
          : null,
        method: "Submittable",
        notes: ext.status === "accepted" ? "Accepted for Spring issue." : null,
      });
    }

    console.log(
      `  Dev user: ${DEV_EMAIL} (ADMIN in org1, 6 submissions, 3 external)`,
    );

    const allWriters = [
      base.writerUser,
      writer2!,
      writer3!,
      writer4!,
      writer5!,
    ];
    const allEditors = [base.adminUser, base.editorUser, editor2!, editor3!];

    console.log("  Additional users: 6 (4 writers, 2 editors)");

    // -----------------------------------------------------------------------
    // Section B: Form definitions
    // -----------------------------------------------------------------------
    const [generalForm] = await tx
      .insert(formDefinitions)
      .values({
        organizationId: base.org1.id,
        name: "General Submission Form",
        status: "PUBLISHED",
        version: 1,
        createdBy: base.adminUser.id,
        publishedAt: daysAgo(30),
      })
      .returning();

    const [generalPage] = await tx
      .insert(formPages)
      .values({
        formDefinitionId: generalForm!.id,
        title: "Submission Details",
        sortOrder: 0,
      })
      .returning();

    await tx.insert(formFields).values([
      {
        formDefinitionId: generalForm!.id,
        pageId: generalPage!.id,
        fieldKey: "title",
        fieldType: "text",
        label: "Title of Work",
        required: true,
        sortOrder: 0,
      },
      {
        formDefinitionId: generalForm!.id,
        pageId: generalPage!.id,
        fieldKey: "genre",
        fieldType: "select",
        label: "Genre",
        required: true,
        sortOrder: 1,
        config: {
          options: ["Poetry", "Fiction", "Creative Nonfiction", "Translation"],
        },
      },
      {
        formDefinitionId: generalForm!.id,
        pageId: generalPage!.id,
        fieldKey: "cover_letter",
        fieldType: "textarea",
        label: "Cover Letter",
        required: true,
        sortOrder: 2,
        placeholder: "Introduce your work...",
      },
      {
        formDefinitionId: generalForm!.id,
        pageId: generalPage!.id,
        fieldKey: "bio",
        fieldType: "textarea",
        label: "Author Bio",
        required: true,
        sortOrder: 3,
        placeholder: "Brief bio (100 words)...",
      },
      {
        formDefinitionId: generalForm!.id,
        pageId: generalPage!.id,
        fieldKey: "simultaneous_submission",
        fieldType: "checkbox",
        label: "This is a simultaneous submission",
        sortOrder: 4,
      },
      {
        formDefinitionId: generalForm!.id,
        pageId: generalPage!.id,
        fieldKey: "word_count",
        fieldType: "number",
        label: "Word Count",
        required: true,
        sortOrder: 5,
      },
      {
        formDefinitionId: generalForm!.id,
        pageId: generalPage!.id,
        fieldKey: "previous_publications",
        fieldType: "textarea",
        label: "Previous Publications",
        sortOrder: 6,
      },
      {
        formDefinitionId: generalForm!.id,
        pageId: generalPage!.id,
        fieldKey: "agree_terms",
        fieldType: "checkbox",
        label: "I agree to the submission terms",
        required: true,
        sortOrder: 7,
      },
    ]);

    // Link Spring period to general form
    await tx
      .update(submissionPeriods)
      .set({ formDefinitionId: generalForm!.id })
      .where(eq(submissionPeriods.id, base.openPeriod.id));

    // Poetry form (2 pages)
    const [poetryForm] = await tx
      .insert(formDefinitions)
      .values({
        organizationId: base.org1.id,
        name: "Poetry Submission Form",
        status: "PUBLISHED",
        version: 1,
        createdBy: base.adminUser.id,
        publishedAt: daysAgo(25),
      })
      .returning();

    const [poetryPage1] = await tx
      .insert(formPages)
      .values({
        formDefinitionId: poetryForm!.id,
        title: "Poem Details",
        sortOrder: 0,
      })
      .returning();

    const [poetryPage2] = await tx
      .insert(formPages)
      .values({
        formDefinitionId: poetryForm!.id,
        title: "About You",
        sortOrder: 1,
      })
      .returning();

    await tx.insert(formFields).values([
      {
        formDefinitionId: poetryForm!.id,
        pageId: poetryPage1!.id,
        fieldKey: "title",
        fieldType: "text",
        label: "Poem Title",
        required: true,
        sortOrder: 0,
      },
      {
        formDefinitionId: poetryForm!.id,
        pageId: poetryPage1!.id,
        fieldKey: "poet_statement",
        fieldType: "textarea",
        label: "Poet's Statement",
        sortOrder: 1,
      },
      {
        formDefinitionId: poetryForm!.id,
        pageId: poetryPage1!.id,
        fieldKey: "poem_count",
        fieldType: "number",
        label: "Number of Poems",
        required: true,
        sortOrder: 2,
      },
      {
        formDefinitionId: poetryForm!.id,
        pageId: poetryPage2!.id,
        fieldKey: "bio",
        fieldType: "textarea",
        label: "Bio",
        required: true,
        sortOrder: 0,
      },
      {
        formDefinitionId: poetryForm!.id,
        pageId: poetryPage2!.id,
        fieldKey: "previous_publications",
        fieldType: "textarea",
        label: "Previous Publications",
        sortOrder: 1,
      },
    ]);

    // Contest form (draft)
    await tx.insert(formDefinitions).values({
      organizationId: base.org1.id,
      name: "Contest Entry Form",
      status: "DRAFT",
      version: 1,
      createdBy: base.adminUser.id,
    });

    console.log("  Form definitions: 3 (2 published, 1 draft)");

    // -----------------------------------------------------------------------
    // Section C: Bulk submissions (~74 new)
    // -----------------------------------------------------------------------
    let titleIdx = 0;
    const allStagingSubs: (typeof submissions.$inferSelect)[] = [];

    type SubmissionStatus =
      | "DRAFT"
      | "SUBMITTED"
      | "UNDER_REVIEW"
      | "ACCEPTED"
      | "REJECTED"
      | "HOLD"
      | "WITHDRAWN"
      | "REVISE_AND_RESUBMIT";

    async function createBulkSubmissions(
      orgId: string,
      periodId: string,
      statuses: readonly string[],
      writerPool: (typeof users.$inferSelect)[],
      dayRange: [number, number],
    ) {
      for (const rawStatus of statuses) {
        const status = rawStatus as SubmissionStatus;
        const writer = randomFrom(writerPool);
        const title = SUBMISSION_TITLES[titleIdx % SUBMISSION_TITLES.length]!;
        titleIdx++;
        const submittedDays = randomInt(dayRange[0], dayRange[1]);

        const [sub] = await tx
          .insert(submissions)
          .values({
            organizationId: orgId,
            submitterId: writer.id,
            submissionPeriodId: periodId,
            title,
            content: `Submission content for "${title}".`,
            coverLetter: `Dear Editors, I am pleased to submit "${title}" for your consideration.`,
            status,
            submittedAt:
              status !== "DRAFT" ? daysAgo(submittedDays) : undefined,
          })
          .returning();

        allStagingSubs.push(sub!);

        // Create history entries based on status
        const histories: {
          submissionId: string;
          fromStatus: SubmissionStatus | null;
          toStatus: SubmissionStatus;
          changedBy: string;
          changedAt: Date;
          comment?: string;
        }[] = [];

        if (status !== "DRAFT") {
          histories.push({
            submissionId: sub!.id,
            fromStatus: "DRAFT" as SubmissionStatus,
            toStatus: "SUBMITTED" as SubmissionStatus,
            changedBy: writer.id,
            changedAt: daysAgo(submittedDays),
          });
        }

        if (
          [
            "UNDER_REVIEW",
            "ACCEPTED",
            "REJECTED",
            "HOLD",
            "WITHDRAWN",
            "REVISE_AND_RESUBMIT",
          ].includes(status)
        ) {
          histories.push({
            submissionId: sub!.id,
            fromStatus: "SUBMITTED" as SubmissionStatus,
            toStatus: "UNDER_REVIEW" as SubmissionStatus,
            changedBy: randomFrom(allEditors).id,
            changedAt: daysAgo(submittedDays - randomInt(1, 5)),
          });
        }

        if (
          ["ACCEPTED", "REJECTED", "HOLD", "REVISE_AND_RESUBMIT"].includes(
            status,
          )
        ) {
          histories.push({
            submissionId: sub!.id,
            fromStatus: "UNDER_REVIEW" as SubmissionStatus,
            toStatus: status as SubmissionStatus,
            changedBy: randomFrom(allEditors).id,
            changedAt: daysAgo(Math.max(1, submittedDays - randomInt(5, 15))),
            comment:
              status === "ACCEPTED"
                ? "Accepted for publication."
                : status === "REJECTED"
                  ? "Does not fit our current needs."
                  : status === "HOLD"
                    ? "Holding for further discussion."
                    : status === "REVISE_AND_RESUBMIT"
                      ? "Strong work — we'd like to see a revised version."
                      : undefined,
          });
        }

        if (status === "WITHDRAWN") {
          histories.push({
            submissionId: sub!.id,
            fromStatus: "UNDER_REVIEW" as SubmissionStatus,
            toStatus: "WITHDRAWN" as SubmissionStatus,
            changedBy: writer.id,
            changedAt: daysAgo(Math.max(1, submittedDays - randomInt(3, 10))),
            comment: "Withdrawn by author.",
          });
        }

        if (histories.length > 0) {
          await tx.insert(submissionHistory).values(histories);
        }

        // Create manuscript + version + file for non-draft submissions
        if (status !== "DRAFT") {
          const bulkGenreBuilders = [
            proseFictionDoc,
            poetryDoc,
            creativeNonfictionDoc,
          ];
          const bulkGenreNames = [
            "fiction",
            "poetry",
            "creative_nonfiction",
          ] as const;
          const gIdx = titleIdx % bulkGenreBuilders.length;

          const [ms] = await tx
            .insert(manuscripts)
            .values({
              ownerId: writer.id,
              title,
              description: `Manuscript for "${title}".`,
              genre: { primary: bulkGenreNames[gIdx], sub: null, hybrid: [] },
            })
            .returning();

          // ~60% COMPLETE, ~20% PENDING, ~10% FAILED, ~10% EXTRACTING
          const bulkExtractionStatus =
            titleIdx % 10 === 0
              ? ("FAILED" as const)
              : titleIdx % 10 === 5
                ? ("EXTRACTING" as const)
                : titleIdx % 5 === 0
                  ? ("PENDING" as const)
                  : ("COMPLETE" as const);
          const bulkDoc =
            bulkExtractionStatus === "COMPLETE"
              ? bulkGenreBuilders[gIdx]()
              : undefined;

          const [ver] = await tx
            .insert(manuscriptVersions)
            .values({
              manuscriptId: ms!.id,
              versionNumber: 1,
              label: "Submitted version",
              ...(bulkDoc
                ? {
                    content: bulkDoc,
                    contentFormat: "prosemirror_v1",
                    contentExtractionStatus: "COMPLETE",
                  }
                : { contentExtractionStatus: bulkExtractionStatus }),
            })
            .returning();

          await tx
            .update(submissions)
            .set({ manuscriptVersionId: ver!.id })
            .where(eq(submissions.id, sub!.id));

          await tx.insert(files).values({
            manuscriptVersionId: ver!.id,
            filename: `${title.toLowerCase().replace(/\s+/g, "-")}.pdf`,
            mimeType: "application/pdf",
            size: randomInt(50_000, 500_000),
            storageKey: `manuscripts/${writer.id}/${ms!.id}/v1/submission.pdf`,
            scanStatus: "CLEAN",
            scannedAt: daysAgo(submittedDays - 1),
          });
        }
      }
    }

    // Spring 2026 (open period, org1) — 28 new
    await createBulkSubmissions(
      base.org1.id,
      base.openPeriod.id,
      SUBMISSION_STATUSES_SPRING,
      allWriters,
      [3, 90],
    );

    // Winter 2025 (closed period, org1) — 30 new
    await createBulkSubmissions(
      base.org1.id,
      base.winterPeriod.id,
      SUBMISSION_STATUSES_WINTER,
      allWriters,
      [60, 180],
    );

    // Inkwell rolling (org2) — 16 new
    await createBulkSubmissions(
      base.org2.id,
      base.inkwellPeriod.id,
      SUBMISSION_STATUSES_INKWELL,
      [base.writerUser, writer2!, writer3!],
      [5, 120],
    );

    console.log(
      `  Submissions: ${allStagingSubs.length} new (${allStagingSubs.length + 6} total)`,
    );

    // -----------------------------------------------------------------------
    // Section D: Editorial workflow (reviewers, discussions, votes)
    // -----------------------------------------------------------------------
    // Get org1 submissions that are UNDER_REVIEW or later (not DRAFT/SUBMITTED)
    const reviewableSubs = allStagingSubs.filter(
      (s) =>
        s.organizationId === base.org1.id &&
        !["DRAFT", "SUBMITTED"].includes(s.status),
    );

    // Reviewer assignments — 2 reviewers per first 20 reviewable submissions
    const subsForReview = reviewableSubs.slice(0, 20);
    for (const sub of subsForReview) {
      const reviewers = [randomFrom(allEditors), randomFrom(allEditors)];
      // Ensure different reviewers
      if (reviewers[0]!.id === reviewers[1]!.id) {
        reviewers[1] = allEditors.find((e) => e.id !== reviewers[0]!.id)!;
      }

      for (const reviewer of reviewers) {
        await tx.insert(submissionReviewers).values({
          organizationId: base.org1.id,
          submissionId: sub.id,
          reviewerUserId: reviewer.id,
          assignedBy: base.adminUser.id,
          assignedAt: daysAgo(randomInt(1, 30)),
          readAt: Math.random() > 0.3 ? daysAgo(randomInt(1, 15)) : null,
        });
      }
    }

    console.log(`  Reviewer assignments: ${subsForReview.length * 2}`);

    // Discussion threads — 15 threads on 10 submissions (some with replies)
    const subsForDiscussion = reviewableSubs.slice(0, 10);
    let discussionCount = 0;
    for (let i = 0; i < subsForDiscussion.length; i++) {
      const sub = subsForDiscussion[i]!;
      const author = randomFrom(allEditors);
      const [thread] = await tx
        .insert(submissionDiscussions)
        .values({
          organizationId: base.org1.id,
          submissionId: sub.id,
          authorId: author.id,
          content: DISCUSSION_COMMENTS[i % DISCUSSION_COMMENTS.length]!,
          createdAt: daysAgo(randomInt(1, 20)),
        })
        .returning();
      discussionCount++;

      // Add replies to first 5 threads
      if (i < 5) {
        const replier = allEditors.find((e) => e.id !== author.id)!;
        await tx.insert(submissionDiscussions).values({
          organizationId: base.org1.id,
          submissionId: sub.id,
          authorId: replier.id,
          parentId: thread!.id,
          content: DISCUSSION_COMMENTS[(i + 5) % DISCUSSION_COMMENTS.length]!,
          createdAt: daysAgo(randomInt(1, 10)),
        });
        discussionCount++;
      }
    }

    console.log(`  Discussion comments: ${discussionCount}`);

    // Votes — 30 votes across 15 submissions
    const subsForVotes = reviewableSubs.slice(0, 15);
    const decisions = ["ACCEPT", "REJECT", "MAYBE"] as const;
    let voteCount = 0;
    for (const sub of subsForVotes) {
      const voters = [randomFrom(allEditors), randomFrom(allEditors)];
      if (voters[0]!.id === voters[1]!.id) {
        voters[1] = allEditors.find((e) => e.id !== voters[0]!.id)!;
      }
      for (const voter of voters) {
        await tx.insert(submissionVotes).values({
          organizationId: base.org1.id,
          submissionId: sub.id,
          voterUserId: voter.id,
          decision: randomFrom([...decisions]),
          score: String(randomInt(1, 10)),
        });
        voteCount++;
      }
    }

    console.log(`  Votes: ${voteCount}`);

    // -----------------------------------------------------------------------
    // Section E: Slate pipeline comments + additional pipeline items
    // -----------------------------------------------------------------------
    // Add comments to existing pipeline items
    await tx.insert(pipelineComments).values([
      {
        pipelineItemId: base.pipeItem1.id,
        authorId: base.editorUser.id,
        content:
          "Light copyedit needed — mostly punctuation and a few word choices.",
        stage: "COPYEDIT_IN_PROGRESS",
      },
      {
        pipelineItemId: base.pipeItem2.id,
        authorId: base.adminUser.id,
        content: "Proofread complete. Ready for layout.",
        stage: "READY_TO_PUBLISH",
      },
    ]);

    // Create pipeline items from newly accepted submissions
    const newAccepted = allStagingSubs.filter(
      (s) => s.status === "ACCEPTED" && s.organizationId === base.org1.id,
    );
    const pipelineStages = [
      "COPYEDIT_PENDING",
      "COPYEDIT_IN_PROGRESS",
      "AUTHOR_REVIEW",
      "PROOFREAD",
    ] as const;

    for (let i = 0; i < Math.min(4, newAccepted.length); i++) {
      const sub = newAccepted[i]!;
      const stage = pipelineStages[i % pipelineStages.length]!;
      const [pi] = await tx
        .insert(pipelineItems)
        .values({
          organizationId: base.org1.id,
          submissionId: sub.id,
          publicationId: base.pub1.id,
          stage,
          assignedCopyeditorId:
            stage === "COPYEDIT_IN_PROGRESS" ? base.editorUser.id : undefined,
        })
        .returning();

      await tx.insert(pipelineHistory).values({
        pipelineItemId: pi!.id,
        fromStage: null,
        toStage: stage,
        changedBy: base.adminUser.id,
        comment: "Moved to publication pipeline.",
        changedAt: daysAgo(randomInt(1, 10)),
      });
    }

    // Ensure pipeline items in copyedit-active stages have extracted content
    // (bulk creation uses a distribution that leaves ~40% without content)
    let contentFixups = 0;
    for (let i = 0; i < Math.min(4, newAccepted.length); i++) {
      const sub = newAccepted[i]!;
      if (!sub.manuscriptVersionId) continue;

      const [ver] = await tx
        .select()
        .from(manuscriptVersions)
        .where(eq(manuscriptVersions.id, sub.manuscriptVersionId));

      if (ver && ver.contentExtractionStatus !== "COMPLETE") {
        const [ms] = await tx
          .select()
          .from(manuscripts)
          .where(eq(manuscripts.id, ver.manuscriptId));

        const genre =
          (ms?.genre as { primary: string } | null)?.primary ?? "fiction";
        const builder =
          genre === "poetry"
            ? poetryDoc
            : genre === "creative_nonfiction"
              ? creativeNonfictionDoc
              : proseFictionDoc;

        await tx
          .update(manuscriptVersions)
          .set({
            content: builder(),
            contentFormat: "prosemirror_v1",
            contentExtractionStatus: "COMPLETE",
          })
          .where(eq(manuscriptVersions.id, ver.id));
        contentFixups++;
      }
    }

    console.log(
      `  Pipeline: 2 comments + 4 new items (${contentFixups} content fix-ups)`,
    );

    // -----------------------------------------------------------------------
    // Section F: Email templates
    // -----------------------------------------------------------------------
    const templateEvents = [
      {
        name: "submission_received",
        subject: "We received your submission: {{title}}",
        body: "<h1>Thank you</h1><p>We have received your submission &ldquo;{{title}}&rdquo; and it is now in our reading queue.</p>",
      },
      {
        name: "submission_accepted",
        subject: "Congratulations! Your work has been accepted",
        body: "<h1>Wonderful news</h1><p>We are delighted to accept &ldquo;{{title}}&rdquo; for publication in {{publicationName}}.</p>",
      },
      {
        name: "submission_rejected",
        subject: "Update on your submission to {{orgName}}",
        body: "<h1>Thank you for submitting</h1><p>After careful consideration, we have decided not to accept &ldquo;{{title}}&rdquo; at this time. We wish you the best.</p>",
      },
      {
        name: "under_review",
        subject: "Your submission is under review",
        body: "<h1>Under Review</h1><p>Your submission &ldquo;{{title}}&rdquo; has moved to our review stage.</p>",
      },
      {
        name: "revise_and_resubmit",
        subject: "Revision requested for your submission",
        body: "<h1>Revision Requested</h1><p>We enjoyed reading &ldquo;{{title}}&rdquo; and would like to see a revised version.</p>",
      },
    ];

    for (const org of [base.org1, base.org2]) {
      for (const tmpl of templateEvents) {
        await tx.insert(emailTemplates).values({
          organizationId: org.id,
          templateName: tmpl.name,
          subjectTemplate: tmpl.subject,
          bodyHtml: tmpl.body,
          isActive: true,
        });
      }
    }

    console.log("  Email templates: 10 (5 per org)");

    // -----------------------------------------------------------------------
    // Section G: Notification preferences
    // -----------------------------------------------------------------------
    const notifEventTypes = [
      "submission.received",
      "submission.status_changed",
      "discussion.new_comment",
    ];
    const channels = ["email", "in_app"] as const;

    for (const user of [base.adminUser, base.editorUser, editor2!, editor3!]) {
      for (const eventType of notifEventTypes) {
        for (const channel of channels) {
          await tx.insert(notificationPreferences).values({
            organizationId: base.org1.id,
            userId: user.id,
            channel,
            eventType,
            enabled: true,
          });
        }
      }
    }

    console.log("  Notification preferences: 24");

    // Inbox notifications (sample)
    const inboxItems = [
      {
        userId: base.adminUser.id,
        eventType: "submission.received",
        title: "New submission received",
        body: "A new submission has been submitted to Spring 2026 Reading Period.",
        read: false,
      },
      {
        userId: base.adminUser.id,
        eventType: "submission.received",
        title: "New submission received",
        body: "Another submission for the Spring period.",
        read: true,
      },
      {
        userId: base.editorUser.id,
        eventType: "discussion.new_comment",
        title: "New comment on submission",
        body: "A new comment was added to a submission you're reviewing.",
        read: false,
      },
      {
        userId: base.editorUser.id,
        eventType: "submission.status_changed",
        title: "Submission accepted",
        body: "A submission you reviewed has been accepted.",
        read: true,
      },
      {
        userId: editor2!.id,
        eventType: "submission.received",
        title: "New submission received",
        body: "A poetry submission has been received.",
        read: false,
      },
      {
        userId: editor2!.id,
        eventType: "discussion.new_comment",
        title: "Reply to your comment",
        body: "Someone replied to your editorial comment.",
        read: false,
      },
      {
        userId: editor3!.id,
        eventType: "submission.status_changed",
        title: "Submission rejected",
        body: "A submission you reviewed was rejected.",
        read: true,
      },
      {
        userId: base.adminUser.id,
        eventType: "submission.status_changed",
        title: "Submission moved to review",
        body: "A submission was moved to Under Review.",
        read: false,
      },
      {
        userId: base.editorUser.id,
        eventType: "submission.received",
        title: "New submission",
        body: "New fiction submission received.",
        read: false,
      },
      {
        userId: editor3!.id,
        eventType: "discussion.new_comment",
        title: "New discussion thread",
        body: "A new discussion was started on a submission.",
        read: false,
      },
    ];

    for (const item of inboxItems) {
      await tx.insert(notificationsInbox).values({
        organizationId: base.org1.id,
        userId: item.userId,
        eventType: item.eventType,
        title: item.title,
        body: item.body,
        readAt: item.read ? daysAgo(randomInt(1, 5)) : null,
        createdAt: daysAgo(randomInt(1, 14)),
      });
    }

    console.log("  Inbox notifications: 10");

    // -----------------------------------------------------------------------
    // Section H: Webhook endpoints (DISABLED) + historical deliveries
    // -----------------------------------------------------------------------
    for (const org of [base.org1, base.org2]) {
      const [ep1] = await tx
        .insert(webhookEndpoints)
        .values({
          organizationId: org.id,
          url: "https://hooks.example.com/colophony/submissions",
          secret: createHash("sha256")
            .update(`webhook-secret-${org.slug}`)
            .digest("hex"),
          description: "Submission lifecycle events",
          eventTypes: [
            "submission.created",
            "submission.status_changed",
            "submission.accepted",
          ],
          status: "DISABLED",
        })
        .returning();

      await tx.insert(webhookEndpoints).values({
        organizationId: org.id,
        url: "https://hooks.example.com/colophony/pipeline",
        secret: createHash("sha256")
          .update(`webhook-secret-pipe-${org.slug}`)
          .digest("hex"),
        description: "Pipeline stage changes",
        eventTypes: ["pipeline.stage_changed", "pipeline.published"],
        status: "DISABLED",
      });

      // Historical deliveries on the first endpoint (org1 only)
      if (org.id === base.org1.id) {
        const deliveryStatuses = [
          "DELIVERED",
          "DELIVERED",
          "DELIVERED",
          "DELIVERED",
          "FAILED",
          "DELIVERED",
          "DELIVERED",
          "FAILED",
        ] as const;
        for (let i = 0; i < deliveryStatuses.length; i++) {
          const status = deliveryStatuses[i]!;
          await tx.insert(webhookDeliveries).values({
            organizationId: base.org1.id,
            webhookEndpointId: ep1!.id,
            eventType: "submission.status_changed",
            eventId: `evt_staging_${i + 1}`,
            payload: { submissionId: "example-uuid", status: "ACCEPTED" },
            status,
            httpStatusCode: status === "DELIVERED" ? 200 : 500,
            responseBody:
              status === "DELIVERED"
                ? '{"ok":true}'
                : '{"error":"Internal Server Error"}',
            errorMessage: status === "FAILED" ? "HTTP 500 from endpoint" : null,
            attempts: status === "FAILED" ? 3 : 1,
            deliveredAt:
              status === "DELIVERED" ? daysAgo(randomInt(1, 14)) : null,
            createdAt: daysAgo(randomInt(1, 14)),
          });
        }
      }
    }

    console.log(
      "  Webhook endpoints: 4 (all DISABLED) + 8 historical deliveries",
    );

    // -----------------------------------------------------------------------
    // Section I: Writer workspace
    // -----------------------------------------------------------------------
    // Journal directory (15 entries, written as superuser)
    for (const journal of JOURNAL_NAMES) {
      await tx.insert(journalDirectory).values({
        name: journal.name,
        normalizedName: journal.name.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
        externalUrl: journal.url,
        directoryIds: journal.ids,
      });
    }

    console.log("  Journal directory: 15 journals");

    // External submissions (20 across 3 writers)
    const extStatuses = [
      "sent",
      "in_review",
      "accepted",
      "rejected",
      "no_response",
    ] as const;
    let extCount = 0;
    for (const writer of [writer2!, writer3!, writer4!]) {
      const count =
        writer.id === writer2!.id ? 8 : writer.id === writer3!.id ? 7 : 5;
      for (let i = 0; i < count; i++) {
        const journal = randomFrom(JOURNAL_NAMES);
        const status = randomFrom([...extStatuses]);
        const sentDays = randomInt(10, 180);
        await tx.insert(externalSubmissions).values({
          userId: writer.id,
          journalName: journal.name,
          status,
          sentAt: daysAgo(sentDays),
          respondedAt: ["accepted", "rejected"].includes(status)
            ? daysAgo(sentDays - randomInt(30, 90))
            : null,
          method: randomFrom(["Submittable", "email", "online form"]),
          notes: status === "accepted" ? "Accepted for upcoming issue!" : null,
        });
        extCount++;
      }
    }

    console.log(`  External submissions: ${extCount}`);

    // Correspondence (10 entries)
    const corrSubs = allStagingSubs
      .filter(
        (s) => s.organizationId === base.org1.id && s.status === "ACCEPTED",
      )
      .slice(0, 3);

    for (const sub of corrSubs) {
      // Outbound acceptance letter
      await tx.insert(correspondence).values({
        userId: sub.submitterId!,
        submissionId: sub.id,
        direction: "outbound",
        channel: "email",
        sentAt: daysAgo(randomInt(1, 10)),
        subject: `Acceptance: ${sub.title}`,
        body: `Dear author, we are pleased to accept "${sub.title}" for publication in The Quarterly Review.`,
        senderName: "The Quarterly Review",
        senderEmail: "editor@quarterlyreview.org",
        isPersonalized: true,
        source: "auto",
      });

      // Inbound thank-you reply
      await tx.insert(correspondence).values({
        userId: sub.submitterId!,
        submissionId: sub.id,
        direction: "inbound",
        channel: "email",
        sentAt: daysAgo(randomInt(1, 5)),
        subject: `Re: Acceptance: ${sub.title}`,
        body: "Thank you so much for this wonderful news! I'm thrilled to have my work included.",
        senderName: "Author",
        isPersonalized: true,
        source: "manual",
      });
    }

    // A few external submission correspondences
    const extSubs = await tx.select().from(externalSubmissions).limit(2);
    for (const ext of extSubs) {
      await tx.insert(correspondence).values({
        userId: ext.userId,
        externalSubmissionId: ext.id,
        direction: "inbound",
        channel: "email",
        sentAt: daysAgo(randomInt(10, 60)),
        subject: "Thank you for your submission",
        body: "We appreciate your submission. Unfortunately, it does not meet our current editorial needs.",
        senderName: ext.journalName,
        isPersonalized: false,
        source: "manual",
      });
    }

    console.log("  Correspondence: ~8 entries");

    // Writer profiles
    await tx.insert(writerProfiles).values([
      {
        userId: writer2!.id,
        platform: "chillsubs",
        externalId: "writer2-cs",
        profileUrl: "https://chillsubs.com/user/writer2",
      },
      {
        userId: writer2!.id,
        platform: "submittable",
        externalId: "w2-submittable",
        profileUrl: "https://submittable.com/profile/w2",
      },
      {
        userId: writer3!.id,
        platform: "chillsubs",
        externalId: "writer3-cs",
        profileUrl: "https://chillsubs.com/user/writer3",
      },
      {
        userId: writer3!.id,
        platform: "duotrope",
        externalId: "w3-duotrope",
        profileUrl: "https://duotrope.com/account/w3",
      },
    ]);

    console.log("  Writer profiles: 4");

    // -----------------------------------------------------------------------
    // Section J: Federation (config + trusted peers)
    // -----------------------------------------------------------------------
    const instanceKeys = generateEd25519();
    await tx.insert(federationConfig).values({
      publicKey: instanceKeys.publicKey,
      privateKey: instanceKeys.privateKey,
      keyId: "did:web:staging.colophony.dev#key-1",
      mode: "allowlist",
      contactEmail: "admin@staging.colophony.dev",
      capabilities: ["identity", "simsub", "transfer"],
      enabled: true,
    });

    // Trusted peers — org1 and org2 trust a fictional peer instance
    const peerKeys1 = generateEd25519();
    const peerKeys2 = generateEd25519();

    await tx.insert(trustedPeers).values({
      organizationId: base.org1.id,
      domain: "literary-hub.example.com",
      instanceUrl: "https://literary-hub.example.com",
      publicKey: peerKeys1.publicKey,
      keyId: "did:web:literary-hub.example.com#key-1",
      grantedCapabilities: { identity: true, simsub: true, transfer: false },
      status: "active",
      initiatedBy: "local",
      lastVerifiedAt: daysAgo(2),
    });

    await tx.insert(trustedPeers).values({
      organizationId: base.org2.id,
      domain: "indie-press-collective.example.org",
      instanceUrl: "https://indie-press-collective.example.org",
      publicKey: peerKeys2.publicKey,
      keyId: "did:web:indie-press-collective.example.org#key-1",
      grantedCapabilities: { identity: true, simsub: false, transfer: false },
      status: "active",
      initiatedBy: "remote",
      lastVerifiedAt: daysAgo(5),
    });

    console.log("  Federation: 1 config + 2 trusted peers");

    // -----------------------------------------------------------------------
    // Section K: Embed tokens
    // -----------------------------------------------------------------------
    const embedToken1 = "emb_staging_token_active_001";
    const embedToken2 = "emb_staging_token_expired_002";

    await tx.insert(embedTokens).values([
      {
        organizationId: base.org1.id,
        submissionPeriodId: base.openPeriod.id,
        tokenHash: createHash("sha256").update(embedToken1).digest("hex"),
        tokenPrefix: "emb_stag",
        allowedOrigins: [
          "https://www.example.com",
          "https://staging.example.com",
        ],
        themeConfig: {
          primaryColor: "#2563eb",
          fontFamily: "Inter",
          borderRadius: "8px",
        },
        active: true,
        createdBy: base.adminUser.id,
      },
      {
        organizationId: base.org1.id,
        submissionPeriodId: base.openPeriod.id,
        tokenHash: createHash("sha256").update(embedToken2).digest("hex"),
        tokenPrefix: "emb_exp_",
        allowedOrigins: ["https://old.example.com"],
        active: false,
        createdBy: base.adminUser.id,
        expiresAt: daysAgo(7),
      },
    ]);

    console.log("  Embed tokens: 2 (1 active, 1 expired)");

    // -----------------------------------------------------------------------
    // Section L: Saved queue presets
    // -----------------------------------------------------------------------
    await tx.insert(savedQueuePresets).values([
      {
        organizationId: base.org1.id,
        userId: base.adminUser.id,
        name: "Pending Review",
        filters: {
          status: ["SUBMITTED", "UNDER_REVIEW"],
          sortBy: "submittedAt",
          sortOrder: "asc",
        },
        isDefault: true,
      },
      {
        organizationId: base.org1.id,
        userId: base.adminUser.id,
        name: "Accepted — Needs Pipeline",
        filters: {
          status: ["ACCEPTED"],
          sortBy: "submittedAt",
          sortOrder: "desc",
        },
      },
      {
        organizationId: base.org1.id,
        userId: base.editorUser.id,
        name: "My Review Queue",
        filters: {
          status: ["UNDER_REVIEW"],
          sortBy: "submittedAt",
          sortOrder: "asc",
        },
        isDefault: true,
      },
    ]);

    console.log("  Saved queue presets: 3");

    // -----------------------------------------------------------------------
    // Section M: User consents
    // -----------------------------------------------------------------------
    await tx.insert(userConsents).values([
      {
        userId: base.adminUser.id,
        consentType: "terms_of_service",
        granted: true,
        ipAddress: "203.0.113.1",
      },
      {
        userId: base.adminUser.id,
        consentType: "privacy_policy",
        granted: true,
        ipAddress: "203.0.113.1",
      },
      {
        userId: base.writerUser.id,
        consentType: "terms_of_service",
        granted: true,
        ipAddress: "198.51.100.42",
      },
      {
        userId: base.writerUser.id,
        consentType: "privacy_policy",
        granted: true,
        ipAddress: "198.51.100.42",
      },
    ]);

    console.log("  User consents: 4");

    // -----------------------------------------------------------------------
    // Section N: Business Operations (Track 13)
    // -----------------------------------------------------------------------

    // Contributors
    const [contributor1] = await tx
      .insert(contributors)
      .values({
        organizationId: base.org1.id,
        userId: base.writerUser.id,
        displayName: "Elena Vasquez",
        bio: "Elena Vasquez is a fiction writer and poet whose work explores displacement, memory, and the landscapes of the American Southwest. Her stories have appeared in Ploughshares, Tin House, and The Georgia Review.",
        pronouns: "she/her",
        email: "elena.vasquez@example.com",
        website: "https://elenavasquez.com",
        notes: "Accepted contributor since Spring 2025 issue.",
      })
      .returning();

    const [contributor2] = await tx
      .insert(contributors)
      .values({
        organizationId: base.org1.id,
        displayName: "James Achebe",
        bio: "James Achebe writes at the intersection of speculative fiction and literary realism. His debut collection, 'The Weight of Fireflies,' was longlisted for the Caine Prize.",
        pronouns: "he/him",
        email: "j.achebe@example.com",
      })
      .returning();

    const [contributor3] = await tx
      .insert(contributors)
      .values({
        organizationId: base.org1.id,
        displayName: "River Chen",
        bio: "River Chen is a nonbinary poet and essayist based in Portland. Their chapbook 'Tidepool Liturgy' won the 2025 Kundiman Prize.",
        pronouns: "they/them",
        website: "https://riverchen.net",
      })
      .returning();

    console.log("  Contributors: 3");

    // Contributor publications (link to existing pipeline items)
    await tx.insert(contributorPublications).values([
      {
        contributorId: contributor1!.id,
        pipelineItemId: base.pipeItem1.id,
        role: "author",
        displayOrder: 0,
      },
      {
        contributorId: contributor2!.id,
        pipelineItemId: base.pipeItem2.id,
        role: "author",
        displayOrder: 0,
      },
    ]);

    console.log("  Contributor publications: 2");

    // Rights agreements
    await tx.insert(rightsAgreements).values([
      {
        organizationId: base.org1.id,
        contributorId: contributor1!.id,
        pipelineItemId: base.pipeItem1.id,
        rightsType: "first_north_american_serial",
        status: "ACTIVE",
        grantedAt: daysAgo(30),
        expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
        notes: "Standard FNASR — 12-month exclusivity window.",
      },
      {
        organizationId: base.org1.id,
        contributorId: contributor2!.id,
        pipelineItemId: base.pipeItem2.id,
        rightsType: "electronic",
        status: "DRAFT",
        notes: "Pending signature from author.",
      },
      {
        organizationId: base.org1.id,
        contributorId: contributor3!.id,
        rightsType: "first_north_american_serial",
        status: "REVERTED",
        grantedAt: daysAgo(400),
        revertedAt: daysAgo(35),
        notes: "Exclusivity period ended — rights reverted to author.",
      },
    ]);

    console.log("  Rights agreements: 3");

    // Payment transactions
    await tx.insert(paymentTransactions).values([
      {
        organizationId: base.org1.id,
        contributorId: contributor1!.id,
        type: "contributor_payment",
        direction: "outbound",
        amount: 15000,
        currency: "usd",
        status: "SUCCEEDED",
        description: "Payment for 'Meridians of Light' — Spring 2026 issue",
        processedAt: daysAgo(20),
      },
      {
        organizationId: base.org1.id,
        submissionId: base.submittedSub.id,
        type: "submission_fee",
        direction: "inbound",
        amount: 300,
        currency: "usd",
        status: "SUCCEEDED",
        description: "Submission fee — Spring Reading Period",
        processedAt: daysAgo(45),
      },
      {
        organizationId: base.org1.id,
        contributorId: contributor2!.id,
        type: "contributor_payment",
        direction: "outbound",
        amount: 10000,
        currency: "usd",
        status: "PENDING",
        description: "Payment for 'The Weight of Fireflies' — pending contract",
      },
    ]);

    console.log("  Payment transactions: 3");

    // Contest groups
    await tx.insert(contestGroups).values({
      organizationId: base.org1.id,
      name: "Annual Fiction Prize 2026",
      description:
        "Two-round fiction contest. First round: editorial shortlist. Final round: guest judge selects winner and runner-up.",
      totalRoundsPlanned: 2,
    });

    console.log("  Contest groups: 1");

    // -----------------------------------------------------------------------
    // Section O: Writer Platform (Track 14)
    // -----------------------------------------------------------------------

    // Simsub groups (user-scoped, for the writer user)
    const [simsubGroup1] = await tx
      .insert(simsubGroups)
      .values({
        userId: base.writerUser.id,
        name: "The Weight of Small Things — sim-sub batch",
        manuscriptId: base.manuscript1.id,
        status: "ACTIVE",
        notes:
          "Submitted to 3 journals simultaneously. Quarterly Review prohibits sim-sub so tracking separately.",
      })
      .returning();

    const [simsubGroup2] = await tx
      .insert(simsubGroups)
      .values({
        userId: base.writerUser.id,
        name: "Ode to Impermanence — resolved",
        status: "RESOLVED",
        notes: "Accepted at Tin House; withdrew from others.",
      })
      .returning();

    console.log("  Simsub groups: 2");

    // Simsub group submissions (link to existing submissions + external subs)
    const writerExternalSubs = await tx
      .select()
      .from(externalSubmissions)
      .where(eq(externalSubmissions.userId, base.writerUser.id))
      .limit(2);

    await tx.insert(simsubGroupSubmissions).values([
      {
        userId: base.writerUser.id,
        simsubGroupId: simsubGroup1!.id,
        submissionId: base.submittedSub.id,
      },
      ...(writerExternalSubs.length > 0
        ? [
            {
              userId: base.writerUser.id,
              simsubGroupId: simsubGroup1!.id,
              externalSubmissionId: writerExternalSubs[0]!.id,
            },
          ]
        : []),
      ...(writerExternalSubs.length > 1
        ? [
            {
              userId: base.writerUser.id,
              simsubGroupId: simsubGroup2!.id,
              externalSubmissionId: writerExternalSubs[1]!.id,
            },
          ]
        : []),
    ]);

    console.log(
      `  Simsub group submissions: ${1 + Math.min(writerExternalSubs.length, 2)}`,
    );

    // Portfolio entries
    await tx.insert(portfolioEntries).values([
      {
        userId: base.writerUser.id,
        type: "colophony_verified",
        title: "Meridians of Light",
        publicationName: "The Quarterly Review",
        publishedAt: daysAgo(60),
        url: "https://quarterlyreview.example.com/spring-2026/meridians",
        contributorPublicationId: (
          await tx
            .select({ id: contributorPublications.id })
            .from(contributorPublications)
            .where(eq(contributorPublications.contributorId, contributor1!.id))
            .limit(1)
        )[0]?.id,
      },
      {
        userId: base.writerUser.id,
        type: "external",
        title: "Catalogue of Vanishing",
        publicationName: "The Georgia Review",
        publishedAt: daysAgo(180),
        url: "https://thegeorgiareview.com/posts/catalogue-of-vanishing",
        notes: "Nominated for Pushcart Prize.",
      },
    ]);

    console.log("  Portfolio entries: 2");

    // Reader feedback
    const feedbackCandidates = allStagingSubs.filter(
      (s) =>
        s.organizationId === base.org1.id &&
        ["UNDER_REVIEW", "ACCEPTED", "REJECTED"].includes(s.status),
    );

    const feedbackValues = feedbackCandidates.slice(0, 3).map((sub, idx) => ({
      organizationId: base.org1.id,
      submissionId: sub.id,
      reviewerUserId: base.editorUser.id,
      tags: [
        ["strong_voice", "compelling_narrative"],
        ["needs_revision", "promising"],
        ["exceptional", "recommend_accept"],
      ][idx]!,
      comment: [
        "Striking opening — the second section loses momentum but recovers beautifully in the final paragraph.",
        "Interesting premise that doesn't quite land yet. With revision, this could be very strong.",
        "One of the strongest pieces in this batch. Ready for the next round.",
      ][idx]!,
      isForwardable: idx === 2,
      forwardedAt: idx === 2 ? daysAgo(5) : undefined,
      forwardedBy: idx === 2 ? base.adminUser.id : undefined,
    }));

    if (feedbackValues.length > 0) {
      await tx.insert(readerFeedback).values(feedbackValues);
    }

    console.log(`  Reader feedback: ${feedbackValues.length}`);

    // -----------------------------------------------------------------------
    // Section P: Editor Collections (Track 12)
    // -----------------------------------------------------------------------

    const [collection1] = await tx
      .insert(workspaceCollections)
      .values({
        organizationId: base.org1.id,
        ownerId: base.editorUser.id,
        name: "Spring Reading Shortlist",
        description:
          "Strongest pieces from the Spring reading period — for final editorial discussion.",
        visibility: "team",
        typeHint: "reading_list",
      })
      .returning();

    const [collection2] = await tx
      .insert(workspaceCollections)
      .values({
        organizationId: base.org1.id,
        ownerId: base.editorUser.id,
        name: "In Progress",
        description: "Submissions I'm currently reading.",
        visibility: "private",
        typeHint: "custom",
      })
      .returning();

    console.log("  Workspace collections: 2");

    // Add items to collections from base + staging submissions
    const collectionSubs = [
      base.underReviewSub,
      base.acceptedSub,
      ...(reviewableSubs.length > 0 ? [reviewableSubs[0]!] : []),
    ];

    const collectionItems = collectionSubs.map((sub, idx) => ({
      collectionId: idx < 2 ? collection1!.id : collection2!.id,
      submissionId: sub.id,
      position: idx,
      notes:
        idx === 0
          ? "Strong candidate — discuss at Tuesday meeting."
          : idx === 1
            ? "Accepted, moving to pipeline."
            : undefined,
      readingAnchor:
        idx === 0
          ? { paragraphIndex: 4, scrollPercent: 0.35 }
          : idx === 2
            ? { paragraphIndex: 1, scrollPercent: 0.1 }
            : null,
    }));

    if (collectionItems.length > 0) {
      await tx.insert(workspaceItems).values(collectionItems);
    }

    console.log(`  Workspace items: ${collectionItems.length}`);

    // -----------------------------------------------------------------------
    // Section Q: Mark staging as seeded (idempotency flag)
    // -----------------------------------------------------------------------
    await tx
      .update(organizations)
      .set({
        settings: sql`jsonb_set(COALESCE(settings, '{}'::jsonb), '{stagingSeeded}', 'true')`,
      })
      .where(eq(organizations.slug, "quarterly-review"));

    console.log("  Staging flag set on quarterly-review org.");
  });

  console.log("\nStaging seed complete.");
}

main()
  .catch((e) => {
    console.error("Staging seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await pool.end();
  });
