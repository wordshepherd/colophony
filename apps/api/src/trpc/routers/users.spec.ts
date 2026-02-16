import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TRPCError } from '@trpc/server';

// Mock the organization service before importing the router
vi.mock('../../services/organization.service.js', () => ({
  organizationService: {
    listUserOrganizations: vi.fn(),
    create: vi.fn(),
    isSlugAvailable: vi.fn(),
    getById: vi.fn(),
    update: vi.fn(),
    listMembers: vi.fn(),
    addMember: vi.fn(),
    removeMember: vi.fn(),
    updateMemberRole: vi.fn(),
  },
  UserNotFoundError: class UserNotFoundError extends Error {
    name = 'UserNotFoundError';
  },
  SlugTakenError: class SlugTakenError extends Error {
    name = 'SlugTakenError';
  },
  LastAdminError: class LastAdminError extends Error {
    name = 'LastAdminError';
    constructor() {
      super('Cannot remove the last admin of an organization');
    }
  },
}));

// Mock @colophony/db
vi.mock('@colophony/db', () => ({
  pool: {
    query: vi.fn(),
    connect: vi.fn(),
  },
  db: { query: {} },
  organizations: {},
  organizationMembers: {},
  users: {},
  eq: vi.fn(),
  and: vi.fn(),
  sql: vi.fn(),
}));

import { pool } from '@colophony/db';
import { organizationService } from '../../services/organization.service.js';
import { appRouter } from '../router.js';
import type { TRPCContext } from '../context.js';

const mockPool = vi.mocked(pool);
const mockService = vi.mocked(organizationService);

function makeContext(overrides: Partial<TRPCContext> = {}): TRPCContext {
  return {
    authContext: null,
    dbTx: null,
    audit: vi.fn(),
    ...overrides,
  };
}

function authedContext(overrides: Partial<TRPCContext> = {}): TRPCContext {
  return makeContext({
    authContext: {
      userId: 'user-1',
      zitadelUserId: 'zid-1',
      email: 'test@example.com',
      emailVerified: true,
      authMethod: 'test',
    },
    ...overrides,
  });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const createCaller = (appRouter as any).createCaller as (
  ctx: TRPCContext,
) => any;

describe('users tRPC router', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('users.me', () => {
    it('requires authentication', async () => {
      const caller = createCaller(makeContext());
      await expect(caller.users.me()).rejects.toThrow(TRPCError);
    });

    it('returns user profile with org memberships', async () => {
      const userRow = {
        id: 'user-1',
        email: 'test@example.com',
        email_verified: true,
        created_at: new Date('2025-01-01'),
      };
      mockPool.query.mockResolvedValueOnce({ rows: [userRow] } as never);

      const orgs = [
        {
          organizationId: 'org-1',
          role: 'ADMIN' as const,
          name: 'Test Org',
          slug: 'test-org',
        },
      ];
      mockService.listUserOrganizations.mockResolvedValueOnce(orgs);

      const caller = createCaller(authedContext());
      const result = await caller.users.me();

      expect(result).toEqual({
        id: 'user-1',
        email: 'test@example.com',
        emailVerified: true,
        createdAt: new Date('2025-01-01'),
        organizations: [
          {
            organizationId: 'org-1',
            name: 'Test Org',
            slug: 'test-org',
            role: 'ADMIN',
          },
        ],
      });
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT'),
        ['user-1'],
      );
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(mockService.listUserOrganizations).toHaveBeenCalledWith('user-1');
    });

    it('returns null when user not found in database', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [] } as never);

      const caller = createCaller(authedContext());
      const result = await caller.users.me();

      expect(result).toBeNull();
    });
  });
});
