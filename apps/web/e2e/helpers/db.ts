/**
 * Database helper for E2E test data setup/teardown.
 *
 * Uses a direct admin pool connection (not app_user, not withRls())
 * to bypass RLS for creating test orgs, memberships, and other fixtures.
 */

import { randomBytes, createHash } from "crypto";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { eq, and, lte, gte } from "drizzle-orm";
import {
  organizations,
  users,
  organizationMembers,
  apiKeys,
  submissions,
  submissionPeriods,
  manuscripts,
  manuscriptVersions,
} from "@colophony/db";

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

/**
 * Look up an organization by slug.
 */
export async function getOrgBySlug(
  slug: string,
): Promise<{ id: string; name: string; slug: string } | null> {
  const db = getDb();
  const [row] = await db
    .select({
      id: organizations.id,
      name: organizations.name,
      slug: organizations.slug,
    })
    .from(organizations)
    .where(eq(organizations.slug, slug))
    .limit(1);
  return row ?? null;
}

/**
 * Create a user for testing.
 */
export async function createUser(data: {
  email: string;
  zitadelUserId: string;
}): Promise<{ id: string; email: string }> {
  const db = getDb();
  const [row] = await db
    .insert(users)
    .values({
      email: data.email,
      zitadelUserId: data.zitadelUserId,
    })
    .returning({
      id: users.id,
      email: users.email,
    });
  return row;
}

/**
 * Create an API key for testing.
 * Returns the plain key for use in test auth headers.
 */
export async function createApiKey(data: {
  orgId: string;
  userId: string;
  scopes: string[];
  name?: string;
}): Promise<{ id: string; plainKey: string }> {
  const db = getDb();
  const rawKey = randomBytes(32).toString("hex");
  const plainKey = `col_test_${rawKey}`;
  const keyHash = createHash("sha256").update(plainKey).digest("hex");
  const keyPrefix = plainKey.slice(0, 12);

  const [row] = await db
    .insert(apiKeys)
    .values({
      organizationId: data.orgId,
      createdBy: data.userId,
      name: data.name ?? `e2e-test-key-${Date.now()}`,
      keyHash,
      keyPrefix,
      scopes: data.scopes,
    })
    .returning({
      id: apiKeys.id,
    });

  return { id: row.id, plainKey };
}

/**
 * Delete an API key by ID.
 */
export async function deleteApiKey(keyId: string): Promise<void> {
  const db = getDb();
  await db
    .delete(apiKeys)
    .where(eq(apiKeys.id, keyId))
    .catch(() => {
      // Ignore if already deleted
    });
}

/**
 * Create a manuscript for testing.
 */
export async function createManuscript(data: {
  ownerId: string;
  title: string;
  description?: string;
}): Promise<{ id: string }> {
  const db = getDb();
  const [row] = await db
    .insert(manuscripts)
    .values({
      ownerId: data.ownerId,
      title: data.title,
      description: data.description ?? null,
    })
    .returning({
      id: manuscripts.id,
    });
  return row;
}

/**
 * Create a manuscript version for testing.
 */
export async function createManuscriptVersion(data: {
  manuscriptId: string;
  versionNumber: number;
  label?: string;
}): Promise<{ id: string }> {
  const db = getDb();
  const [row] = await db
    .insert(manuscriptVersions)
    .values({
      manuscriptId: data.manuscriptId,
      versionNumber: data.versionNumber,
      label: data.label ?? null,
    })
    .returning({
      id: manuscriptVersions.id,
    });
  return row;
}

/**
 * Delete a manuscript and all associated versions/files (cascade).
 */
export async function deleteManuscript(manuscriptId: string): Promise<void> {
  const db = getDb();
  await db
    .delete(manuscripts)
    .where(eq(manuscripts.id, manuscriptId))
    .catch(() => {
      // Ignore if already deleted
    });
}

/**
 * Create a submission for testing.
 */
export async function createSubmission(data: {
  orgId: string;
  submitterId: string;
  submissionPeriodId?: string;
  manuscriptVersionId?: string;
  title: string;
  content?: string;
  coverLetter?: string;
  status?: string;
}): Promise<{ id: string }> {
  const db = getDb();
  const [row] = await db
    .insert(submissions)
    .values({
      organizationId: data.orgId,
      submitterId: data.submitterId,
      submissionPeriodId: data.submissionPeriodId ?? null,
      manuscriptVersionId: data.manuscriptVersionId ?? null,
      title: data.title,
      content: data.content ?? null,
      coverLetter: data.coverLetter ?? null,
      status: (data.status as "DRAFT") ?? "DRAFT",
    })
    .returning({
      id: submissions.id,
    });
  return row;
}

/**
 * Delete a submission by ID.
 */
export async function deleteSubmission(submissionId: string): Promise<void> {
  const db = getDb();
  await db
    .delete(submissions)
    .where(eq(submissions.id, submissionId))
    .catch(() => {
      // Ignore if already deleted
    });
}

/**
 * Find an open submission period for an org (now between opensAt and closesAt).
 */
export async function getOpenSubmissionPeriod(
  orgId: string,
): Promise<{ id: string; name: string } | null> {
  const db = getDb();
  const now = new Date();
  const [row] = await db
    .select({
      id: submissionPeriods.id,
      name: submissionPeriods.name,
    })
    .from(submissionPeriods)
    .where(
      and(
        eq(submissionPeriods.organizationId, orgId),
        lte(submissionPeriods.opensAt, now),
        gte(submissionPeriods.closesAt, now),
      ),
    )
    .limit(1);
  return row ?? null;
}
