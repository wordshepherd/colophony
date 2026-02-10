import { PrismaClient } from '@prisma/client';
import Redis from 'ioredis';

/**
 * Test database context utilities
 *
 * We maintain two separate connections:
 * 1. adminPrisma - superuser for test setup/teardown (bypasses RLS)
 * 2. appPrisma - non-superuser for RLS-enforced operations
 */

// Admin connection (superuser) - for test data setup/teardown
const adminPrisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_ADMIN_URL ||
        'postgresql://test:test@localhost:5433/prospector_test',
    },
  },
});

// App connection (non-superuser) - for RLS-enforced operations
const appPrisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_TEST_URL ||
        'postgresql://app_user:app_password@localhost:5433/prospector_test',
    },
  },
});

// Redis connection for flushing between tests
const testRedis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: 3,
  lazyConnect: true,
});

/**
 * Clean all tables and Redis for a fresh test state.
 * Uses admin connection to bypass RLS.
 * Order matters due to foreign key constraints.
 */
export async function cleanDatabase() {
  // Delete in reverse dependency order using admin (bypasses RLS)
  await adminPrisma.outboxEvent.deleteMany();
  await adminPrisma.userConsent.deleteMany();
  await adminPrisma.retentionPolicy.deleteMany();
  await adminPrisma.dsarRequest.deleteMany();
  await adminPrisma.auditEvent.deleteMany();
  await adminPrisma.stripeWebhookEvent.deleteMany();
  await adminPrisma.payment.deleteMany();
  await adminPrisma.submissionHistory.deleteMany();
  await adminPrisma.submissionFile.deleteMany();
  await adminPrisma.submission.deleteMany();
  await adminPrisma.submissionPeriod.deleteMany();
  await adminPrisma.organizationMember.deleteMany();
  await adminPrisma.userIdentity.deleteMany();
  await adminPrisma.user.deleteMany();
  await adminPrisma.organization.deleteMany();

  // Flush Redis to clear refresh tokens, rate limiter state, etc.
  try {
    await testRedis.flushdb();
  } catch {
    // Redis may not be connected yet on first call; connect and retry
    await testRedis.connect().catch(() => {});
    await testRedis.flushdb().catch(() => {});
  }
}

/**
 * Get the admin Prisma client (superuser - bypasses RLS).
 * Use this for test data setup and teardown.
 */
export function getTestPrisma() {
  return adminPrisma;
}

/**
 * Get the app Prisma client (non-superuser - enforces RLS).
 * Use this for testing RLS-protected operations.
 */
export function getAppPrisma() {
  return appPrisma;
}

/**
 * Disconnect all test clients.
 * Only call this once at process exit — not in individual suite afterAll hooks.
 */
export async function disconnectTestPrisma() {
  await adminPrisma.$disconnect();
  await appPrisma.$disconnect();
  await testRedis.quit().catch(() => {});
}
