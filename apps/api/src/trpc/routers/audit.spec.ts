import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { TRPCContext } from '../context.js';

const { mockAuditService } = vi.hoisted(() => {
  const mockAuditService = {
    log: vi.fn(),
    logDirect: vi.fn(),
    list: vi.fn(),
    getById: vi.fn(),
  };
  return { mockAuditService };
});

vi.mock('../../services/audit.service.js', () => ({
  auditService: mockAuditService,
}));

import { appRouter } from '../router.js';

function makeContext(overrides: Partial<TRPCContext> = {}): TRPCContext {
  return {
    authContext: null,
    dbTx: null,
    audit: vi.fn(),
    ...overrides,
  };
}

function adminContext(overrides: Partial<TRPCContext> = {}): TRPCContext {
  const mockTx = {} as never;
  return makeContext({
    authContext: {
      userId: 'user-1',
      zitadelUserId: 'zid-1',
      email: 'admin@example.com',
      emailVerified: true,
      authMethod: 'test',
      orgId: 'org-1',
      role: 'ADMIN',
    },
    dbTx: mockTx,
    audit: vi.fn(),
    ...overrides,
  });
}

function apiKeyContext(
  scopes: string[],
  role: 'ADMIN' | 'EDITOR' | 'READER' = 'ADMIN',
): TRPCContext {
  return makeContext({
    authContext: {
      userId: 'user-1',
      email: 'admin@example.com',
      emailVerified: true,
      authMethod: 'apikey',
      apiKeyId: 'k0000000-0000-4000-a000-000000000001',
      apiKeyScopes: scopes as any,
      orgId: 'org-1',
      role,
    },
    dbTx: {} as never,
    audit: vi.fn(),
  });
}

const EVENT_ID = 'e0000000-0000-4000-a000-000000000001';

const createCaller = (appRouter as any).createCaller as (
  ctx: TRPCContext,
) => any;

describe('audit router', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('list', () => {
    it('returns paginated audit events', async () => {
      const response = {
        items: [
          {
            id: EVENT_ID,
            action: 'USER_CREATED',
            resource: 'user',
            resourceId: null,
            actorId: 'user-1',
            oldValue: null,
            newValue: { email: 'test@example.com' },
            ipAddress: '127.0.0.1',
            userAgent: null,
            requestId: null,
            method: 'POST',
            route: '/users',
            createdAt: new Date(),
          },
        ],
        total: 1,
        page: 1,
        limit: 20,
        totalPages: 1,
      };
      mockAuditService.list.mockResolvedValueOnce(response);

      const ctx = adminContext();
      const caller = createCaller(ctx);
      const result = await caller.audit.list({ page: 1, limit: 20 });

      expect(result).toEqual(response);
      expect(mockAuditService.list).toHaveBeenCalledOnce();
      expect(ctx.audit).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'AUDIT_ACCESSED',
          resource: 'audit',
        }),
      );
    });

    it('passes filters to service', async () => {
      mockAuditService.list.mockResolvedValueOnce({
        items: [],
        total: 0,
        page: 1,
        limit: 20,
        totalPages: 0,
      });

      const caller = createCaller(adminContext());
      await caller.audit.list({
        action: 'USER_CREATED',
        resource: 'user',
        page: 1,
        limit: 10,
      });

      expect(mockAuditService.list).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          action: 'USER_CREATED',
          resource: 'user',
          page: 1,
          limit: 10,
        }),
      );
    });

    it('rejects non-admin users', async () => {
      const ctx = makeContext({
        authContext: {
          userId: 'user-1',
          zitadelUserId: 'zid-1',
          email: 'reader@example.com',
          emailVerified: true,
          authMethod: 'test',
          orgId: 'org-1',
          role: 'READER',
        },
        dbTx: {} as never,
        audit: vi.fn(),
      });
      const caller = createCaller(ctx);
      await expect(caller.audit.list({ page: 1, limit: 20 })).rejects.toThrow(
        'Admin role required',
      );
    });
  });

  describe('getById', () => {
    it('returns a single audit event', async () => {
      const event = {
        id: EVENT_ID,
        action: 'USER_CREATED',
        resource: 'user',
        resourceId: null,
        actorId: 'user-1',
        oldValue: null,
        newValue: null,
        ipAddress: null,
        userAgent: null,
        requestId: null,
        method: null,
        route: null,
        createdAt: new Date(),
      };
      mockAuditService.getById.mockResolvedValueOnce(event);

      const ctx = adminContext();
      const caller = createCaller(ctx);
      const result = await caller.audit.getById({ id: EVENT_ID });

      expect(result).toEqual(event);
      expect(ctx.audit).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'AUDIT_ACCESSED',
          resource: 'audit',
          resourceId: EVENT_ID,
        }),
      );
    });

    it('throws NOT_FOUND for missing event', async () => {
      mockAuditService.getById.mockResolvedValueOnce(null);

      const caller = createCaller(adminContext());
      await expect(caller.audit.getById({ id: EVENT_ID })).rejects.toThrow(
        'Audit event not found',
      );
    });

    it('rejects non-admin users', async () => {
      const ctx = makeContext({
        authContext: {
          userId: 'user-1',
          zitadelUserId: 'zid-1',
          email: 'editor@example.com',
          emailVerified: true,
          authMethod: 'test',
          orgId: 'org-1',
          role: 'EDITOR',
        },
        dbTx: {} as never,
        audit: vi.fn(),
      });
      const caller = createCaller(ctx);
      await expect(caller.audit.getById({ id: EVENT_ID })).rejects.toThrow(
        'Admin role required',
      );
    });
  });

  describe('API key scope enforcement', () => {
    it('denies access without audit:read scope', async () => {
      const ctx = apiKeyContext(['submissions:read']);
      const caller = createCaller(ctx);
      await expect(caller.audit.list({ page: 1, limit: 20 })).rejects.toThrow(
        /Insufficient API key scope/,
      );
    });

    it('allows access with audit:read scope', async () => {
      mockAuditService.list.mockResolvedValueOnce({
        items: [],
        total: 0,
        page: 1,
        limit: 20,
        totalPages: 0,
      });

      const ctx = apiKeyContext(['audit:read']);
      const caller = createCaller(ctx);
      const result = await caller.audit.list({ page: 1, limit: 20 });
      expect(result.items).toHaveLength(0);
    });
  });
});
