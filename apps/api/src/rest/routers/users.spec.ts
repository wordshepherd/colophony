import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ORPCError } from '@orpc/server';

vi.mock('../../services/user.service.js', () => ({
  userService: {
    getProfile: vi.fn(),
  },
}));

vi.mock('../../services/organization.service.js', () => ({
  organizationService: {
    listUserOrganizations: vi.fn(),
  },
}));

vi.mock('@colophony/db', () => ({
  pool: { query: vi.fn(), connect: vi.fn() },
  db: { query: {} },
  users: {},
  eq: vi.fn(),
}));

import { userService } from '../../services/user.service.js';
import { usersRouter } from './users.js';
import type { RestContext } from '../context.js';
import { createProcedureClient } from '@orpc/server';

const mockUserService = vi.mocked(userService);

const USER_ID = 'a0000000-0000-4000-a000-000000000001';

function baseContext(): RestContext {
  return { authContext: null, dbTx: null, audit: vi.fn() };
}

function authedContext(): RestContext {
  return {
    authContext: {
      userId: USER_ID,
      zitadelUserId: 'zid-1',
      email: 'test@example.com',
      emailVerified: true,
      authMethod: 'test',
    },
    dbTx: null,
    audit: vi.fn(),
  };
}

function apiKeyAuthedContext(scopes: string[]): RestContext {
  return {
    authContext: {
      userId: USER_ID,
      email: 'test@example.com',
      emailVerified: true,
      authMethod: 'apikey',
      apiKeyId: 'k0000000-0000-4000-a000-000000000001',
      apiKeyScopes: scopes as any,
    },
    dbTx: null,
    audit: vi.fn(),
  };
}

function client<T>(procedure: T, context: RestContext) {
  return createProcedureClient(procedure as any, { context }) as any;
}

describe('users REST router', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /users/me', () => {
    it('requires authentication', async () => {
      const call = client(usersRouter.me, baseContext());
      await expect(call({})).rejects.toThrow(ORPCError);
    });

    it('returns user profile', async () => {
      const profile = {
        id: USER_ID,
        email: 'test@example.com',
        emailVerified: true,
        createdAt: new Date(),
        organizations: [],
      };
      mockUserService.getProfile.mockResolvedValueOnce(profile as never);

      const call = client(usersRouter.me, authedContext());
      const result = await call({});
      expect(result.id).toBe(USER_ID);
      expect(result.email).toBe('test@example.com');
    });

    it('throws NOT_FOUND when user profile is null', async () => {
      mockUserService.getProfile.mockResolvedValueOnce(null as never);

      const call = client(usersRouter.me, authedContext());
      await expect(call({})).rejects.toThrow('User not found');
    });
  });

  // -------------------------------------------------------------------------
  // API key scope enforcement
  // -------------------------------------------------------------------------

  describe('API key scope enforcement', () => {
    it('denies users:read with wrong scope', async () => {
      const ctx = apiKeyAuthedContext(['submissions:read']);
      const call = client(usersRouter.me, ctx);
      await expect(call({})).rejects.toThrow('Insufficient API key scope');
    });

    it('allows API key with users:read scope', async () => {
      const profile = {
        id: USER_ID,
        email: 'test@example.com',
        emailVerified: true,
        createdAt: new Date(),
        organizations: [],
      };
      mockUserService.getProfile.mockResolvedValueOnce(profile as never);

      const ctx = apiKeyAuthedContext(['users:read']);
      const call = client(usersRouter.me, ctx);
      const result = await call({});
      expect(result.id).toBe(USER_ID);
    });
  });
});
