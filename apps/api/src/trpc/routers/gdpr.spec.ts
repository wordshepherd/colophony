import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TRPCError } from '@trpc/server';

const { mockDeleteUser, mockDeleteOrganization } = vi.hoisted(() => ({
  mockDeleteUser: vi.fn(),
  mockDeleteOrganization: vi.fn(),
}));

vi.mock('../../services/gdpr.service.js', () => ({
  gdprService: {
    deleteUser: mockDeleteUser,
    deleteOrganization: mockDeleteOrganization,
  },
  UserNotDeletableError: class UserNotDeletableError extends Error {
    name = 'UserNotDeletableError';
  },
  OrgNotDeletableError: class OrgNotDeletableError extends Error {
    name = 'OrgNotDeletableError';
  },
}));

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
    updateMemberRoles: vi.fn(),
    createWithAudit: vi.fn(),
    updateWithAudit: vi.fn(),
    addMemberWithAudit: vi.fn(),
    removeMemberWithAudit: vi.fn(),
    updateMemberRolesWithAudit: vi.fn(),
  },
  UserNotFoundError: class UserNotFoundError extends Error {
    name = 'UserNotFoundError';
  },
  SlugTakenError: class SlugTakenError extends Error {
    name = 'SlugTakenError';
  },
  LastAdminError: class LastAdminError extends Error {
    name = 'LastAdminError';
  },
}));

vi.mock('../../config/env.js', () => ({
  validateEnv: () => ({
    REDIS_HOST: 'localhost',
    REDIS_PORT: 6379,
    REDIS_PASSWORD: '',
  }),
}));

vi.mock('@colophony/db', () => ({
  pool: { query: vi.fn(), connect: vi.fn() },
  db: { query: {} },
  organizations: {},
  organizationMembers: {},
  users: {},
  auditEvents: {},
  eq: vi.fn(),
  and: vi.fn(),
  sql: vi.fn(),
}));

import { appRouter } from '../router.js';
import type { TRPCContext } from '../context.js';

const USER_ID = '00000000-0000-4000-a000-000000000001';
const ORG_ID = '00000000-0000-4000-a000-000000000010';

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
      userId: USER_ID,
      zitadelUserId: '00000000-0000-4000-a000-000000000099',
      email: 'test@example.com',
      emailVerified: true,
      authMethod: 'test',
    },
    ...overrides,
  });
}

function adminOrgContext(): TRPCContext {
  return makeContext({
    authContext: {
      userId: USER_ID,
      zitadelUserId: '00000000-0000-4000-a000-000000000099',
      email: 'test@example.com',
      emailVerified: true,
      authMethod: 'test',
      orgId: ORG_ID,
      roles: ['ADMIN'],
    },
    dbTx: {} as TRPCContext['dbTx'],
  });
}

const createCaller = (appRouter as any).createCaller as (
  ctx: TRPCContext,
) => any;

describe('gdpr tRPC router', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('gdpr.deleteAccount', () => {
    it('requires authentication', async () => {
      const caller = createCaller(makeContext());
      await expect(caller.gdpr.deleteAccount()).rejects.toThrow(TRPCError);
    });

    it('deletes the user account and returns success', async () => {
      mockDeleteUser.mockResolvedValueOnce({ storageKeysEnqueued: 3 });

      const caller = createCaller(authedContext());
      const result = await caller.gdpr.deleteAccount();

      expect(result).toEqual({
        success: true,
        storageKeysEnqueued: 3,
      });
      expect(mockDeleteUser).toHaveBeenCalledWith(USER_ID, expect.anything());
    });
  });

  describe('organizations.delete', () => {
    it('requires admin role', async () => {
      const editorCtx = makeContext({
        authContext: {
          userId: USER_ID,
          zitadelUserId: '00000000-0000-4000-a000-000000000099',
          email: 'test@example.com',
          emailVerified: true,
          authMethod: 'test',
          orgId: ORG_ID,
          roles: ['EDITOR'],
        },
        dbTx: {} as TRPCContext['dbTx'],
      });
      const caller = createCaller(editorCtx);
      await expect(caller.organizations.delete()).rejects.toThrow(TRPCError);
    });

    it('deletes the organization and returns success', async () => {
      mockDeleteOrganization.mockResolvedValueOnce(undefined);

      const caller = createCaller(adminOrgContext());
      const result = await caller.organizations.delete();

      expect(result).toEqual({ success: true });
      expect(mockDeleteOrganization).toHaveBeenCalledWith(
        ORG_ID,
        USER_ID,
        expect.anything(),
      );
    });
  });
});
