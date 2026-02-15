/**
 * Database helper for E2E test data setup/teardown.
 *
 * Uses a direct admin pool connection (not app_user, not withRls())
 * to bypass RLS for creating test orgs, memberships, and other fixtures.
 */

import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { eq } from "drizzle-orm";
import { organizations, users, organizationMembers } from "@colophony/db";

const DATABASE_URL =
  process.env.DATABASE_URL ||
  "postgresql://colophony:password@localhost:5432/colophony";

let pool: Pool | null = null;

function getPool(): Pool {
  if (!pool) {
    pool = new Pool({
      connectionString: DATABASE_URL,
      max: 3,
      idleTimeoutMillis: 5000,
    });
  }
  return pool;
}

function getDb() {
  return drizzle(getPool());
}

/**
 * Disconnect from the database.
 */
export async function disconnectDb(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}

/**
 * Create an organization for testing.
 */
export async function createOrg(data?: {
  name?: string;
  slug?: string;
}): Promise<{ id: string; name: string; slug: string }> {
  const db = getDb();
  const suffix = Date.now().toString(36);
  const [row] = await db
    .insert(organizations)
    .values({
      name: data?.name ?? `Test Org ${suffix}`,
      slug: data?.slug ?? `test-org-${suffix}`,
    })
    .returning({
      id: organizations.id,
      name: organizations.name,
      slug: organizations.slug,
    });
  return row;
}

/**
 * Add a user to an organization with a specified role.
 */
export async function addMember(
  orgId: string,
  userId: string,
  role: "ADMIN" | "EDITOR" | "READER",
): Promise<void> {
  const db = getDb();
  await db.insert(organizationMembers).values({
    organizationId: orgId,
    userId: userId,
    role,
  });
}

/**
 * Look up a user by email.
 */
export async function getUserByEmail(
  email: string,
): Promise<{ id: string; email: string } | null> {
  const db = getDb();
  const [row] = await db
    .select({ id: users.id, email: users.email })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);
  return row ?? null;
}

/**
 * Clean up test data created during a test run.
 * Deletes org and cascades to members, submissions, etc.
 */
export async function deleteOrg(orgId: string): Promise<void> {
  const db = getDb();
  await db
    .delete(organizations)
    .where(eq(organizations.id, orgId))
    .catch(() => {
      // Ignore if already deleted
    });
}

/**
 * Delete a user by ID (for test cleanup).
 */
export async function deleteUser(userId: string): Promise<void> {
  const db = getDb();
  await db
    .delete(users)
    .where(eq(users.id, userId))
    .catch(() => {
      // Ignore if already deleted
    });
}
