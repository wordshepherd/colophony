import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ORPCError } from '@orpc/server';

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
import { organizationsRouter } from './organizations.js';
import type { RestContext } from '../context.js';
import { createProcedureClient } from '@orpc/server';

const mockService = vi.mocked(organizationService);

// Deterministic UUIDs for tests
const USER_ID = 'a0000000-0000-4000-a000-000000000001';
const ORG_ID = 'b0000000-0000-4000-a000-000000000001';
const MEMBER_ID = 'c0000000-0000-4000-a000-000000000001';

// ---------------------------------------------------------------------------
// Context helpers (mirror the tRPC test helpers)
// ---------------------------------------------------------------------------

function baseContext(): RestContext {
  return {
    authContext: null,
    dbTx: null,
    audit: vi.fn(),
  };
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

function orgContext(
  role: 'ADMIN' | 'EDITOR' | 'READER' = 'ADMIN',
): RestContext {
  return {
    authContext: {
      userId: USER_ID,
      zitadelUserId: 'zid-1',
      email: 'test@example.com',
      emailVerified: true,
      authMethod: 'test',
      orgId: ORG_ID,
      role,
    },
    dbTx: {} as never,
    audit: vi.fn(),
  };
}

function apiKeyContext(
  scopes: string[],
  role: 'ADMIN' | 'EDITOR' | 'READER' = 'ADMIN',
): RestContext {
  return {
    authContext: {
      userId: USER_ID,
      email: 'test@example.com',
      emailVerified: true,
      authMethod: 'apikey',
      apiKeyId: 'k0000000-0000-4000-a000-000000000001',
      apiKeyScopes: scopes as any,
      orgId: ORG_ID,
      role,
    },
    dbTx: {} as never,
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

/**
 * Create a typed client for a single oRPC procedure.
 * This calls the handler directly (like tRPC's createCaller).
 */
function client<T>(procedure: T, context: RestContext) {
  return createProcedureClient(procedure as any, { context }) as any;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('organizations REST router', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /organizations (list)', () => {
    it('requires authentication', async () => {
      const call = client(organizationsRouter.list, baseContext());
      await expect(call({})).rejects.toThrow(ORPCError);
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

      const call = client(organizationsRouter.list, authedContext());
      const result = await call({});
      expect(result).toEqual(orgs);
      expect(mockService.listUserOrganizations).toHaveBeenCalledWith(USER_ID); // eslint-disable-line @typescript-eslint/unbound-method
    });
  });

  describe('POST /organizations (create)', () => {
    it('requires authentication', async () => {
      const call = client(organizationsRouter.create, baseContext());
      await expect(call({ name: 'Test', slug: 'test' })).rejects.toThrow(
        ORPCError,
      );
    });

    it('checks slug availability and creates org', async () => {
      mockService.isSlugAvailable.mockResolvedValueOnce(true);
      mockService.createWithAudit.mockResolvedValueOnce({
        organization: { id: 'org-new', name: 'Test', slug: 'test' },
        membership: { id: 'mem-1', role: 'ADMIN' },
      } as never);

      const ctx = authedContext();
      const call = client(organizationsRouter.create, ctx);
      const result = await call({ name: 'Test', slug: 'test' });

      expect(result.organization.id).toBe('org-new');
      expect(mockService.isSlugAvailable).toHaveBeenCalledWith('test'); // eslint-disable-line @typescript-eslint/unbound-method
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(mockService.createWithAudit).toHaveBeenCalledWith(
        expect.any(Function),
        { name: 'Test', slug: 'test' },
        USER_ID,
      );
    });

    it('throws CONFLICT when slug is taken', async () => {
      mockService.isSlugAvailable.mockResolvedValueOnce(false);

      const call = client(organizationsRouter.create, authedContext());
      await expect(call({ name: 'Test', slug: 'taken' })).rejects.toThrow(
        'already taken',
      );
    });

    it('maps 23505 to CONFLICT on unique constraint race', async () => {
      mockService.isSlugAvailable.mockResolvedValueOnce(true);
      const pgError = Object.assign(
        new Error('duplicate key value violates unique constraint'),
        { code: '23505' },
      );
      mockService.createWithAudit.mockRejectedValueOnce(pgError);

      const call = client(organizationsRouter.create, authedContext());
      await expect(call({ name: 'Test', slug: 'race' })).rejects.toThrow(
        'already exists',
      );
    });
  });

  describe('GET /organizations/check-slug', () => {
    it('returns availability', async () => {
      mockService.isSlugAvailable.mockResolvedValueOnce(true);

      const call = client(organizationsRouter.checkSlug, authedContext());
      const result = await call({ slug: 'available' });
      expect(result).toEqual({ available: true });
    });
  });

  describe('orgId path/header mismatch', () => {
    it('rejects when path orgId does not match header org context', async () => {
      const WRONG_ORG = 'c0000000-0000-4000-a000-000000000099';
      const call = client(organizationsRouter.get, orgContext());
      await expect(call({ orgId: WRONG_ORG })).rejects.toThrow(
        'does not match',
      );
    });
  });

  describe('GET /organizations/{orgId} (get)', () => {
    it('requires org context', async () => {
      const call = client(organizationsRouter.get, authedContext());
      await expect(call({ orgId: ORG_ID })).rejects.toThrow(ORPCError);
    });

    it('returns organization', async () => {
      const org = { id: 'org-1', name: 'Org', slug: 'org' };
      mockService.getById.mockResolvedValueOnce(org as never);

      const call = client(organizationsRouter.get, orgContext());
      const result = await call({ orgId: ORG_ID });
      expect(result).toEqual(org);
    });

    it('throws NOT_FOUND when org missing', async () => {
      mockService.getById.mockResolvedValueOnce(null as never);

      const call = client(organizationsRouter.get, orgContext());
      await expect(call({ orgId: ORG_ID })).rejects.toThrow('not found');
    });
  });

  describe('PATCH /organizations/{orgId} (update)', () => {
    it('requires admin role', async () => {
      const call = client(organizationsRouter.update, orgContext('EDITOR'));
      await expect(call({ orgId: ORG_ID, name: 'New Name' })).rejects.toThrow(
        'Admin role required',
      );
    });

    it('updates organization via updateWithAudit', async () => {
      const updated = { id: 'org-1', name: 'New' };
      mockService.updateWithAudit.mockResolvedValueOnce(updated as never);

      const call = client(organizationsRouter.update, orgContext('ADMIN'));
      const result = await call({ orgId: ORG_ID, name: 'New' });
      expect(result).toEqual(updated);
    });

    it('maps NotFoundError to NOT_FOUND', async () => {
      mockService.updateWithAudit.mockRejectedValueOnce(
        new NotFoundError('Organization not found'),
      );

      const call = client(organizationsRouter.update, orgContext('ADMIN'));
      await expect(call({ orgId: ORG_ID, name: 'New' })).rejects.toThrow(
        'not found',
      );
    });
  });

  describe('GET /organizations/{orgId}/members (list)', () => {
    it('requires org context', async () => {
      const call = client(organizationsRouter.members.list, authedContext());
      await expect(call({ orgId: ORG_ID, page: 1, limit: 20 })).rejects.toThrow(
        ORPCError,
      );
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

      const call = client(organizationsRouter.members.list, orgContext());
      const result = await call({ orgId: ORG_ID, page: 1, limit: 20 });
      expect(result.items).toHaveLength(1);
    });
  });

  describe('POST /organizations/{orgId}/members (add)', () => {
    it('requires admin role', async () => {
      const call = client(
        organizationsRouter.members.add,
        orgContext('READER'),
      );
      await expect(
        call({
          orgId: ORG_ID,
          email: 'new@example.com',
          role: 'READER',
        }),
      ).rejects.toThrow('Admin role required');
    });

    it('adds member via addMemberWithAudit', async () => {
      const member = { id: 'mem-new', userId: 'u-2', role: 'READER' };
      mockService.addMemberWithAudit.mockResolvedValueOnce(member as never);

      const call = client(organizationsRouter.members.add, orgContext('ADMIN'));
      const result = await call({
        orgId: ORG_ID,
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

      const call = client(organizationsRouter.members.add, orgContext('ADMIN'));
      await expect(
        call({
          orgId: ORG_ID,
          email: 'nobody@example.com',
          role: 'READER',
        }),
      ).rejects.toThrow(ORPCError);
    });
  });

  describe('DELETE /organizations/{orgId}/members/{memberId} (remove)', () => {
    it('removes member via removeMemberWithAudit', async () => {
      mockService.removeMemberWithAudit.mockResolvedValueOnce({
        success: true,
      } as never);

      const call = client(
        organizationsRouter.members.remove,
        orgContext('ADMIN'),
      );
      const result = await call({
        orgId: ORG_ID,
        memberId: MEMBER_ID,
      });
      expect(result).toEqual({ success: true });
    });

    it('maps LastAdminError to BAD_REQUEST', async () => {
      const { LastAdminError } =
        await import('../../services/organization.service.js');
      mockService.removeMemberWithAudit.mockRejectedValueOnce(
        new LastAdminError(),
      );

      const call = client(
        organizationsRouter.members.remove,
        orgContext('ADMIN'),
      );
      await expect(
        call({
          orgId: ORG_ID,
          memberId: MEMBER_ID,
        }),
      ).rejects.toThrow('last admin');
    });
  });

  describe('PATCH /organizations/{orgId}/members/{memberId} (updateRole)', () => {
    it('updates role via updateMemberRoleWithAudit', async () => {
      mockService.updateMemberRoleWithAudit.mockResolvedValueOnce({
        id: 'mem-1',
        role: 'EDITOR',
      } as never);

      const call = client(
        organizationsRouter.members.updateRole,
        orgContext('ADMIN'),
      );
      const result = await call({
        orgId: ORG_ID,
        memberId: MEMBER_ID,
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

      const call = client(
        organizationsRouter.members.updateRole,
        orgContext('ADMIN'),
      );
      await expect(
        call({
          orgId: ORG_ID,
          memberId: MEMBER_ID,
          role: 'READER',
        }),
      ).rejects.toThrow('last admin');
    });
  });

  // -------------------------------------------------------------------------
  // API key scope enforcement
  // -------------------------------------------------------------------------

  describe('API key scope enforcement', () => {
    it('denies organizations:read route with wrong scope', async () => {
      const ctx = apiKeyContext(['submissions:read']);
      const call = client(organizationsRouter.get, ctx);
      await expect(call({ orgId: ORG_ID })).rejects.toThrow(
        'Insufficient API key scope',
      );
    });

    it('denies organizations:write route with only read scope', async () => {
      const ctx = apiKeyContext(['organizations:read']);
      const call = client(organizationsRouter.update, ctx);
      await expect(call({ orgId: ORG_ID, name: 'New' })).rejects.toThrow(
        'Insufficient API key scope',
      );
    });

    it('denies list orgs with wrong scope (authed-level route)', async () => {
      const ctx = apiKeyAuthedContext(['submissions:read']);
      const call = client(organizationsRouter.list, ctx);
      await expect(call({})).rejects.toThrow('Insufficient API key scope');
    });

    it('allows API key with correct read scope', async () => {
      const org = { id: ORG_ID, name: 'Org', slug: 'org' };
      mockService.getById.mockResolvedValueOnce(org as never);

      const ctx = apiKeyContext(['organizations:read']);
      const call = client(organizationsRouter.get, ctx);
      const result = await call({ orgId: ORG_ID });
      expect(result).toEqual(org);
    });
  });
});
