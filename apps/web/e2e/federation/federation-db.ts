/**
 * Federation-specific database helpers for E2E test data setup/teardown.
 *
 * Uses the admin pool from e2e/helpers/db.ts (bypasses RLS).
 * Co-located in e2e/federation/ (not e2e/helpers/) to avoid triggering
 * all Playwright suites via detect-changes.sh shared prefix matching.
 */

import { randomBytes } from "crypto";
import { eq } from "drizzle-orm";
import {
  federationConfig,
  trustedPeers,
  simSubChecks,
  pieceTransfers,
  identityMigrations,
} from "@colophony/db";
import { getDb } from "../helpers/db";

// ---------------------------------------------------------------------------
// Federation Config
// ---------------------------------------------------------------------------

/**
 * Ensure federation_config singleton exists.
 * Uses admin pool (federation_config has no RLS — app_user is REVOKE'd).
 * Generates a dummy Ed25519 keypair for test purposes.
 */
export async function ensureFederationConfig(): Promise<{ id: string }> {
  const db = getDb();

  // Check if config already exists
  const [existing] = await db
    .select({ id: federationConfig.id })
    .from(federationConfig)
    .limit(1);

  if (existing) return existing;

  // Insert with dummy keys (not real cryptographic material — test-only placeholders)
  const keyId = `e2e-key-${Date.now()}`;
  const dummyPub = `e2e-test-pub-${randomBytes(16).toString("hex")}`;
  const dummyPriv = `e2e-test-priv-${randomBytes(16).toString("hex")}`;
  const [row] = await db
    .insert(federationConfig)
    .values({
      publicKey: dummyPub,
      privateKey: dummyPriv,
      keyId,
      mode: "allowlist",
      contactEmail: "admin@test-instance.example",
      capabilities: ["identity"],
      enabled: true,
    })
    .returning({ id: federationConfig.id });

  return row;
}

// ---------------------------------------------------------------------------
// Trusted Peers
// ---------------------------------------------------------------------------

export async function createTrustedPeer(data: {
  orgId: string;
  domain: string;
  status:
    | "pending_outbound"
    | "pending_inbound"
    | "active"
    | "rejected"
    | "revoked";
  capabilities?: Record<string, boolean>;
  initiatedBy?: "local" | "remote";
}): Promise<{ id: string; domain: string }> {
  const db = getDb();
  const [row] = await db
    .insert(trustedPeers)
    .values({
      organizationId: data.orgId,
      domain: data.domain,
      instanceUrl: `https://${data.domain}`,
      publicKey: `e2e-peer-pubkey-${randomBytes(8).toString("hex")}`,
      keyId: `peer-key-${Date.now()}`,
      grantedCapabilities: data.capabilities ?? {
        "identity.verify": true,
        "simsub.check": true,
      },
      status: data.status,
      initiatedBy: data.initiatedBy ?? "local",
      protocolVersion: "1.0",
    })
    .returning({
      id: trustedPeers.id,
      domain: trustedPeers.domain,
    });
  return row;
}

export async function deleteTrustedPeer(id: string): Promise<void> {
  const db = getDb();
  await db
    .delete(trustedPeers)
    .where(eq(trustedPeers.id, id))
    .catch(() => {});
}

// ---------------------------------------------------------------------------
// Sim-Sub Checks
// ---------------------------------------------------------------------------

export async function createSimSubCheck(data: {
  submissionId: string;
  fingerprint?: string;
  result: "CLEAR" | "CONFLICT" | "PARTIAL" | "SKIPPED";
  submitterDid?: string;
  localConflicts?: Array<{
    publicationName: string;
    submittedAt: string;
  }>;
}): Promise<{ id: string }> {
  const db = getDb();
  const [row] = await db
    .insert(simSubChecks)
    .values({
      submissionId: data.submissionId,
      fingerprint:
        data.fingerprint ?? randomBytes(32).toString("hex").slice(0, 64),
      submitterDid: data.submitterDid ?? `did:colophony:test-writer-001`,
      result: data.result,
      localConflicts: data.localConflicts ?? [],
      remoteResults: [],
    })
    .returning({ id: simSubChecks.id });
  return row;
}

export async function deleteSimSubCheck(id: string): Promise<void> {
  const db = getDb();
  await db
    .delete(simSubChecks)
    .where(eq(simSubChecks.id, id))
    .catch(() => {});
}

// ---------------------------------------------------------------------------
// Piece Transfers
// ---------------------------------------------------------------------------

export async function createPieceTransfer(data: {
  submissionId: string;
  manuscriptVersionId: string;
  userId: string;
  targetDomain: string;
  status?:
    | "PENDING"
    | "FILES_REQUESTED"
    | "COMPLETED"
    | "REJECTED"
    | "FAILED"
    | "CANCELLED"
    | "EXPIRED";
}): Promise<{ id: string }> {
  const db = getDb();
  const [row] = await db
    .insert(pieceTransfers)
    .values({
      submissionId: data.submissionId,
      manuscriptVersionId: data.manuscriptVersionId,
      initiatedByUserId: data.userId,
      targetDomain: data.targetDomain,
      status: data.status ?? "PENDING",
      transferToken: randomBytes(32).toString("hex"),
      tokenExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      fileManifest: [
        {
          fileId: "test-file-001",
          filename: "manuscript.docx",
          mimeType:
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          size: 45000,
        },
      ],
      contentFingerprint: randomBytes(32).toString("hex").slice(0, 64),
      submitterDid: "did:colophony:test-writer-001",
    })
    .returning({ id: pieceTransfers.id });
  return row;
}

export async function deletePieceTransfer(id: string): Promise<void> {
  const db = getDb();
  await db
    .delete(pieceTransfers)
    .where(eq(pieceTransfers.id, id))
    .catch(() => {});
}

// ---------------------------------------------------------------------------
// Identity Migrations
// ---------------------------------------------------------------------------

export async function createIdentityMigration(data: {
  userId: string;
  orgId?: string;
  direction: "inbound" | "outbound";
  peerDomain: string;
  status?:
    | "PENDING"
    | "PENDING_APPROVAL"
    | "APPROVED"
    | "BUNDLE_SENT"
    | "PROCESSING"
    | "COMPLETED"
    | "REJECTED"
    | "FAILED"
    | "EXPIRED"
    | "CANCELLED";
}): Promise<{ id: string }> {
  const db = getDb();
  const [row] = await db
    .insert(identityMigrations)
    .values({
      userId: data.userId,
      organizationId: data.orgId ?? null,
      direction: data.direction,
      peerDomain: data.peerDomain,
      peerInstanceUrl: `https://${data.peerDomain}`,
      userDid: "did:colophony:test-writer-001",
      peerUserDid: "did:colophony:remote-writer-001",
      status: data.status ?? "PENDING",
      migrationToken: randomBytes(32).toString("hex"),
      tokenExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    })
    .returning({ id: identityMigrations.id });
  return row;
}

export async function deleteIdentityMigration(id: string): Promise<void> {
  const db = getDb();
  await db
    .delete(identityMigrations)
    .where(eq(identityMigrations.id, id))
    .catch(() => {});
}
