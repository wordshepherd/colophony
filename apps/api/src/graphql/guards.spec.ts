import { describe, it, expect, vi } from 'vitest';
import { GraphQLError } from 'graphql';
import {
  requireAuth,
  requireOrgContext,
  requireAdmin,
  requireScopes,
} from './guards.js';
import type { GraphQLContext } from './context.js';
import type { AuthContext } from '@colophony/types';
import type { DrizzleDb } from '@colophony/db';

vi.mock('../services/scope-check.js', () => ({
  checkApiKeyScopes: vi.fn(),
}));

import { checkApiKeyScopes } from '../services/scope-check.js';
const mockCheckScopes = vi.mocked(checkApiKeyScopes);

function makeCtx(overrides: Partial<GraphQLContext> = {}): GraphQLContext {
  return {
    authContext: null,
    dbTx: null,
    audit: vi.fn().mockResolvedValue(undefined),
    loaders: {} as GraphQLContext['loaders'],
    ...overrides,
  };
}

function makeAuthContext(overrides: Partial<AuthContext> = {}): AuthContext {
  return {
    userId: 'user-1',
    email: 'test@example.com',
    emailVerified: true,
    authMethod: 'oidc',
    ...overrides,
  };
}

describe('requireAuth', () => {
  it('returns narrowed context when authenticated', () => {
    const auth = makeAuthContext();
    const ctx = makeCtx({ authContext: auth });
    const result = requireAuth(ctx);
    expect(result.authContext).toBe(auth);
  });

  it('throws UNAUTHENTICATED when no authContext', () => {
    const ctx = makeCtx();
    expect(() => requireAuth(ctx)).toThrow(GraphQLError);
    try {
      requireAuth(ctx);
    } catch (e) {
      expect((e as GraphQLError).extensions?.code).toBe('UNAUTHENTICATED');
    }
  });
});

describe('requireOrgContext', () => {
  it('returns narrowed context with org and dbTx', () => {
    const auth = makeAuthContext({ orgId: 'org-1', role: 'ADMIN' as const });
    const dbTx = {} as DrizzleDb;
    const ctx = makeCtx({ authContext: auth, dbTx });
    const result = requireOrgContext(ctx);
    expect(result.authContext.orgId).toBe('org-1');
    expect(result.dbTx).toBe(dbTx);
  });

  it('throws UNAUTHENTICATED when no authContext', () => {
    const ctx = makeCtx();
    try {
      requireOrgContext(ctx);
    } catch (e) {
      expect((e as GraphQLError).extensions?.code).toBe('UNAUTHENTICATED');
      return;
    }
    expect.fail('should have thrown');
  });

  it('throws BAD_REQUEST when no orgId', () => {
    const auth = makeAuthContext();
    const ctx = makeCtx({ authContext: auth });
    try {
      requireOrgContext(ctx);
    } catch (e) {
      expect((e as GraphQLError).extensions?.code).toBe('BAD_REQUEST');
      return;
    }
    expect.fail('should have thrown');
  });

  it('throws INTERNAL_SERVER_ERROR when no dbTx', () => {
    const auth = makeAuthContext({ orgId: 'org-1', role: 'ADMIN' as const });
    const ctx = makeCtx({ authContext: auth, dbTx: null });
    try {
      requireOrgContext(ctx);
    } catch (e) {
      expect((e as GraphQLError).extensions?.code).toBe(
        'INTERNAL_SERVER_ERROR',
      );
      return;
    }
    expect.fail('should have thrown');
  });
});

describe('requireAdmin', () => {
  it('returns narrowed context for ADMIN role', () => {
    const auth = makeAuthContext({ orgId: 'org-1', role: 'ADMIN' as const });
    const dbTx = {} as DrizzleDb;
    const ctx = makeCtx({ authContext: auth, dbTx });
    const result = requireAdmin(ctx);
    expect(result.authContext.role).toBe('ADMIN');
  });

  it('throws FORBIDDEN for non-ADMIN role', () => {
    const auth = makeAuthContext({ orgId: 'org-1', role: 'READER' as const });
    const dbTx = {} as DrizzleDb;
    const ctx = makeCtx({ authContext: auth, dbTx });
    try {
      requireAdmin(ctx);
    } catch (e) {
      expect((e as GraphQLError).extensions?.code).toBe('FORBIDDEN');
      return;
    }
    expect.fail('should have thrown');
  });
});

describe('requireScopes', () => {
  it('passes when OIDC auth (scopes bypass)', async () => {
    const auth = makeAuthContext({ authMethod: 'oidc' });
    const ctx = makeCtx({ authContext: auth });
    mockCheckScopes.mockReturnValue({ allowed: true });
    await expect(
      requireScopes(ctx, 'submissions:read'),
    ).resolves.toBeUndefined();
  });

  it('passes when API key has required scopes', async () => {
    const auth = makeAuthContext({
      authMethod: 'apikey',
      apiKeyScopes: ['submissions:read'],
    });
    const ctx = makeCtx({ authContext: auth });
    mockCheckScopes.mockReturnValue({ allowed: true });
    await expect(
      requireScopes(ctx, 'submissions:read'),
    ).resolves.toBeUndefined();
  });

  it('throws FORBIDDEN when API key lacks scopes', async () => {
    const auth = makeAuthContext({
      authMethod: 'apikey',
      apiKeyId: 'key-1',
      apiKeyScopes: [],
    });
    const ctx = makeCtx({ authContext: auth });
    mockCheckScopes.mockReturnValue({
      allowed: false,
      missing: ['submissions:read'],
    });
    try {
      await requireScopes(ctx, 'submissions:read');
    } catch (e) {
      expect((e as GraphQLError).extensions?.code).toBe('FORBIDDEN');
      expect((e as GraphQLError).extensions?.error).toBe('insufficient_scope');
      return;
    }
    expect.fail('should have thrown');
  });

  it('awaits audit before throwing on scope denial', async () => {
    const auth = makeAuthContext({
      authMethod: 'apikey',
      apiKeyId: 'key-1',
      apiKeyScopes: [],
    });
    const audit = vi.fn().mockResolvedValue(undefined);
    const ctx = makeCtx({ authContext: auth, audit });
    mockCheckScopes.mockReturnValue({
      allowed: false,
      missing: ['submissions:read'],
    });
    try {
      await requireScopes(ctx, 'submissions:read');
    } catch {
      // expected
    }
    expect(audit).toHaveBeenCalled();
  });

  it('throws UNAUTHENTICATED when no authContext', async () => {
    const ctx = makeCtx();
    try {
      await requireScopes(ctx, 'submissions:read');
    } catch (e) {
      expect((e as GraphQLError).extensions?.code).toBe('UNAUTHENTICATED');
      return;
    }
    expect.fail('should have thrown');
  });
});
