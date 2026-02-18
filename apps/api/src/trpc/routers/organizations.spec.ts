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
    // Access-aware methods (PR 2)
    addMemberWithAudit: vi.fn(),
    removeMemberWithAudit: vi.fn(),
    updateMemberRoleWithAudit: vi.fn(),
    updateWithAudit: vi.fn(),
    createWithAudit: vi.fn(),
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

// Mock @colophony/db (needed by router.ts -> context.ts)
vi.mock('@colophony/db', () => ({
  pool: { query: vi.fn(), connect: vi.fn() },
  db: { query: {} },
  organizations: {},
  organizationMembers: {},
  users: {},
  eq: vi.fn(),
  and: vi.fn(),
  sql: vi.fn(),
}));

import { organizationService } from '../../services/organization.service.js';
import { NotFoundError } from '../../services/errors.js';
import { appRouter } from '../router.js';
import type { TRPCContext } from '../context.js';

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

function orgContext(
  role: 'ADMIN' | 'EDITOR' | 'READER' = 'ADMIN',
  overrides: Partial<TRPCContext> = {},
): TRPCContext {
  const mockTx = {} as never;
  return makeContext({
    authContext: {
      userId: 'user-1',
      zitadelUserId: 'zid-1',
      email: 'test@example.com',
      emailVerified: true,
      authMethod: 'test',
      orgId: 'org-1',
      role,
    },
    dbTx: mockTx,
    audit: vi.fn(),
    ...overrides,
  });
}

// Create a caller factory for testing.
// Cast to any for test caller access. Procedure shapes are tested at runtime.

const createCaller = (appRouter as any).createCaller as (
  ctx: TRPCContext,
) => any;

