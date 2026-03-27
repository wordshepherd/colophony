import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockPoolQuery, mockClientQuery, mockClientRelease, mockPoolConnect } =
  vi.hoisted(() => {
    const mockPoolQuery = vi.fn();
    const mockClientQuery = vi.fn();
    const mockClientRelease = vi.fn();
    const mockPoolConnect = vi.fn();
    return {
      mockPoolQuery,
      mockClientQuery,
      mockClientRelease,
      mockPoolConnect,
    };
  });

// Mock Drizzle insert/select/update/delete chains
const mockReturning = vi.fn();
const mockLimit = vi.fn();
const mockOffset = vi.fn();
const mockWhere = vi.fn();
const mockSet = vi.fn();
const mockValues = vi.fn();
const mockFrom = vi.fn();
const mockInnerJoin = vi.fn();
const mockOrderBy = vi.fn();

// Reset chain mocks to build fluent API
function resetChainMocks() {
  // select chain: select().from().where().limit().offset()
  mockReturning.mockReturnValue([]);
  mockLimit.mockReturnValue({ offset: mockOffset });
  mockOffset.mockResolvedValue([]);
  mockWhere.mockReturnValue({ returning: mockReturning, limit: mockLimit });
  mockFrom.mockReturnValue({
    where: mockWhere,
    innerJoin: mockInnerJoin,
    limit: mockLimit,
    orderBy: mockOrderBy,
  });
  mockInnerJoin.mockReturnValue({
    orderBy: mockOrderBy,
    where: mockWhere,
  });
  mockOrderBy.mockReturnValue({
    limit: mockLimit,
  });
  mockLimit.mockReturnValue({
    offset: mockOffset,
  });
  mockOffset.mockResolvedValue([]);
  mockValues.mockReturnValue({ returning: mockReturning });
  mockSet.mockReturnValue({ where: mockWhere });
}

vi.mock('@colophony/db', () => ({
  pool: {
    query: mockPoolQuery,
    connect: mockPoolConnect,
  },
  organizations: {
    id: 'id',
    name: 'name',
    slug: 'slug',
    settings: 'settings',
    updatedAt: 'updated_at',
    createdAt: 'created_at',
  },
  organizationMembers: {
    id: 'id',
    organizationId: 'organization_id',
    userId: 'user_id',
    roles: 'roles',
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  },
  users: { id: 'id', email: 'email' },
  eq: vi.fn(),
  and: vi.fn(),
  sql: vi.fn(),
}));

vi.mock('drizzle-orm/node-postgres', () => ({
  drizzle: vi.fn(() => ({
    select: vi.fn(() => ({ from: mockFrom })),
    insert: vi.fn(() => ({ values: mockValues })),
    update: vi.fn(() => ({ set: mockSet })),
    delete: vi.fn(() => ({ where: mockWhere })),
  })),
}));

import {
  organizationService,
  UserNotFoundError,
} from './organization.service.js';

