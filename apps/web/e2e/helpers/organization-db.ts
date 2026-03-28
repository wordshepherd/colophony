/**
 * Organization-specific DB helpers for E2E test data setup/teardown.
 *
 * Uses the admin pool from db.ts to bypass RLS.
 */

import { randomBytes, createHash } from "crypto";
import { eq, and } from "drizzle-orm";
import {
  organizationMembers,
  organizationInvitations,
  users,
} from "@colophony/db";
import { INVITATION_TOKEN_PREFIX } from "@colophony/types";
import { getDb } from "./db";

/**
 * Look up a member record by org ID and user email.
 */
export async function getMemberByEmail(
  orgId: string,
  email: string,
): Promise<{
  id: string;
  userId: string;
  roles: string[];
} | null> {
  const db = getDb();
  const [row] = await db
    .select({
      id: organizationMembers.id,
      userId: organizationMembers.userId,
      roles: organizationMembers.roles,
    })
    .from(organizationMembers)
    .innerJoin(users, eq(users.id, organizationMembers.userId))
    .where(
      and(
        eq(organizationMembers.organizationId, orgId),
        eq(users.email, email),
      ),
    )
    .limit(1);
  return row ?? null;
}

/**
 * Remove a member by membership ID.
 */
export async function removeMember(memberId: string): Promise<void> {
  const db = getDb();
  await db
    .delete(organizationMembers)
    .where(eq(organizationMembers.id, memberId))
    .catch(() => {
      // Ignore if already deleted
    });
}

/**
 * List all members for an organization.
 */
export async function getMembers(
  orgId: string,
): Promise<
  Array<{ id: string; userId: string; email: string; roles: string[] }>
> {
  const db = getDb();
  return db
    .select({
      id: organizationMembers.id,
      userId: organizationMembers.userId,
      email: users.email,
      roles: organizationMembers.roles,
    })
    .from(organizationMembers)
    .innerJoin(users, eq(users.id, organizationMembers.userId))
    .where(eq(organizationMembers.organizationId, orgId));
}

// ---------------------------------------------------------------------------
// Invitation helpers
// ---------------------------------------------------------------------------

/**
 * Create an invitation directly in the DB, returning the plaintext token.
 * Bypasses RLS via admin pool — used for E2E test setup.
 */
export async function createInvitation(data: {
  orgId: string;
  email: string;
  roles?: Array<"ADMIN" | "EDITOR" | "READER" | "PRODUCTION" | "BUSINESS_OPS">;
  invitedBy: string;
  status?: "PENDING" | "ACCEPTED" | "REVOKED" | "EXPIRED";
  expiresAt?: Date;
}): Promise<{ id: string; plainToken: string }> {
  const db = getDb();
  const plainToken = `${INVITATION_TOKEN_PREFIX}${randomBytes(16).toString("hex")}`;
  const tokenHash = createHash("sha256").update(plainToken).digest("hex");

  const expiresAt =
    data.expiresAt ?? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  const [row] = await db
    .insert(organizationInvitations)
    .values({
      organizationId: data.orgId,
      email: data.email.toLowerCase(),
      roles: data.roles ?? ["READER"],
      tokenHash,
      tokenPrefix: INVITATION_TOKEN_PREFIX,
      status: data.status ?? "PENDING",
      invitedBy: data.invitedBy,
      expiresAt,
    })
    .returning({ id: organizationInvitations.id });

  return { id: row.id, plainToken };
}

/**
 * Create an expired invitation (expiresAt = 1 hour ago).
 */
export async function createExpiredInvitation(
  data: Omit<Parameters<typeof createInvitation>[0], "expiresAt" | "status">,
): Promise<{ id: string; plainToken: string }> {
  return createInvitation({
    ...data,
    expiresAt: new Date(Date.now() - 60 * 60 * 1000),
  });
}

/**
 * Delete an invitation by ID. Swallows errors if already deleted.
 */
export async function deleteInvitation(id: string): Promise<void> {
  const db = getDb();
  await db
    .delete(organizationInvitations)
    .where(eq(organizationInvitations.id, id))
    .catch(() => {
      // Ignore if already deleted
    });
}

/**
 * Delete all invitations for an org+email pair.
 */
export async function deleteInvitationsByEmail(
  orgId: string,
  email: string,
): Promise<void> {
  const db = getDb();
  await db
    .delete(organizationInvitations)
    .where(
      and(
        eq(organizationInvitations.organizationId, orgId),
        eq(organizationInvitations.email, email.toLowerCase()),
      ),
    )
    .catch(() => {});
}

/**
 * Query an invitation by org+email for assertions.
 */
export async function getInvitationByEmail(
  orgId: string,
  email: string,
): Promise<{
  id: string;
  status: string;
  roles: string[];
  email: string;
  expiresAt: Date;
  createdAt: Date;
} | null> {
  const db = getDb();
  const [row] = await db
    .select({
      id: organizationInvitations.id,
      status: organizationInvitations.status,
      roles: organizationInvitations.roles,
      email: organizationInvitations.email,
      expiresAt: organizationInvitations.expiresAt,
      createdAt: organizationInvitations.createdAt,
    })
    .from(organizationInvitations)
    .where(
      and(
        eq(organizationInvitations.organizationId, orgId),
        eq(organizationInvitations.email, email.toLowerCase()),
      ),
    )
    .limit(1);
  return row ?? null;
}

/**
 * Mark an invitation as ACCEPTED. For "already accepted" test setup.
 */
export async function markInvitationAccepted(
  id: string,
  userId: string,
): Promise<void> {
  const db = getDb();
  await db
    .update(organizationInvitations)
    .set({
      status: "ACCEPTED",
      acceptedBy: userId,
      acceptedAt: new Date(),
    })
    .where(eq(organizationInvitations.id, id));
}