describe('organizations tRPC router', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('organizations.list', () => {
    it('requires authentication', async () => {
      const caller = createCaller(makeContext());
      await expect(caller.organizations.list()).rejects.toThrow(TRPCError);
    });

    it('returns user organizations', async () => {
      const orgs = [
        {
          organizationId: 'org-1',
          role: 'ADMIN',
          name: 'Org 1',
          slug: 'org-1',
        },
      ];
      mockService.listUserOrganizations.mockResolvedValueOnce(orgs as never);

      const caller = createCaller(authedContext());
      const result = await caller.organizations.list();
      expect(result).toEqual(orgs);
      expect(mockService.listUserOrganizations).toHaveBeenCalledWith('user-1'); // eslint-disable-line @typescript-eslint/unbound-method
    });
  });

  describe('organizations.create', () => {
    it('requires authentication', async () => {
      const caller = createCaller(makeContext());
      await expect(
        caller.organizations.create({ name: 'Test', slug: 'test' }),
      ).rejects.toThrow(TRPCError);
    });

    it('checks slug availability and creates org via createWithAudit', async () => {
      mockService.isSlugAvailable.mockResolvedValueOnce(true);
      mockService.createWithAudit.mockResolvedValueOnce({
        organization: { id: 'org-new', name: 'Test', slug: 'test' },
        membership: { id: 'mem-1', role: 'ADMIN' },
      } as never);

      const ctx = authedContext();
      const caller = createCaller(ctx);
      const result = await caller.organizations.create({
        name: 'Test',
        slug: 'test',
      });

      expect(result.organization.id).toBe('org-new');
      expect(mockService.isSlugAvailable).toHaveBeenCalledWith('test'); // eslint-disable-line @typescript-eslint/unbound-method
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(mockService.createWithAudit).toHaveBeenCalledWith(
        expect.any(Function), // audit fn
        { name: 'Test', slug: 'test' },
        'user-1',
      );
    });

    it('throws CONFLICT when slug is taken', async () => {
      mockService.isSlugAvailable.mockResolvedValueOnce(false);

      const caller = createCaller(authedContext());
      await expect(
        caller.organizations.create({ name: 'Test', slug: 'taken' }),
      ).rejects.toThrow('already taken');
    });

    it('maps 23505 to CONFLICT on unique constraint race', async () => {
      mockService.isSlugAvailable.mockResolvedValueOnce(true);
      const pgError = new Error(
        'duplicate key value violates unique constraint',
      );
      (pgError as unknown as { code: string }).code = '23505';
      mockService.createWithAudit.mockRejectedValueOnce(pgError);

      const caller = createCaller(authedContext());
      await expect(
        caller.organizations.create({ name: 'Test', slug: 'race' }),
      ).rejects.toThrow('already exists');
    });
  });

  describe('organizations.get', () => {
    it('requires org context', async () => {
      const caller = createCaller(authedContext());
      await expect(caller.organizations.get()).rejects.toThrow(TRPCError);
    });

    it('returns organization', async () => {
      const org = { id: 'org-1', name: 'Org', slug: 'org' };
      mockService.getById.mockResolvedValueOnce(org as never);

      const caller = createCaller(orgContext());
      const result = await caller.organizations.get();
      expect(result).toEqual(org);
    });

    it('throws NOT_FOUND when org missing', async () => {
      mockService.getById.mockResolvedValueOnce(null as never);

      const caller = createCaller(orgContext());
      await expect(caller.organizations.get()).rejects.toThrow('not found');
    });
  });

  describe('organizations.update', () => {
    it('requires admin role', async () => {
      const caller = createCaller(orgContext('EDITOR'));
      await expect(
        caller.organizations.update({ name: 'New Name' }),
      ).rejects.toThrow('Admin role required');
    });

    it('updates organization via updateWithAudit', async () => {
      const updated = { id: 'org-1', name: 'New' };
      mockService.updateWithAudit.mockResolvedValueOnce(updated as never);

      const ctx = orgContext('ADMIN');
      const caller = createCaller(ctx);
      const result = await caller.organizations.update({ name: 'New' });
      expect(result).toEqual(updated);
    });

    it('maps NotFoundError to NOT_FOUND', async () => {
      mockService.updateWithAudit.mockRejectedValueOnce(
        new NotFoundError('Organization not found'),
      );

      const caller = createCaller(orgContext('ADMIN'));
      await expect(
        caller.organizations.update({ name: 'New' }),
      ).rejects.toThrow('not found');
    });
  });

  describe('organizations.checkSlug', () => {
    it('returns availability', async () => {
      mockService.isSlugAvailable.mockResolvedValueOnce(true);

      const caller = createCaller(authedContext());
      const result = await caller.organizations.checkSlug({
        slug: 'available',
      });
      expect(result).toEqual({ available: true });
    });

    it('rejects invalid slug format', async () => {
      const caller = createCaller(authedContext());
      await expect(
        caller.organizations.checkSlug({ slug: 'UPPER_CASE!' }),
      ).rejects.toThrow();
    });
  });

  describe('organizations.members.list', () => {
    it('requires org context', async () => {
      const caller = createCaller(authedContext());
      await expect(
        caller.organizations.members.list({ page: 1, limit: 20 }),
      ).rejects.toThrow(TRPCError);
    });

    it('returns paginated members', async () => {
      const response = {
        items: [{ id: 'mem-1', userId: 'u-1', role: 'ADMIN', email: 'a@b.c' }],
        total: 1,
        page: 1,
        limit: 20,
        totalPages: 1,
      };
      mockService.listMembers.mockResolvedValueOnce(response as never);

      const caller = createCaller(orgContext());
      const result = await caller.organizations.members.list({
        page: 1,
        limit: 20,
      });
      expect(result.items).toHaveLength(1);
    });
  });

  describe('organizations.members.add', () => {
    it('requires admin role', async () => {
      const caller = createCaller(orgContext('READER'));
      await expect(
        caller.organizations.members.add({
          email: 'new@example.com',
          role: 'READER',
        }),
      ).rejects.toThrow('Admin role required');
    });

    it('adds member via addMemberWithAudit', async () => {
      const member = { id: 'mem-new', userId: 'u-2', role: 'READER' };
      mockService.addMemberWithAudit.mockResolvedValueOnce(member as never);

      const ctx = orgContext('ADMIN');
      const caller = createCaller(ctx);
      const result = await caller.organizations.members.add({
        email: 'new@example.com',
        role: 'READER',
      });
      expect(result).toEqual(member);
    });

    it('maps UserNotFoundError to NOT_FOUND', async () => {
      const { UserNotFoundError } =
        await import('../../services/organization.service.js');
      mockService.addMemberWithAudit.mockRejectedValueOnce(
        new UserNotFoundError('nobody@example.com'),
      );

      const caller = createCaller(orgContext('ADMIN'));
      await expect(
        caller.organizations.members.add({
          email: 'nobody@example.com',
          role: 'READER',
        }),
      ).rejects.toThrow(TRPCError);
    });

    it('maps 23505 to CONFLICT', async () => {
      const pgError = new Error('duplicate key');
      (pgError as unknown as { code: string }).code = '23505';
      mockService.addMemberWithAudit.mockRejectedValueOnce(pgError);

      const caller = createCaller(orgContext('ADMIN'));
      await expect(
        caller.organizations.members.add({
          email: 'dup@example.com',
          role: 'READER',
        }),
      ).rejects.toThrow('already exists');
    });
  });

  describe('organizations.members.remove', () => {
    it('removes member via removeMemberWithAudit', async () => {
      mockService.removeMemberWithAudit.mockResolvedValueOnce({
        success: true,
      } as never);

      const ctx = orgContext('ADMIN');
      const caller = createCaller(ctx);
      const result = await caller.organizations.members.remove({
        memberId: 'a1111111-1111-1111-a111-111111111111',
      });
      expect(result).toEqual({ success: true });
    });

    it('maps NotFoundError to NOT_FOUND', async () => {
      mockService.removeMemberWithAudit.mockRejectedValueOnce(
        new NotFoundError('Member not found'),
      );

      const caller = createCaller(orgContext('ADMIN'));
      await expect(
        caller.organizations.members.remove({
          memberId: 'a1111111-1111-1111-a111-111111111111',
        }),
      ).rejects.toThrow('not found');
    });

    it('maps LastAdminError to BAD_REQUEST', async () => {
      const { LastAdminError } =
        await import('../../services/organization.service.js');
      mockService.removeMemberWithAudit.mockRejectedValueOnce(
        new LastAdminError(),
      );

      const caller = createCaller(orgContext('ADMIN'));
      await expect(
        caller.organizations.members.remove({
          memberId: 'a1111111-1111-1111-a111-111111111111',
        }),
      ).rejects.toThrow('last admin');
    });
  });

  describe('organizations.members.updateRole', () => {
    it('updates role via updateMemberRoleWithAudit', async () => {
      mockService.updateMemberRoleWithAudit.mockResolvedValueOnce({
        id: 'mem-1',
        role: 'EDITOR',
      } as never);

      const ctx = orgContext('ADMIN');
      const caller = createCaller(ctx);
      const result = await caller.organizations.members.updateRole({
        memberId: 'a1111111-1111-1111-a111-111111111111',
        role: 'EDITOR',
      });
      expect(result.role).toBe('EDITOR');
    });

    it('maps LastAdminError to BAD_REQUEST', async () => {
      const { LastAdminError } =
        await import('../../services/organization.service.js');
      mockService.updateMemberRoleWithAudit.mockRejectedValueOnce(
        new LastAdminError(),
      );

      const caller = createCaller(orgContext('ADMIN'));
      await expect(
        caller.organizations.members.updateRole({
          memberId: 'a1111111-1111-1111-a111-111111111111',
          role: 'READER',
        }),
      ).rejects.toThrow('last admin');
    });
  });
});
