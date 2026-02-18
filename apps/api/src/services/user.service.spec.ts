import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockPoolQuery, mockListUserOrganizations } = vi.hoisted(() => {
  return {
    mockPoolQuery: vi.fn(),
    mockListUserOrganizations: vi.fn(),
  };
});

vi.mock('@colophony/db', () => ({
  pool: { query: mockPoolQuery },
}));

vi.mock('./organization.service.js', () => ({
  organizationService: {
    listUserOrganizations: mockListUserOrganizations,
  },
}));

import { userService } from './user.service.js';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('userService.getProfile', () => {
  it('returns user profile with org memberships', async () => {
    const createdAt = new Date('2024-01-01');
    mockPoolQuery.mockResolvedValueOnce({
      rows: [
        {
          id: 'u1',
          email: 'test@example.com',
          email_verified: true,
          created_at: createdAt,
        },
      ],
    });
    mockListUserOrganizations.mockResolvedValueOnce([
      {
        organizationId: 'o1',
        name: 'Test Org',
        slug: 'test-org',
        role: 'ADMIN',
      },
    ]);

    const result = await userService.getProfile('u1');

    expect(result).toEqual({
      id: 'u1',
      email: 'test@example.com',
      emailVerified: true,
      createdAt: createdAt,
      organizations: [
        {
          id: 'o1',
          name: 'Test Org',
          slug: 'test-org',
          role: 'ADMIN',
        },
      ],
    });
    expect(mockPoolQuery).toHaveBeenCalledWith(
      expect.stringContaining('SELECT id, email'),
      ['u1'],
    );
    expect(mockListUserOrganizations).toHaveBeenCalledWith('u1');
  });

  it('returns null when user not found', async () => {
    mockPoolQuery.mockResolvedValueOnce({ rows: [] });

    const result = await userService.getProfile('nonexistent');

    expect(result).toBeNull();
    expect(mockListUserOrganizations).not.toHaveBeenCalled();
  });

  it('returns empty organizations array when user has no memberships', async () => {
    mockPoolQuery.mockResolvedValueOnce({
      rows: [
        {
          id: 'u2',
          email: 'solo@example.com',
          email_verified: false,
          created_at: new Date(),
        },
      ],
    });
    mockListUserOrganizations.mockResolvedValueOnce([]);

    const result = await userService.getProfile('u2');

    expect(result).not.toBeNull();
    expect(result!.organizations).toEqual([]);
  });
});
