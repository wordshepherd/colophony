import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ORPCError } from '@orpc/server';

vi.mock('../../services/api-key.service.js', () => ({
  apiKeyService: {
    list: vi.fn(),
    create: vi.fn(),
    revoke: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock('@colophony/db', () => ({
  pool: { query: vi.fn(), connect: vi.fn() },
  db: { query: {} },
  apiKeys: {},
  eq: vi.fn(),
  and: vi.fn(),
  sql: vi.fn(),
}));

import { apiKeyService } from '../../services/api-key.service.js';
import { apiKeysRouter } from './api-keys.js';
import type { RestContext } from '../context.js';
import { createProcedureClient } from '@orpc/server';

const mockService = vi.mocked(apiKeyService);

const USER_ID = 'a0000000-0000-4000-a000-000000000001';
const ORG_ID = 'b0000000-0000-4000-a000-000000000001';
const KEY_ID = 'f0000000-0000-4000-a000-000000000001';

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

function client<T>(procedure: T, context: RestContext) {
  return createProcedureClient(procedure as any, { context }) as any;
}

describe('api-keys REST router', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // -------------------------------------------------------------------------
  // GET /api-keys
  // -------------------------------------------------------------------------

  describe('GET /api-keys (list)', () => {
    it('requires auth', async () => {
      const call = client(apiKeysRouter.list, baseContext());
      await expect(call({ page: 1, limit: 20 })).rejects.toThrow(ORPCError);
    });

    it('requires org context', async () => {
      const call = client(apiKeysRouter.list, authedContext());
      await expect(call({ page: 1, limit: 20 })).rejects.toThrow(ORPCError);
    });

    it('returns paginated API keys for any org member', async () => {
      const response = {
        items: [{ id: KEY_ID, name: 'Test Key' }],
        total: 1,
        page: 1,
        limit: 20,
        totalPages: 1,
      };
      mockService.list.mockResolvedValueOnce(response as never);

      const call = client(apiKeysRouter.list, orgContext('READER'));
      const result = await call({ page: 1, limit: 20 });
      expect(result.items).toHaveLength(1);
    });
  });

  // -------------------------------------------------------------------------
  // POST /api-keys
  // -------------------------------------------------------------------------

  describe('POST /api-keys (create)', () => {
    it('requires admin role', async () => {
      const call = client(apiKeysRouter.create, orgContext('EDITOR'));
      await expect(
        call({ name: 'Test', scopes: ['submissions:read'] }),
      ).rejects.toThrow('Admin role required');
    });

    it('creates an API key and audits', async () => {
      const result = {
        id: KEY_ID,
        name: 'Test Key',
        scopes: ['submissions:read'],
        plainTextKey: 'col_live_abc123',
        keyPrefix: 'col_live_',
        createdAt: new Date(),
        expiresAt: null,
        lastUsedAt: null,
        revokedAt: null,
      };
      mockService.create.mockResolvedValueOnce(result as never);

      const ctx = orgContext('ADMIN');
      const call = client(apiKeysRouter.create, ctx);
      const response = await call({
        name: 'Test Key',
        scopes: ['submissions:read'],
      });

      expect(response.id).toBe(KEY_ID);
      expect(response.plainTextKey).toBe('col_live_abc123');
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(mockService.create).toHaveBeenCalledWith(
        expect.anything(),
        ORG_ID,
        USER_ID,
        expect.objectContaining({
          name: 'Test Key',
          scopes: ['submissions:read'],
        }),
      );
      expect(ctx.audit).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'API_KEY_CREATED',
          resourceId: KEY_ID,
        }),
      );
    });
  });

  // -------------------------------------------------------------------------
  // POST /api-keys/{keyId}/revoke
  // -------------------------------------------------------------------------

  describe('POST /api-keys/{keyId}/revoke', () => {
    it('requires admin role', async () => {
      const call = client(apiKeysRouter.revoke, orgContext('READER'));
      await expect(call({ keyId: KEY_ID })).rejects.toThrow(
        'Admin role required',
      );
    });

    it('revokes an API key and audits', async () => {
      const revoked = {
        id: KEY_ID,
        name: 'Test Key',
        revokedAt: new Date(),
      };
      mockService.revoke.mockResolvedValueOnce(revoked as never);

      const ctx = orgContext('ADMIN');
      const call = client(apiKeysRouter.revoke, ctx);
      const result = await call({ keyId: KEY_ID });

      expect(result.id).toBe(KEY_ID);
      expect(ctx.audit).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'API_KEY_REVOKED',
          resourceId: KEY_ID,
        }),
      );
    });

    it('throws NOT_FOUND when key does not exist', async () => {
      mockService.revoke.mockResolvedValueOnce(null as never);

      const call = client(apiKeysRouter.revoke, orgContext('ADMIN'));
      await expect(call({ keyId: KEY_ID })).rejects.toThrow(
        'API key not found',
      );
    });
  });

  // -------------------------------------------------------------------------
  // DELETE /api-keys/{keyId}
  // -------------------------------------------------------------------------

  describe('DELETE /api-keys/{keyId}', () => {
    it('requires admin role', async () => {
      const call = client(apiKeysRouter.delete, orgContext('EDITOR'));
      await expect(call({ keyId: KEY_ID })).rejects.toThrow(
        'Admin role required',
      );
    });

    it('deletes an API key and audits', async () => {
      const deleted = { id: KEY_ID, name: 'Test Key' };
      mockService.delete.mockResolvedValueOnce(deleted as never);

      const ctx = orgContext('ADMIN');
      const call = client(apiKeysRouter.delete, ctx);
      const result = await call({ keyId: KEY_ID });

      expect(result).toEqual({ success: true });
      expect(ctx.audit).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'API_KEY_DELETED',
          resourceId: KEY_ID,
        }),
      );
    });

    it('throws NOT_FOUND when key does not exist', async () => {
      mockService.delete.mockResolvedValueOnce(null as never);

      const call = client(apiKeysRouter.delete, orgContext('ADMIN'));
      await expect(call({ keyId: KEY_ID })).rejects.toThrow(
        'API key not found',
      );
    });
  });
});
