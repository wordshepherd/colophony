/**
 * Database helper for E2E test data setup/teardown.
 *
 * Uses PrismaClient with the superuser connection to bypass RLS
 * for creating test orgs, memberships, and other fixtures.
 */

import { PrismaClient } from '@prospector/db';

const DATABASE_URL =
  process.env.DATABASE_URL ||
  'postgresql://prospector:password@localhost:5432/prospector';

let prisma: PrismaClient | null = null;

/**
 * Get or create a PrismaClient instance using superuser credentials.
 */
export function getTestPrisma(): PrismaClient {
  if (!prisma) {
    prisma = new PrismaClient({
      datasources: { db: { url: DATABASE_URL } },
    });
  }
  return prisma;
}

/**
 * Disconnect from the database.
 */
export async function disconnectDb(): Promise<void> {
  if (prisma) {
    await prisma.$disconnect();
    prisma = null;
  }
}

/**
 * Create an organization for testing.
 */
export async function createOrg(data?: {
  name?: string;
  slug?: string;
}): Promise<{ id: string; name: string; slug: string }> {
  const db = getTestPrisma();
  const suffix = Date.now().toString(36);
  return db.organization.create({
    data: {
      name: data?.name ?? `Test Org ${suffix}`,
      slug: data?.slug ?? `test-org-${suffix}`,
    },
    select: { id: true, name: true, slug: true },
  });
}

/**
 * Add a user to an organization with a specified role.
 */
export async function addMember(
  orgId: string,
  userId: string,
  role: 'ADMIN' | 'EDITOR' | 'READER',
): Promise<void> {
  const db = getTestPrisma();
  await db.organizationMember.create({
    data: {
      organizationId: orgId,
      userId: userId,
      role,
    },
  });
}

/**
 * Look up a user by email.
 */
export async function getUserByEmail(
  email: string,
): Promise<{ id: string; email: string } | null> {
  const db = getTestPrisma();
  return db.user.findUnique({
    where: { email },
    select: { id: true, email: true },
  });
}

/**
 * Clean up test data created during a test run.
 * Deletes org and cascades to members, submissions, etc.
 */
export async function deleteOrg(orgId: string): Promise<void> {
  const db = getTestPrisma();
  await db.organization.delete({ where: { id: orgId } }).catch(() => {
    // Ignore if already deleted
  });
}

/**
 * Delete a user by ID (for test cleanup).
 */
export async function deleteUser(userId: string): Promise<void> {
  const db = getTestPrisma();
  await db.user.delete({ where: { id: userId } }).catch(() => {
    // Ignore if already deleted
  });
}
