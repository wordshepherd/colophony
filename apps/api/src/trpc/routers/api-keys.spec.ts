import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { TRPCContext } from '../context.js';

// vi.hoisted runs before vi.mock hoisting — safe to reference in factories
const { mockApiKeyService } = vi.hoisted(() => {
  const mockApiKeyService = {
    list: vi.fn(),
    create: vi.fn(),
    revoke: vi.fn(),
    delete: vi.fn(),
  };
  return { mockApiKeyService };
});

vi.mock('../../services/api-key.service.js', () => ({
  apiKeyService: mockApiKeyService,
}));

// Import after mocks
import { appRouter } from '../router.js';

function makeContext(overrides: Partial<TRPCContext> = {}): TRPCContext {
  return {
    authContext: null,
    dbTx: null,
    audit: vi.fn(),
    ...overrides,
  };
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

const createCaller = (appRouter as any).createCaller as (
  ctx: TRPCContext,
) => any;

describe('apiKeys router', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('list', () => {
    it('returns paginated keys for org members', async () => {
      const keys = {
        items: [
          {
            id: 'a1111111-1111-1111-a111-111111111111',
            name: 'Test Key',
            scopes: ['submissions:read'],
            keyPrefix: 'col_live_',
            createdAt: new Date(),
            expiresAt: null,
            lastUsedAt: null,
            revokedAt: null,
          },
        ],
        total: 1,
        page: 1,
        limit: 20,
        totalPages: 1,
      };
      mockApiKeyService.list.mockResolvedValueOnce(keys);

      const caller = createCaller(orgContext('READER'));
      const result = await caller.apiKeys.list({ page: 1, limit: 20 });

      expect(result).toEqual(keys);
      expect(mockApiKeyService.list).toHaveBeenCalledOnce();
    });

    it('requires org context', async () => {
      const caller = createCaller(
        makeContext({
          authContext: {
            userId: 'user-1',
            zitadelUserId: 'zid-1',
            email: 'test@example.com',
            emailVerified: true,
            authMethod: 'test',
          },
        }),
      );
      await expect(
        caller.apiKeys.list({ page: 1, limit: 20 }),
      ).rejects.toThrow();
    });
  });

  describe('create', () => {
    it('returns plain text key on creation', async () => {
      const created = {
        id: 'a1111111-1111-1111-a111-111111111111',
        name: 'My Key',
        scopes: ['submissions:read'],
        keyPrefix: 'col_live_',
        plainTextKey: 'col_live_abcdef1234567890abcdef1234567890',
        createdAt: new Date(),
        expiresAt: null,
        lastUsedAt: null,
        revokedAt: null,
      };
      mockApiKeyService.create.mockResolvedValueOnce(created);

      const ctx = orgContext('ADMIN');
      const caller = createCaller(ctx);
      const result = await caller.apiKeys.create({
        name: 'My Key',
        scopes: ['submissions:read'],
      });

      expect(result.plainTextKey).toBe(created.plainTextKey);
      expect(mockApiKeyService.create).toHaveBeenCalledWith(
        expect.anything(),
        'org-1',
        'user-1',
        { name: 'My Key', scopes: ['submissions:read'] },
      );
      expect(ctx.audit).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'API_KEY_CREATED',
          resource: 'api_key',
          resourceId: 'a1111111-1111-1111-a111-111111111111',
        }),
      );
    });

    it('rejects non-admin users', async () => {
      const caller = createCaller(orgContext('READER'));
      await expect(
        caller.apiKeys.create({
          name: 'My Key',
          scopes: ['submissions:read'],
        }),
      ).rejects.toThrow('Admin role required');
    });

    it('rejects EDITOR users', async () => {
      const caller = createCaller(orgContext('EDITOR'));
      await expect(
        caller.apiKeys.create({
          name: 'My Key',
          scopes: ['submissions:read'],
        }),
      ).rejects.toThrow('Admin role required');
    });
  });

  describe('revoke', () => {
    it('revokes a key and audits', async () => {
      mockApiKeyService.revoke.mockResolvedValueOnce({
        id: 'a1111111-1111-1111-a111-111111111111',
        name: 'My Key',
        revokedAt: new Date(),
      });

      const ctx = orgContext('ADMIN');
      const caller = createCaller(ctx);
      const result = await caller.apiKeys.revoke({
        keyId: 'a1111111-1111-1111-a111-111111111111',
      });

      expect(result.revokedAt).toBeInstanceOf(Date);
      expect(ctx.audit).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'API_KEY_REVOKED',
          resource: 'api_key',
          resourceId: 'a1111111-1111-1111-a111-111111111111',
        }),
      );
    });

    it('throws NOT_FOUND when key does not exist', async () => {
      mockApiKeyService.revoke.mockResolvedValueOnce(null);

      const caller = createCaller(orgContext('ADMIN'));
      await expect(
        caller.apiKeys.revoke({
          keyId: 'b2222222-2222-2222-a222-222222222222',
        }),
      ).rejects.toThrow('API key not found');
    });

    it('rejects non-admin users', async () => {
      const caller = createCaller(orgContext('READER'));
      await expect(
        caller.apiKeys.revoke({
          keyId: 'a1111111-1111-1111-a111-111111111111',
        }),
      ).rejects.toThrow('Admin role required');
    });
  });

  describe('delete', () => {
    it('deletes a key and audits', async () => {
      mockApiKeyService.delete.mockResolvedValueOnce({
        id: 'a1111111-1111-1111-a111-111111111111',
      });

      const ctx = orgContext('ADMIN');
      const caller = createCaller(ctx);
      const result = await caller.apiKeys.delete({
        keyId: 'a1111111-1111-1111-a111-111111111111',
      });

      expect(result).toEqual({ success: true });
      expect(ctx.audit).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'API_KEY_DELETED',
          resource: 'api_key',
          resourceId: 'a1111111-1111-1111-a111-111111111111',
        }),
      );
    });

    it('throws NOT_FOUND when key does not exist', async () => {
      mockApiKeyService.delete.mockResolvedValueOnce(null);

      const caller = createCaller(orgContext('ADMIN'));
      await expect(
        caller.apiKeys.delete({
          keyId: 'b2222222-2222-2222-a222-222222222222',
        }),
      ).rejects.toThrow('API key not found');
    });

    it('rejects non-admin users', async () => {
      const caller = createCaller(orgContext('EDITOR'));
      await expect(
        caller.apiKeys.delete({
          keyId: 'a1111111-1111-1111-a111-111111111111',
        }),
      ).rejects.toThrow('Admin role required');
    });
  });
});
