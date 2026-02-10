/**
 * Global test setup
 * Runs before all tests in the test suite.
 *
 * Unit tests mock Prisma and don't need a database.
 * Database connection is only established when DATABASE_TEST_URL is set
 * (i.e., in local dev with docker-compose or in the E2E CI job).
 */

// Extend timeout for database operations
jest.setTimeout(30000);

if (process.env.DATABASE_TEST_URL) {
  process.env.DATABASE_URL = process.env.DATABASE_TEST_URL;
}