describe('organizationService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPoolConnect.mockResolvedValue({
      query: mockClientQuery,
      release: mockClientRelease,
    });
    mockClientQuery.mockResolvedValue({ rows: [] });
    resetChainMocks();
  });

  describe('listUserOrganizations', () => {
    it('calls SECURITY DEFINER function and maps results', async () => {
      mockPoolQuery.mockResolvedValueOnce({
        rows: [
          {
            organization_id: 'org-1',
            roles: ['ADMIN'],
            organization_name: 'Org One',
            slug: 'org-one',
          },
          {
            organization_id: 'org-2',
            roles: ['READER'],
            organization_name: 'Org Two',
            slug: 'org-two',
          },
        ],
      });

      const result = await organizationService.listUserOrganizations('user-1');
      expect(mockPoolQuery).toHaveBeenCalledWith(
        'SELECT * FROM list_user_organizations($1)',
        ['user-1'],
      );
      expect(result).toEqual([
        {
          organizationId: 'org-1',
          roles: ['ADMIN'],
          name: 'Org One',
          slug: 'org-one',
        },
        {
          organizationId: 'org-2',
          roles: ['READER'],
          name: 'Org Two',
          slug: 'org-two',
        },
      ]);
    });

    it('returns empty array when user has no memberships', async () => {
      mockPoolQuery.mockResolvedValueOnce({ rows: [] });
      const result =
        await organizationService.listUserOrganizations('user-none');
      expect(result).toEqual([]);
    });
  });

  describe('create', () => {
    it('creates org and ADMIN member in a transaction', async () => {
      const fakeOrg = { id: 'org-new', name: 'New Org', slug: 'new-org' };
      const fakeMember = {
        id: 'member-1',
        organizationId: 'org-new',
        userId: 'user-1',
        roles: ['ADMIN'],
      };

      // First insert returns org, second returns member
      mockReturning
        .mockResolvedValueOnce([fakeOrg])
        .mockResolvedValueOnce([fakeMember]);
      mockClientQuery.mockResolvedValue({});

      const result = await organizationService.create(
        { name: 'New Org', slug: 'new-org' },
        'user-1',
      );

      expect(result.organization).toEqual(fakeOrg);
      expect(result.membership).toEqual(fakeMember);
      // BEGIN + 2 set_config + COMMIT = 4 client.query calls
      expect(mockClientQuery).toHaveBeenCalledWith('BEGIN');
      expect(mockClientQuery).toHaveBeenCalledWith('COMMIT');
      expect(mockClientRelease).toHaveBeenCalled();
    });

    it('rolls back on error', async () => {
      mockReturning.mockRejectedValueOnce(new Error('unique constraint'));
      mockClientQuery.mockResolvedValue({});

      await expect(
        organizationService.create({ name: 'Dup', slug: 'dup' }, 'user-1'),
      ).rejects.toThrow('unique constraint');

      expect(mockClientQuery).toHaveBeenCalledWith('ROLLBACK');
      expect(mockClientRelease).toHaveBeenCalled();
    });
  });

  describe('isSlugAvailable', () => {
    it('returns true when slug is not taken', async () => {
      mockPoolQuery.mockResolvedValueOnce({ rows: [] });
      const available = await organizationService.isSlugAvailable('new-slug');
      expect(available).toBe(true);
    });

    it('returns false when slug is taken', async () => {
      mockPoolQuery.mockResolvedValueOnce({ rows: [{ '?column?': 1 }] });
      const available = await organizationService.isSlugAvailable('taken-slug');
      expect(available).toBe(false);
    });
  });

  describe('getById', () => {
    it('returns org when found', async () => {
      const fakeOrg = { id: 'org-1', name: 'Org', slug: 'org' };
      mockLimit.mockResolvedValueOnce([fakeOrg]);

      const mockTx = {
        select: vi.fn(() => ({ from: mockFrom })),
      } as never;

      const result = await organizationService.getById(mockTx, 'org-1');
      expect(result).toEqual(fakeOrg);
    });

    it('returns null when not found', async () => {
      mockLimit.mockResolvedValueOnce([]);
      const mockTx = {
        select: vi.fn(() => ({ from: mockFrom })),
      } as never;

      const result = await organizationService.getById(mockTx, 'org-missing');
      expect(result).toBeNull();
    });
  });

  describe('addMember', () => {
    it('throws UserNotFoundError when email not found', async () => {
      mockLimit.mockResolvedValueOnce([]); // user lookup returns empty

      const mockTx = {
        select: vi.fn(() => ({ from: mockFrom })),
        insert: vi.fn(() => ({ values: mockValues })),
      } as never;

      await expect(
        organizationService.addMember(mockTx, 'org-1', 'nobody@example.com', [
          'READER',
        ]),
      ).rejects.toThrow(UserNotFoundError);
    });
  });
});
