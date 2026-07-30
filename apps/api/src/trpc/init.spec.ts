import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TRPCError } from '@trpc/server';
import { AuditActions } from '@colophony/types';

const { envState } = vi.hoisted(() => ({
  envState: { INTERNAL_ONLY_ENFORCE: false },
}));

vi.mock('../config/env.js', () => ({
  validateEnv: () => envState,
}));

import { t, internalOnly } from './init.js';
import type { TRPCContext } from './context.js';

const USER_ID = '00000000-0000-4000-a000-000000000001';
const API_KEY_ID = '00000000-0000-4000-a000-0000000000ff';

const probeRouter = t.router({
  probe: t.procedure.use(internalOnly).query(() => 'ok' as const),
});

function makeContext(
  authContext: TRPCContext['authContext'],
): TRPCContext & { audit: ReturnType<typeof vi.fn> } {
  return {
    authContext,
    dbTx: {} as TRPCContext['dbTx'],
    audit: vi.fn(),
  } as TRPCContext & { audit: ReturnType<typeof vi.fn> };
}

/**
 * A credential class that does not exist yet — stands in for the `col_svc_`
 * service principal. Cast because the union deliberately does not include it.
 */
function futureCredentialContext() {
  return makeContext({
    userId: USER_ID,
    email: 'svc@example.com',
    emailVerified: true,
    authMethod: 'svc' as unknown as 'apikey',
  });
}

function apiKeyContext() {
  return makeContext({
    userId: USER_ID,
    email: 'key@example.com',
    emailVerified: true,
    authMethod: 'apikey',
    apiKeyId: API_KEY_ID,
    apiKeyScopes: [],
  });
}

function interactiveContext(authMethod: 'oidc' | 'demo' | 'test') {
  return makeContext({
    userId: USER_ID,
    email: 'human@example.com',
    emailVerified: true,
    authMethod,
  });
}

const call = (ctx: TRPCContext) =>
  (probeRouter as any).createCaller(ctx).probe();

describe('internalOnly middleware', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    envState.INTERNAL_ONLY_ENFORCE = false;
  });

  describe('interactive auth methods are admitted', () => {
    it.each(['oidc', 'demo', 'test'] as const)(
      'allows %s without auditing, even when enforcing',
      async (method) => {
        envState.INTERNAL_ONLY_ENFORCE = true;
        const ctx = interactiveContext(method);

        await expect(call(ctx)).resolves.toBe('ok');
        expect(ctx.audit).not.toHaveBeenCalled();
      },
    );
  });

  describe('log-only mode (INTERNAL_ONLY_ENFORCE=false)', () => {
    it('lets an API key through but records the attempt', async () => {
      const ctx = apiKeyContext();

      await expect(call(ctx)).resolves.toBe('ok');

      expect(ctx.audit).toHaveBeenCalledTimes(1);
      expect(ctx.audit).toHaveBeenCalledWith(
        expect.objectContaining({
          action: AuditActions.API_KEY_INTERNAL_ROUTE,
          resourceId: API_KEY_ID,
          newValue: expect.objectContaining({
            procedure: 'probe',
            authMethod: 'apikey',
            enforced: false,
          }),
        }),
      );
    });

    it('still rejects an unauthenticated caller', async () => {
      const ctx = makeContext(null);

      await expect(call(ctx)).rejects.toMatchObject({
        code: 'UNAUTHORIZED',
      });
      expect(ctx.audit).not.toHaveBeenCalled();
    });
  });

  describe('enforcing mode (INTERNAL_ONLY_ENFORCE=true)', () => {
    beforeEach(() => {
      envState.INTERNAL_ONLY_ENFORCE = true;
    });

    it('rejects an API key and records the attempt as enforced', async () => {
      const ctx = apiKeyContext();

      await expect(call(ctx)).rejects.toMatchObject({ code: 'FORBIDDEN' });
      await expect(call(ctx)).rejects.toBeInstanceOf(TRPCError);

      expect(ctx.audit).toHaveBeenCalledWith(
        expect.objectContaining({
          action: AuditActions.API_KEY_INTERNAL_ROUTE,
          newValue: expect.objectContaining({ enforced: true }),
        }),
      );
    });
  });

  // The reason the middleware is an allowlist rather than `authMethod === 'apikey'`.
  // A denylist would let this through — and P2.3 of the integration design
  // introduces exactly such a credential.
  describe('unknown credential classes', () => {
    it('is rejected when enforcing, without being named anywhere', async () => {
      envState.INTERNAL_ONLY_ENFORCE = true;
      const ctx = futureCredentialContext();

      await expect(call(ctx)).rejects.toMatchObject({ code: 'FORBIDDEN' });
    });

    it('is audited in log-only mode', async () => {
      const ctx = futureCredentialContext();

      await expect(call(ctx)).resolves.toBe('ok');
      expect(ctx.audit).toHaveBeenCalledWith(
        expect.objectContaining({
          action: AuditActions.API_KEY_INTERNAL_ROUTE,
          newValue: expect.objectContaining({ authMethod: 'svc' }),
        }),
      );
    });
  });
});
