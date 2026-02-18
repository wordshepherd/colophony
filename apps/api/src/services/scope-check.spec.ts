import { describe, it, expect } from 'vitest';
import type { AuthContext } from '@colophony/types';
import { checkApiKeyScopes } from './scope-check.js';

function oidcAuth(): AuthContext {
  return {
    userId: 'u-1',
    email: 'test@example.com',
    emailVerified: true,
    authMethod: 'oidc',
    zitadelUserId: 'zid-1',
  };
}

function testAuth(): AuthContext {
  return {
    userId: 'u-1',
    email: 'test@example.com',
    emailVerified: true,
    authMethod: 'test',
  };
}

function apiKeyAuth(scopes: string[]): AuthContext {
  return {
    userId: 'u-1',
    email: 'test@example.com',
    emailVerified: true,
    authMethod: 'apikey',
    apiKeyId: 'key-1',
    apiKeyScopes: scopes as AuthContext['apiKeyScopes'],
  };
}

describe('checkApiKeyScopes', () => {
  it('allows OIDC auth regardless of scopes', () => {
    const result = checkApiKeyScopes(oidcAuth(), ['submissions:read']);
    expect(result).toEqual({ allowed: true });
  });

  it('allows test auth regardless of scopes', () => {
    const result = checkApiKeyScopes(testAuth(), [
      'submissions:read',
      'submissions:write',
    ]);
    expect(result).toEqual({ allowed: true });
  });

  it('allows API key with matching scopes', () => {
    const result = checkApiKeyScopes(apiKeyAuth(['submissions:read']), [
      'submissions:read',
    ]);
    expect(result).toEqual({ allowed: true });
  });

  it('allows API key with superset of required scopes', () => {
    const result = checkApiKeyScopes(
      apiKeyAuth(['submissions:read', 'submissions:write', 'files:read']),
      ['submissions:read'],
    );
    expect(result).toEqual({ allowed: true });
  });

  it('denies API key missing a scope', () => {
    const result = checkApiKeyScopes(apiKeyAuth(['files:read']), [
      'submissions:read',
    ]);
    expect(result).toEqual({
      allowed: false,
      missing: ['submissions:read'],
    });
  });

  it('denies API key with partial scopes (has read, needs write)', () => {
    const result = checkApiKeyScopes(apiKeyAuth(['submissions:read']), [
      'submissions:write',
    ]);
    expect(result).toEqual({
      allowed: false,
      missing: ['submissions:write'],
    });
  });

  it('reports all missing scopes when multiple required', () => {
    const result = checkApiKeyScopes(apiKeyAuth(['files:read']), [
      'submissions:read',
      'submissions:write',
    ]);
    expect(result).toEqual({
      allowed: false,
      missing: ['submissions:read', 'submissions:write'],
    });
  });

  it('denies API key with no scopes', () => {
    const result = checkApiKeyScopes(apiKeyAuth([]), ['submissions:read']);
    expect(result).toEqual({
      allowed: false,
      missing: ['submissions:read'],
    });
  });

  it('denies API key with undefined apiKeyScopes', () => {
    const auth: AuthContext = {
      userId: 'u-1',
      email: 'test@example.com',
      emailVerified: true,
      authMethod: 'apikey',
      apiKeyId: 'key-1',
    };
    const result = checkApiKeyScopes(auth, ['submissions:read']);
    expect(result).toEqual({
      allowed: false,
      missing: ['submissions:read'],
    });
  });
});
