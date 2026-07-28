/**
 * Federation-specific Playwright test fixtures.
 *
 * Uses the ADMIN user (editor@quarterlyreview.org) — federation endpoints
 * require adminProcedure.
 *
 * Most of this suite drives `internalOnly` routers (federation, simsub,
 * transfer, migration, hub). Those admit only interactive auth methods, so the
 * suite passes under TRPC_INTERNAL_ONLY_ENFORCE=true precisely because it
 * authenticates as `authMethod: 'test'` rather than as an API key.
 *
 * Co-located in e2e/federation/ (not e2e/helpers/) to avoid triggering
 * all Playwright suites via detect-changes.sh shared prefix matching.
 */

import { test as base, expect, type Page } from "@playwright/test";
import { createAuthedContext, ADMIN_USER_PROFILE } from "../helpers/auth";
import {
  getOrgBySlug,
  getUserByEmail,
  createSubmission,
  deleteSubmission,
  createManuscript,
  createManuscriptVersion,
  deleteManuscript,
  getOpenSubmissionPeriod,
} from "../helpers/db";
import {
  ensureFederationConfig,
  createTrustedPeer,
  deleteTrustedPeer,
  createSimSubCheck,
  deleteSimSubCheck,
  createPieceTransfer,
  deletePieceTransfer,
  createIdentityMigration,
  deleteIdentityMigration,
} from "./federation-db";

interface SeedOrg {
  id: string;
  name: string;
  slug: string;
}

interface SeedUser {
  id: string;
  email: string;
}

interface FederationData {
  configId: string;
  activePeerId: string;
  activePeerDomain: string;
  pendingPeerId: string;
  pendingPeerDomain: string;
  revokedPeerId: string;
  revokedPeerDomain: string;
  submissionId: string;
  manuscriptId: string;
  manuscriptVersionId: string;
  clearCheckId: string;
  conflictCheckId: string;
  transferId: string;
  migrationId: string;
}

export const test = base.extend<{
  seedOrg: SeedOrg;
  seedAdmin: SeedUser;
  authedPage: Page;
  federationData: FederationData;
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

  federationData: async ({ seedOrg, seedAdmin }, use) => {
    // Ensure federation config exists
    const config = await ensureFederationConfig();

    // Create trusted peers (3 statuses)
    const activePeer = await createTrustedPeer({
      orgId: seedOrg.id,
      domain: "active-peer.example.com",
      status: "active",
      capabilities: {
        "identity.verify": true,
        "simsub.check": true,
        "transfer.initiate": true,
      },
    });

    const pendingPeer = await createTrustedPeer({
      orgId: seedOrg.id,
      domain: "pending-peer.example.com",
      status: "pending_inbound",
      capabilities: {},
      initiatedBy: "remote",
    });

    const revokedPeer = await createTrustedPeer({
      orgId: seedOrg.id,
      domain: "revoked-peer.example.com",
      status: "revoked",
      capabilities: { "identity.verify": true },
    });

    // Create a submission + manuscript version for transfers/sim-sub
    const manuscript = await createManuscript({
      ownerId: seedAdmin.id,
      title: "Federation Test Manuscript",
    });
    const manuscriptVersion = await createManuscriptVersion({
      manuscriptId: manuscript.id,
      versionNumber: 1,
      label: "v1",
    });

    const period = await getOpenSubmissionPeriod(seedOrg.id);
    const submission = await createSubmission({
      orgId: seedOrg.id,
      submitterId: seedAdmin.id,
      submissionPeriodId: period?.id,
      manuscriptVersionId: manuscriptVersion.id,
      title: "Federation Test Submission",
      status: "SUBMITTED",
    });

    // Create sim-sub checks
    const clearCheck = await createSimSubCheck({
      submissionId: submission.id,
      result: "CLEAR",
    });
    const conflictCheck = await createSimSubCheck({
      submissionId: submission.id,
      result: "CONFLICT",
      localConflicts: [
        {
          publicationName: "Other Magazine",
          submittedAt: new Date().toISOString(),
        },
      ],
    });

    // Create piece transfer
    const transfer = await createPieceTransfer({
      submissionId: submission.id,
      manuscriptVersionId: manuscriptVersion.id,
      userId: seedAdmin.id,
      targetDomain: "target-instance.example.com",
      status: "PENDING",
    });

    // Create identity migration
    const migration = await createIdentityMigration({
      userId: seedAdmin.id,
      orgId: seedOrg.id,
      direction: "outbound",
      peerDomain: "migration-peer.example.com",
      status: "PENDING",
    });

    await use({
      configId: config.id,
      activePeerId: activePeer.id,
      activePeerDomain: activePeer.domain,
      pendingPeerId: pendingPeer.id,
      pendingPeerDomain: pendingPeer.domain,
      revokedPeerId: revokedPeer.id,
      revokedPeerDomain: revokedPeer.domain,
      submissionId: submission.id,
      manuscriptId: manuscript.id,
      manuscriptVersionId: manuscriptVersion.id,
      clearCheckId: clearCheck.id,
      conflictCheckId: conflictCheck.id,
      transferId: transfer.id,
      migrationId: migration.id,
    });

    // Cleanup in reverse order (FK dependencies)
    await deleteIdentityMigration(migration.id);
    await deletePieceTransfer(transfer.id);
    await deleteSimSubCheck(conflictCheck.id);
    await deleteSimSubCheck(clearCheck.id);
    await deleteSubmission(submission.id);
    await deleteManuscript(manuscript.id);
    await deleteTrustedPeer(activePeer.id);
    await deleteTrustedPeer(pendingPeer.id);
    await deleteTrustedPeer(revokedPeer.id);
  },
});

export { expect };
