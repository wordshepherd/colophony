import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ORPCError, createProcedureClient } from '@orpc/server';
import { AuditActions, AuditResources } from '@colophony/types';
import type { RestContext } from './context.js';
import { requireScopes, restBase } from './context.js';

// Build a test procedure that chains requireScopes then returns success
function buildTestProcedure(...scopes: Parameters<typeof requireScopes>) {
  return restBase.use(requireScopes(...scopes)).handler(async () => {
    return { ok: true };
  });
}

function client<T>(procedure: T, context: RestContext) {
  return createProcedureClient(procedure as any, { context }) as any;
}

const USER_ID = 'a0000000-0000-4000-a000-000000000001';
const API_KEY_ID = 'k0000000-0000-4000-a000-000000000001';

function oidcContext(): RestContext {
  return {
    authContext: {
      userId: USER_ID,
      email: 'test@example.com',
      emailVerified: true,
      authMethod: 'oidc',
      zitadelUserId: 'zid-1',
    },
    dbTx: null,
    audit: vi.fn(),
  };
}

function testContext(): RestContext {
  return {
    authContext: {
      userId: USER_ID,
      email: 'test@example.com',
      emailVerified: true,
      authMethod: 'test',
    },
    dbTx: null,
    audit: vi.fn(),
  };
}

function apiKeyContext(scopes: string[]): RestContext {
  return {
    authContext: {
      userId: USER_ID,
      email: 'test@example.com',
      emailVerified: true,
      authMethod: 'apikey',
      apiKeyId: API_KEY_ID,
      apiKeyScopes: scopes as any,
    },
    dbTx: null,
    audit: vi.fn(),
  };
}

function unauthContext(): RestContext {
  return {
    authContext: null,
    dbTx: null,
    audit: vi.fn(),
  };
}

describe('requireScopes oRPC middleware', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('throws UNAUTHORIZED when authContext is null', async () => {
    const proc = buildTestProcedure('submissions:read');
    const call = client(proc, unauthContext());
    await expect(call({})).rejects.toThrow('Not authenticated');
  });

  it('bypasses scope check for OIDC auth', async () => {
    const proc = buildTestProcedure('submissions:read');
    const call = client(proc, oidcContext());
    const result = await call({});
    expect(result).toEqual({ ok: true });
  });

  it('bypasses scope check for test auth', async () => {
    const proc = buildTestProcedure('submissions:read');
    const call = client(proc, testContext());
    const result = await call({});
    expect(result).toEqual({ ok: true });
  });

  it('allows API key with matching scopes', async () => {
    const proc = buildTestProcedure('submissions:read');
    const call = client(proc, apiKeyContext(['submissions:read']));
    const result = await call({});
    expect(result).toEqual({ ok: true });
  });

  it('denies API key missing a scope with FORBIDDEN', async () => {
    const proc = buildTestProcedure('submissions:write');
    const ctx = apiKeyContext(['submissions:read']);
    const call = client(proc, ctx);

    await expect(call({})).rejects.toThrow(ORPCError);
    try {
      await call({});
    } catch (e: any) {
      expect(e.message).toBe('Insufficient API key scope');
      expect(e.data).toEqual({
        error: 'insufficient_scope',
        required: ['submissions:write'],
        missing: ['submissions:write'],
      });
    }
  });

  it('calls audit function on denial', async () => {
    const proc = buildTestProcedure('submissions:write');
    const ctx = apiKeyContext(['submissions:read']);
    const call = client(proc, ctx);

    await expect(call({})).rejects.toThrow(ORPCError);
    expect(ctx.audit).toHaveBeenCalledWith({
      action: AuditActions.API_KEY_SCOPE_DENIED,
      resource: AuditResources.API_KEY,
      resourceId: API_KEY_ID,
      newValue: {
        required: ['submissions:write'],
        missing: ['submissions:write'],
      },
    });
  });

  it('reports multiple missing scopes', async () => {
    const proc = buildTestProcedure('submissions:read', 'submissions:write');
    const ctx = apiKeyContext(['files:read']);
    const call = client(proc, ctx);

    try {
      await call({});
    } catch (e: any) {
      expect(e.data.missing).toEqual(['submissions:read', 'submissions:write']);
    }
  });
});
