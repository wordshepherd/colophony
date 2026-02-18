import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ORPCError } from '@orpc/server';

vi.mock('../../services/audit.service.js', () => ({
  auditService: {
    log: vi.fn(),
    logDirect: vi.fn(),
    list: vi.fn(),
    getById: vi.fn(),
  },
}));

vi.mock('@colophony/db', () => ({
  pool: { query: vi.fn(), connect: vi.fn() },
  db: { query: {} },
  auditEvents: {},
  eq: vi.fn(),
  and: vi.fn(),
  gte: vi.fn(),
  lte: vi.fn(),
  sql: vi.fn(),
}));

import { auditService } from '../../services/audit.service.js';
import { auditRouter } from './audit.js';
import type { RestContext } from '../context.js';
import { createProcedureClient } from '@orpc/server';

const mockService = vi.mocked(auditService);

const USER_ID = 'a0000000-0000-4000-a000-000000000001';
const ORG_ID = 'b0000000-0000-4000-a000-000000000001';
const EVENT_ID = 'e0000000-0000-4000-a000-000000000001';

function baseContext(): RestContext {
  return { authContext: null, dbTx: null, audit: vi.fn() };
}

function adminContext(): RestContext {
  return {
    authContext: {
      userId: USER_ID,
      zitadelUserId: 'zid-1',
      email: 'admin@example.com',
      emailVerified: true,
      authMethod: 'test',
      orgId: ORG_ID,
      role: 'ADMIN',
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
      email: 'admin@example.com',
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

function client<T>(procedure: T, context: RestContext) {
  return createProcedureClient(procedure as any, { context }) as any;
}

describe('audit REST router', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // -------------------------------------------------------------------------
  // GET /audit-events
  // -------------------------------------------------------------------------

  describe('GET /audit-events (list)', () => {
    it('requires auth', async () => {
      const call = client(auditRouter.list, baseContext());
      await expect(call({ page: 1, limit: 20 })).rejects.toThrow(ORPCError);
    });

    it('requires admin role', async () => {
      const ctx: RestContext = {
        authContext: {
          userId: USER_ID,
          zitadelUserId: 'zid-1',
          email: 'reader@example.com',
          emailVerified: true,
          authMethod: 'test',
          orgId: ORG_ID,
          role: 'READER',
        },
        dbTx: {} as never,
        audit: vi.fn(),
      };
      const call = client(auditRouter.list, ctx);
      await expect(call({ page: 1, limit: 20 })).rejects.toThrow(
        'Admin role required',
      );
    });

    it('returns paginated audit events', async () => {
      const response = {
        items: [{ id: EVENT_ID, action: 'USER_CREATED', resource: 'user' }],
        total: 1,
        page: 1,
        limit: 20,
        totalPages: 1,
      };
      mockService.list.mockResolvedValueOnce(response as never);

      const ctx = adminContext();
      const call = client(auditRouter.list, ctx);
      const result = await call({ page: 1, limit: 20 });
      expect(result.items).toHaveLength(1);
      expect(ctx.audit).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'AUDIT_ACCESSED',
          resource: 'audit',
        }),
      );
    });

    it('passes filters to service', async () => {
      mockService.list.mockResolvedValueOnce({
        items: [],
        total: 0,
        page: 1,
        limit: 10,
        totalPages: 0,
      } as never);

      const call = client(auditRouter.list, adminContext());
      await call({
        action: 'USER_CREATED',
        resource: 'user',
        page: 1,
        limit: 10,
      });

      expect(mockService.list).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          action: 'USER_CREATED',
          resource: 'user',
        }),
      );
    });
  });

  // -------------------------------------------------------------------------
  // GET /audit-events/{id}
  // -------------------------------------------------------------------------

  describe('GET /audit-events/{id} (getById)', () => {
    it('returns a single audit event', async () => {
      const event = {
        id: EVENT_ID,
        action: 'USER_CREATED',
        resource: 'user',
        resourceId: null,
        actorId: USER_ID,
        oldValue: null,
        newValue: null,
        ipAddress: null,
        userAgent: null,
        requestId: null,
        method: null,
        route: null,
        createdAt: new Date(),
      };
      mockService.getById.mockResolvedValueOnce(event as never);

      const ctx = adminContext();
      const call = client(auditRouter.getById, ctx);
      const result = await call({ id: EVENT_ID });

      expect(result.id).toBe(EVENT_ID);
      expect(ctx.audit).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'AUDIT_ACCESSED',
          resource: 'audit',
          resourceId: EVENT_ID,
        }),
      );
    });

    it('throws NOT_FOUND when event does not exist', async () => {
      mockService.getById.mockResolvedValueOnce(null as never);

      const call = client(auditRouter.getById, adminContext());
      await expect(call({ id: EVENT_ID })).rejects.toThrow(
        'Audit event not found',
      );
    });

    it('requires admin role', async () => {
      const ctx: RestContext = {
        authContext: {
          userId: USER_ID,
          zitadelUserId: 'zid-1',
          email: 'editor@example.com',
          emailVerified: true,
          authMethod: 'test',
          orgId: ORG_ID,
          role: 'EDITOR',
        },
        dbTx: {} as never,
        audit: vi.fn(),
      };
      const call = client(auditRouter.getById, ctx);
      await expect(call({ id: EVENT_ID })).rejects.toThrow(
        'Admin role required',
      );
    });
  });

  // -------------------------------------------------------------------------
  // API key scope enforcement
  // -------------------------------------------------------------------------

  describe('API key scope enforcement', () => {
    it('denies audit:read with wrong scope', async () => {
      const ctx = apiKeyContext(['submissions:read']);
      const call = client(auditRouter.list, ctx);
      await expect(call({ page: 1, limit: 20 })).rejects.toThrow(
        'Insufficient API key scope',
      );
    });

    it('allows API key with audit:read scope', async () => {
      const response = {
        items: [],
        total: 0,
        page: 1,
        limit: 20,
        totalPages: 0,
      };
      mockService.list.mockResolvedValueOnce(response as never);

      const ctx = apiKeyContext(['audit:read']);
      const call = client(auditRouter.list, ctx);
      const result = await call({ page: 1, limit: 20 });
      expect(result.items).toHaveLength(0);
    });
  });
});
