/**
 * E2E Test Setup
 *
 * Sets environment variables BEFORE any modules are loaded.
 * This ensures the prisma singleton and NestJS ConfigModule
 * use the correct test configuration.
 *
 * Requirements:
 * - PostgreSQL test database: docker-compose up postgres-test
 * - Redis: docker-compose up redis
 */

// Point to test database (must be set before prisma singleton is created).
// Use the superuser connection so the prisma singleton bypasses RLS.
// RLS enforcement is tested separately in unit/integration tests.
// The app_user connection can't look up org memberships in createContext()
// because RLS requires current_org to be set (chicken-and-egg problem).
process.env.DATABASE_URL =
  process.env.DATABASE_TEST_URL ||
  'postgresql://test:test@localhost:5433/prospector_test';

// JWT secret must be at least 32 characters
process.env.JWT_SECRET =
  'e2e-test-jwt-secret-that-is-at-least-32-characters-long';

// Redis (used by BullMQ, rate limiting, refresh tokens)
process.env.REDIS_URL = process.env.TEST_REDIS_URL || 'redis://localhost:6379';
process.env.REDIS_HOST = 'localhost';
process.env.REDIS_PORT = '6379';

// Disable email sending (EmailService checks NODE_ENV + SMTP_HOST)
process.env.NODE_ENV = 'development';

// Disable rate limiting for E2E tests (auth: 20/min is too low for test suites)
process.env.RATE_LIMIT_DEFAULT_MAX = '10000';
process.env.RATE_LIMIT_AUTH_MAX = '10000';

// Stripe is disabled by default (no STRIPE_SECRET_KEY)
// Storage defaults to localhost MinIO (won't be used in most E2E tests)

// Extended timeout for database and app bootstrap operations
jest.setTimeout(30000);
