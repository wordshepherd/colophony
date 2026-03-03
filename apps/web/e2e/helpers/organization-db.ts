/**
 * Organization-specific DB helpers for E2E test data setup/teardown.
 *
 * Uses the admin pool from db.ts to bypass RLS.
 */

import { eq, and } from "drizzle-orm";
import { organizationMembers, users } from "@colophony/db";
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
  role: string;
} | null> {
  const db = getDb();
  const [row] = await db
    .select({
      id: organizationMembers.id,
      userId: organizationMembers.userId,
      role: organizationMembers.role,
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
): Promise<Array<{ id: string; userId: string; email: string; role: string }>> {
  const db = getDb();
  return db
    .select({
      id: organizationMembers.id,
      userId: organizationMembers.userId,
      email: users.email,
      role: organizationMembers.role,
    })
    .from(organizationMembers)
    .innerJoin(users, eq(users.id, organizationMembers.userId))
    .where(eq(organizationMembers.organizationId, orgId));
}
