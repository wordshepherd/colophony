import { PrismaClient } from '@prisma/client';

/**
 * Global test setup
 * Runs before all tests in the test suite.
 */

// Extend timeout for database operations
jest.setTimeout(30000);

// Use test database with non-superuser to ensure RLS is enforced
// The app_user role has NOSUPERUSER and NOBYPASSRLS flags
process.env.DATABASE_URL = process.env.DATABASE_TEST_URL ||
  'postgresql://app_user:app_password@localhost:5433/prospector_test';

const prisma = new PrismaClient();

beforeAll(async () => {
  // Connect to test database
  await prisma.$connect();
});

afterAll(async () => {
  // Disconnect from test database
  await prisma.$disconnect();
});

// Export for use in tests
export { prisma };
