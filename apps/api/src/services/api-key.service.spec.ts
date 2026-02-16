import { describe, it, expect, vi, beforeEach } from 'vitest';
import crypto from 'node:crypto';

// vi.hoisted runs before vi.mock hoisting — safe to reference in factories
const { mockPoolQuery } = vi.hoisted(() => {
  const mockPoolQuery = vi.fn();
  return { mockPoolQuery };
});

// Mock @colophony/db
vi.mock('@colophony/db', () => ({
  pool: { query: mockPoolQuery },
  apiKeys: {
    id: 'id',
    organizationId: 'organization_id',
    createdBy: 'created_by',
    name: 'name',
    keyHash: 'key_hash',
    keyPrefix: 'key_prefix',
    scopes: 'scopes',
    expiresAt: 'expires_at',
    revokedAt: 'revoked_at',
    lastUsedAt: 'last_used_at',
    createdAt: 'created_at',
  },
  eq: vi.fn((_col: unknown, val: unknown) => val),
  and: vi.fn((...args: unknown[]) => args),
  sql: vi.fn(),
  DrizzleDb: {},
}));

import { apiKeyService } from './api-key.service.js';

describe('apiKeyService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('verifyKey', () => {
    it('returns key data when key exists', async () => {
      const plainTextKey = 'col_live_abcdef1234567890abcdef1234567890';
      const expectedHash = crypto
        .createHash('sha256')
        .update(plainTextKey)
        .digest('hex');

      mockPoolQuery.mockResolvedValueOnce({
        rows: [
          {
            id: 'key-1',
            organization_id: 'org-1',
            created_by: 'user-1',
            name: 'Test Key',
            scopes: ['submissions:read'],
            expires_at: null,
            revoked_at: null,
            last_used_at: null,
            created_at: new Date(),
            creator_email: 'test@example.com',
            creator_email_verified: true,
            creator_deleted_at: null,
          },
        ],
      });

      const result = await apiKeyService.verifyKey(plainTextKey);

      expect(mockPoolQuery).toHaveBeenCalledWith(
        'SELECT * FROM verify_api_key($1)',
        [expectedHash],
      );
      expect(result).not.toBeNull();
      expect(result!.apiKey.id).toBe('key-1');
      expect(result!.apiKey.organizationId).toBe('org-1');
      expect(result!.creator.email).toBe('test@example.com');
    });

    it('returns null for unknown key', async () => {
      mockPoolQuery.mockResolvedValueOnce({ rows: [] });

      const result = await apiKeyService.verifyKey('col_live_unknown');
      expect(result).toBeNull();
    });
  });

  describe('touchLastUsed', () => {
    it('calls the SECURITY DEFINER function', async () => {
      mockPoolQuery.mockResolvedValueOnce({ rows: [] });

      await apiKeyService.touchLastUsed('key-1');

      expect(mockPoolQuery).toHaveBeenCalledWith(
        'SELECT touch_api_key_last_used($1, $2)',
        ['key-1', expect.any(Date)],
      );
    });

    it('swallows errors silently', async () => {
      mockPoolQuery.mockRejectedValueOnce(new Error('DB down'));

      // Should not throw
      await apiKeyService.touchLastUsed('key-1');
    });
  });

  describe('create', () => {
    it('generates key with col_live_ prefix and stores hash', async () => {
      const mockTx = {
        insert: vi.fn().mockReturnThis(),
        values: vi.fn().mockReturnThis(),
        returning: vi.fn().mockResolvedValue([
          {
            id: 'key-1',
            name: 'My Key',
            scopes: ['submissions:read'],
            keyPrefix: 'col_live_',
            createdAt: new Date(),
            expiresAt: null,
            lastUsedAt: null,
            revokedAt: null,
          },
        ]),
      } as unknown as Parameters<typeof apiKeyService.create>[0];

      const result = await apiKeyService.create(mockTx, 'org-1', 'user-1', {
        name: 'My Key',
        scopes: ['submissions:read'],
      });

      expect(result.plainTextKey).toMatch(/^col_live_[0-9a-f]{32}$/);
      expect(result.id).toBe('key-1');
    });
  });

  describe('revoke', () => {
    it('sets revokedAt on the key', async () => {
      const mockTx = {
        update: vi.fn().mockReturnThis(),
        set: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        returning: vi
          .fn()
          .mockResolvedValue([
            { id: 'key-1', name: 'My Key', revokedAt: new Date() },
          ]),
      } as unknown as Parameters<typeof apiKeyService.revoke>[0];

      const result = await apiKeyService.revoke(mockTx, 'key-1');
      expect(result).not.toBeNull();
      expect(result?.revokedAt).toBeInstanceOf(Date);
    });

    it('returns null when key not found', async () => {
      const mockTx = {
        update: vi.fn().mockReturnThis(),
        set: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        returning: vi.fn().mockResolvedValue([]),
      } as unknown as Parameters<typeof apiKeyService.revoke>[0];

      const result = await apiKeyService.revoke(mockTx, 'nonexistent');
      expect(result).toBeNull();
    });
  });

  describe('list', () => {
    it('returns paginated results without keyHash', async () => {
      const items = [
        {
          id: 'key-1',
          name: 'Key 1',
          scopes: ['submissions:read'],
          keyPrefix: 'col_live_',
          createdAt: new Date(),
          expiresAt: null,
          lastUsedAt: null,
          revokedAt: null,
        },
      ];

      const mockTx = {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue({
                offset: vi.fn().mockResolvedValue(items),
              }),
            }),
          }),
        }),
      } as unknown as Parameters<typeof apiKeyService.list>[0];

      // Mock the count query — list() calls tx.select() twice via Promise.all
      // We need to override select to return different chains for the two calls
      let callCount = 0;
      (mockTx as unknown as { select: ReturnType<typeof vi.fn> }).select = vi
        .fn()
        .mockImplementation(() => {
          callCount++;
          if (callCount === 1) {
            // Items query
            return {
              from: vi.fn().mockReturnValue({
                orderBy: vi.fn().mockReturnValue({
                  limit: vi.fn().mockReturnValue({
                    offset: vi.fn().mockResolvedValue(items),
                  }),
                }),
              }),
            };
          }
          // Count query
          return {
            from: vi.fn().mockResolvedValue([{ count: 1 }]),
          };
        });

      const result = await apiKeyService.list(mockTx, { page: 1, limit: 20 });

      expect(result.items).toEqual(items);
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
      expect(result.totalPages).toBe(1);
      // Ensure no keyHash in returned items
      for (const item of result.items) {
        expect(item).not.toHaveProperty('keyHash');
      }
    });
  });
});
