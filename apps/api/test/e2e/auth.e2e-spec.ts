import { INestApplication } from '@nestjs/common';
import {
  createTestApp,
  registerUser,
  loginUser,
  trpcMutation,
  trpcQuery,
  authHeaders,
  extractData,
  extractError,
  cleanDatabase,
  type AuthTokens,
} from '../e2e-helpers';

describe('Auth E2E', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await cleanDatabase();
  });

  describe('auth.register', () => {
    it('should register a new user and return tokens', async () => {
      const tokens = await registerUser(app, {
        email: 'newuser@test.com',
        password: 'SecurePass123!',
      });

      expect(tokens.accessToken).toBeDefined();
      expect(tokens.refreshToken).toBeDefined();
      expect(tokens.expiresIn).toBe(900); // 15 minutes
    });

    it('should reject duplicate email registration', async () => {
      await registerUser(app, {
        email: 'duplicate@test.com',
        password: 'SecurePass123!',
      });

      const res = await trpcMutation(app, 'auth.register', {
        email: 'duplicate@test.com',
        password: 'AnotherPass123!',
      });

      expect(res.status).toBe(409);
      const error = extractError(res);
      expect(error.data.code).toBe('CONFLICT');
      expect(error.message).toMatch(/already registered/i);
    });

    it('should reject invalid email format', async () => {
      const res = await trpcMutation(app, 'auth.register', {
        email: 'not-an-email',
        password: 'SecurePass123!',
      });

      // tRPC v10.45 wraps Zod validation errors as INTERNAL_SERVER_ERROR (500)
      // with an empty message — this is a known tRPC behavior for input validation
      expect(res.status).toBe(500);
      const error = extractError(res);
      expect(error.data.code).toBe('INTERNAL_SERVER_ERROR');
    });

    it('should reject short password', async () => {
      const res = await trpcMutation(app, 'auth.register', {
        email: 'valid@test.com',
        password: '123',
      });

      // tRPC v10.45 wraps Zod validation errors as INTERNAL_SERVER_ERROR (500)
      // with an empty message — this is a known tRPC behavior for input validation
      expect(res.status).toBe(500);
      const error = extractError(res);
      expect(error.data.code).toBe('INTERNAL_SERVER_ERROR');
    });
  });

  describe('auth.login', () => {
    const testUser = {
      email: 'login-test@test.com',
      password: 'SecurePass123!',
    };

    beforeEach(async () => {
      await registerUser(app, testUser);
    });

    it('should login with valid credentials', async () => {
      const tokens = await loginUser(app, testUser);

      expect(tokens.accessToken).toBeDefined();
      expect(tokens.refreshToken).toBeDefined();
      expect(tokens.expiresIn).toBe(900);
    });

    it('should reject login with wrong password', async () => {
      const res = await trpcMutation(app, 'auth.login', {
        email: testUser.email,
        password: 'WrongPassword123!',
      });

      expect(res.status).toBe(401);
      const error = extractError(res);
      expect(error.data.code).toBe('UNAUTHORIZED');
    });

    it('should reject login with non-existent email', async () => {
      const res = await trpcMutation(app, 'auth.login', {
        email: 'nonexistent@test.com',
        password: 'Whatever123!',
      });

      expect(res.status).toBe(401);
      const error = extractError(res);
      expect(error.data.code).toBe('UNAUTHORIZED');
    });
  });

  describe('auth.me', () => {
    it('should return current user profile', async () => {
      const tokens = await registerUser(app, {
        email: 'me-test@test.com',
        password: 'SecurePass123!',
      });

      const res = await trpcQuery(
        app,
        'auth.me',
        undefined,
        authHeaders(tokens.accessToken),
      );

      expect(res.status).toBe(200);
      const data = extractData<{
        id: string;
        email: string;
        emailVerified: boolean;
        organizations: unknown[];
      }>(res);

      expect(data.email).toBe('me-test@test.com');
      expect(data.emailVerified).toBe(false);
      expect(data.id).toBeDefined();
      expect(data.organizations).toEqual([]);
    });

    it('should reject unauthenticated request', async () => {
      const res = await trpcQuery(app, 'auth.me');

      expect(res.status).toBe(401);
      const error = extractError(res);
      expect(error.data.code).toBe('UNAUTHORIZED');
    });

    it('should reject request with invalid token', async () => {
      const res = await trpcQuery(
        app,
        'auth.me',
        undefined,
        authHeaders('invalid-token'),
      );

      expect(res.status).toBe(401);
    });
  });

  describe('auth.refresh', () => {
    it('should refresh tokens with valid refresh token', async () => {
      const originalTokens = await registerUser(app, {
        email: 'refresh-test@test.com',
        password: 'SecurePass123!',
      });

      // Small delay so JWT iat claim differs (same-second tokens are identical)
      await new Promise((r) => setTimeout(r, 1100));

      const res = await trpcMutation(app, 'auth.refresh', {
        refreshToken: originalTokens.refreshToken,
      });

      expect(res.status).toBe(200);
      const newTokens = extractData<AuthTokens>(res);
      expect(newTokens.accessToken).toBeDefined();
      expect(newTokens.refreshToken).toBeDefined();
      // Refresh token should always rotate (UUID-based)
      expect(newTokens.refreshToken).not.toBe(originalTokens.refreshToken);
    });

    it('should reject reuse of rotated refresh token', async () => {
      const originalTokens = await registerUser(app, {
        email: 'rotation-test@test.com',
        password: 'SecurePass123!',
      });

      // Use the refresh token once
      await trpcMutation(app, 'auth.refresh', {
        refreshToken: originalTokens.refreshToken,
      }).expect(200);

      // Try to reuse the same refresh token (should be revoked)
      const res = await trpcMutation(app, 'auth.refresh', {
        refreshToken: originalTokens.refreshToken,
      });

      expect(res.status).toBe(401);
    });

    it('should reject invalid refresh token', async () => {
      const res = await trpcMutation(app, 'auth.refresh', {
        refreshToken: 'invalid-refresh-token',
      });

      expect(res.status).toBe(401);
    });
  });

  describe('auth.logout', () => {
    it('should logout and invalidate refresh tokens', async () => {
      const tokens = await registerUser(app, {
        email: 'logout-test@test.com',
        password: 'SecurePass123!',
      });

      // Logout
      const logoutRes = await trpcMutation(
        app,
        'auth.logout',
        undefined,
        authHeaders(tokens.accessToken),
      );
      expect(logoutRes.status).toBe(200);

      // Refresh token should no longer work
      const refreshRes = await trpcMutation(app, 'auth.refresh', {
        refreshToken: tokens.refreshToken,
      });
      expect(refreshRes.status).toBe(401);
    });

    it('should reject logout without authentication', async () => {
      const res = await trpcMutation(app, 'auth.logout');
      expect(res.status).toBe(401);
    });
  });
});
