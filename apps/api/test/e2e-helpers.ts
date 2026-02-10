import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { E2eAppModule } from './e2e-app.module';
import {
  cleanDatabase,
  getTestPrisma,
  disconnectTestPrisma,
} from './utils/test-context';
import { createOrg } from './utils/factories/org.factory';
import { createUser, createUserWithOrg } from './utils/factories/user.factory';
import { createSubmission } from './utils/factories/submission.factory';

/**
 * tRPC response types
 */
export interface TrpcSuccessResponse<T = unknown> {
  result: {
    data: T;
  };
}

export interface TrpcErrorResponse {
  error: {
    message: string;
    code: number;
    data: {
      code: string;
      httpStatus: number;
      path: string;
    };
  };
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

/**
 * Create a NestJS application configured for E2E testing.
 *
 * The app uses real PostgreSQL (test DB) and Redis (from docker-compose).
 * Email is disabled (no SMTP_HOST configured in dev mode).
 * Stripe is disabled (no STRIPE_SECRET_KEY).
 *
 * Requirements:
 * - docker-compose up postgres-test redis
 */
export async function createTestApp(): Promise<INestApplication> {
  const moduleRef: TestingModule = await Test.createTestingModule({
    imports: [E2eAppModule],
  }).compile();

  const app = moduleRef.createNestApplication();

  // Match production config: global prefix with tRPC excluded
  app.setGlobalPrefix('api', {
    exclude: ['trpc/(.*)', 'health'],
  });

  app.enableCors({ origin: '*' });

  await app.init();
  return app;
}

/**
 * Register a new user via the tRPC auth.register mutation.
 */
export async function registerUser(
  app: INestApplication,
  input: { email: string; password: string },
): Promise<AuthTokens> {
  const res = await request(app.getHttpServer())
    .post('/trpc/auth.register')
    .send(input)
    .expect(200);

  return extractData<AuthTokens>(res);
}

/**
 * Login a user via the tRPC auth.login mutation.
 */
export async function loginUser(
  app: INestApplication,
  input: { email: string; password: string },
): Promise<AuthTokens> {
  const res = await request(app.getHttpServer())
    .post('/trpc/auth.login')
    .send(input)
    .expect(200);

  return extractData<AuthTokens>(res);
}

/**
 * Call a tRPC mutation (POST request).
 *
 * @example
 * const res = await trpcMutation(app, 'submissions.create', { title: 'My Sub' }, authHeaders(token, orgId));
 * expect(res.status).toBe(200);
 */
export function trpcMutation(
  app: INestApplication,
  path: string,
  input?: unknown,
  headers?: Record<string, string>,
) {
  const req = request(app.getHttpServer()).post(`/trpc/${path}`);

  if (input !== undefined) {
    req.send(input);
  }

  if (headers) {
    for (const [key, value] of Object.entries(headers)) {
      req.set(key, value);
    }
  }

  return req;
}

/**
 * Call a tRPC query (GET request).
 *
 * @example
 * const res = await trpcQuery(app, 'auth.me', undefined, authHeaders(token));
 * expect(res.status).toBe(200);
 */
export function trpcQuery(
  app: INestApplication,
  path: string,
  input?: unknown,
  headers?: Record<string, string>,
) {
  let url = `/trpc/${path}`;
  if (input !== undefined) {
    url += `?input=${encodeURIComponent(JSON.stringify(input))}`;
  }

  const req = request(app.getHttpServer()).get(url);

  if (headers) {
    for (const [key, value] of Object.entries(headers)) {
      req.set(key, value);
    }
  }

  return req;
}

/**
 * Build authorization headers for authenticated requests.
 */
export function authHeaders(
  accessToken: string,
  orgId?: string,
): Record<string, string> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${accessToken}`,
  };
  if (orgId) {
    headers['x-organization-id'] = orgId;
  }
  return headers;
}

/**
 * Extract the data payload from a tRPC success response.
 */
export function extractData<T = unknown>(res: { body: unknown }): T {
  const body = res.body as TrpcSuccessResponse<T>;
  return body.result.data;
}

/**
 * Extract the error from a tRPC error response.
 */
export function extractError(res: {
  body: unknown;
}): TrpcErrorResponse['error'] {
  const body = res.body as TrpcErrorResponse;
  return body.error;
}

/**
 * Create a test user via the API (register through tRPC).
 * Returns auth tokens for the newly created user.
 *
 * This user is created via the actual auth flow (hashed password, JWT).
 * Use this for tests that need realistic authentication.
 */
export async function createTestUserViaApi(
  app: INestApplication,
  email = `test-${Date.now()}@example.com`,
  password = 'TestPassword123!',
): Promise<{ email: string; password: string; tokens: AuthTokens }> {
  const tokens = await registerUser(app, { email, password });
  return { email, password, tokens };
}

/**
 * Create a complete test environment with an org, users, and memberships.
 *
 * Uses factories (admin prisma) for org/membership setup, then registers
 * users through the API to get valid JWT tokens.
 *
 * Returns everything needed for org-scoped E2E tests.
 */
export async function createTestEnvironment(app: INestApplication) {
  const prisma = getTestPrisma();

  // Create org via factory (admin prisma)
  const org = await createOrg({ name: 'Test Org', slug: 'test-org' });

  // Register users via API to get real JWT tokens
  const adminEmail = `admin-${Date.now()}@example.com`;
  const editorEmail = `editor-${Date.now()}@example.com`;
  const readerEmail = `reader-${Date.now()}@example.com`;
  const password = 'TestPassword123!';

  const adminTokens = await registerUser(app, {
    email: adminEmail,
    password,
  });
  const editorTokens = await registerUser(app, {
    email: editorEmail,
    password,
  });
  const readerTokens = await registerUser(app, {
    email: readerEmail,
    password,
  });

  // Look up user IDs from the database
  const adminUser = await prisma.user.findUniqueOrThrow({
    where: { email: adminEmail },
  });
  const editorUser = await prisma.user.findUniqueOrThrow({
    where: { email: editorEmail },
  });
  const readerUser = await prisma.user.findUniqueOrThrow({
    where: { email: readerEmail },
  });

  // Add users to org with appropriate roles (admin prisma bypasses RLS)
  await prisma.organizationMember.createMany({
    data: [
      { userId: adminUser.id, organizationId: org.id, role: 'ADMIN' },
      { userId: editorUser.id, organizationId: org.id, role: 'EDITOR' },
      { userId: readerUser.id, organizationId: org.id, role: 'READER' },
    ],
  });

  return {
    org,
    admin: {
      user: adminUser,
      email: adminEmail,
      password,
      tokens: adminTokens,
      headers: authHeaders(adminTokens.accessToken, org.id),
    },
    editor: {
      user: editorUser,
      email: editorEmail,
      password,
      tokens: editorTokens,
      headers: authHeaders(editorTokens.accessToken, org.id),
    },
    reader: {
      user: readerUser,
      email: readerEmail,
      password,
      tokens: readerTokens,
      headers: authHeaders(readerTokens.accessToken, org.id),
    },
  };
}

// Re-export utilities for convenient access in E2E test files
export {
  cleanDatabase,
  getTestPrisma,
  disconnectTestPrisma,
  createOrg,
  createUser,
  createUserWithOrg,
  createSubmission,
};
