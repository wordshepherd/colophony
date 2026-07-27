import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { TRPCContext } from '../context.js';

const { mockEmbedTokenService } = vi.hoisted(() => {
  const mockEmbedTokenService = {
    create: vi.fn(),
    list: vi.fn(),
    revoke: vi.fn(),
  };
  return { mockEmbedTokenService };
});

vi.mock('../../services/embed-token.service.js', () => ({
  embedTokenService: mockEmbedTokenService,
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

function orgContext(
  roles: ('ADMIN' | 'EDITOR' | 'READER')[] = ['ADMIN'],
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
      roles,
    },
    dbTx: mockTx,
    audit: vi.fn(),
    ...overrides,
  });
}

const createCaller = (appRouter as any).createCaller as (
  ctx: TRPCContext,
) => any;

describe('embedTokens router', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('create', () => {
    it('generates token and returns plain text key (admin only)', async () => {
      const created = {
        id: 'a1111111-1111-1111-a111-111111111111',
        submissionPeriodId: 'b2222222-2222-2222-a222-222222222222',
        tokenPrefix: 'col_emb_',
        plainTextToken: 'col_emb_abcdef1234567890abcdef1234567890',
        allowedOrigins: ['https://example.com'],
        themeConfig: null,
        active: true,
        createdAt: new Date(),
        expiresAt: null,
      };
      mockEmbedTokenService.create.mockResolvedValueOnce(created);

      const ctx = orgContext(['ADMIN']);
      const caller = createCaller(ctx);
      const result = await caller.embedTokens.create({
        submissionPeriodId: 'b2222222-2222-2222-a222-222222222222',
        allowedOrigins: ['https://example.com'],
      });

      expect(result.plainTextToken).toBe(created.plainTextToken);
      expect(mockEmbedTokenService.create).toHaveBeenCalledWith(
        expect.anything(),
        'org-1',
        'user-1',
        {
          submissionPeriodId: 'b2222222-2222-2222-a222-222222222222',
          allowedOrigins: ['https://example.com'],
        },
      );
      expect(ctx.audit).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'EMBED_TOKEN_CREATED',
          resource: 'embed_token',
          resourceId: 'a1111111-1111-1111-a111-111111111111',
        }),
      );
    });

    it('rejects non-admin roles', async () => {
      const caller = createCaller(orgContext(['EDITOR']));
      await expect(
        caller.embedTokens.create({
          submissionPeriodId: 'b2222222-2222-2222-a222-222222222222',
        }),
      ).rejects.toThrow('Admin role required');
    });
  });

  describe('listByPeriod', () => {
    it('returns tokens for period', async () => {
      const tokens = [
        {
          id: 'a1111111-1111-1111-a111-111111111111',
          submissionPeriodId: 'b2222222-2222-2222-a222-222222222222',
          tokenPrefix: 'col_emb_',
          allowedOrigins: [],
          themeConfig: null,
          active: true,
          createdAt: new Date(),
          expiresAt: null,
        },
      ];
      mockEmbedTokenService.list.mockResolvedValueOnce(tokens);

      const caller = createCaller(orgContext(['READER']));
      const result = await caller.embedTokens.listByPeriod({
        submissionPeriodId: 'b2222222-2222-2222-a222-222222222222',
      });

      expect(result).toEqual(tokens);
      expect(mockEmbedTokenService.list).toHaveBeenCalledWith(
        expect.anything(),
        'b2222222-2222-2222-a222-222222222222',
      );
    });
  });

  describe('revoke', () => {
    it('deactivates the token', async () => {
      mockEmbedTokenService.revoke.mockResolvedValueOnce({
        id: 'a1111111-1111-1111-a111-111111111111',
        active: false,
      });

      const ctx = orgContext(['ADMIN']);
      const caller = createCaller(ctx);
      const result = await caller.embedTokens.revoke({
        tokenId: 'a1111111-1111-1111-a111-111111111111',
      });

      expect(result.active).toBe(false);
      expect(ctx.audit).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'EMBED_TOKEN_REVOKED',
          resource: 'embed_token',
          resourceId: 'a1111111-1111-1111-a111-111111111111',
        }),
      );
    });

    it('throws NOT_FOUND when token does not exist', async () => {
      mockEmbedTokenService.revoke.mockResolvedValueOnce(null);

      const caller = createCaller(orgContext(['ADMIN']));
      await expect(
        caller.embedTokens.revoke({
          tokenId: 'b2222222-2222-2222-a222-222222222222',
        }),
      ).rejects.toThrow('Embed token not found');
    });

    it('rejects non-admin users', async () => {
      const caller = createCaller(orgContext(['EDITOR']));
      await expect(
        caller.embedTokens.revoke({
          tokenId: 'a1111111-1111-1111-a111-111111111111',
        }),
      ).rejects.toThrow('Admin role required');
    });
  });

  /**
   * Until the P0.4 coverage gate landed, create and revoke declared no scope
   * guard — so any API key, holding any scope, could mint or revoke an embed
   * token for the org. The role check alone did not help: a key inherits its
   * creator's roles, and embed tokens are created by admins.
   *
   * `init.js` is deliberately not mocked in this suite, so these exercise the
   * real `requireScopes` middleware.
   */
  describe('API key scope enforcement (P0.4)', () => {
    const PERIOD_ID = 'b2222222-2222-2222-a222-222222222222';
    const TOKEN_ID = 'a1111111-1111-1111-a111-111111111111';

    function keyCaller(scopes: string[]) {
      return createCaller(
        orgContext(['ADMIN'], {
          authContext: {
            userId: 'user-1',
            email: 'key@example.com',
            emailVerified: true,
            authMethod: 'apikey',
            apiKeyId: 'key-1',
            apiKeyScopes: scopes,
            orgId: 'org-1',
            roles: ['ADMIN'],
          },
        } as Partial<TRPCContext>),
      );
    }

    it('denies create to a key without periods:write', async () => {
      await expect(
        keyCaller(['manuscripts:read']).embedTokens.create({
          submissionPeriodId: PERIOD_ID,
          allowedOrigins: ['https://example.com'],
        }),
      ).rejects.toMatchObject({ code: 'FORBIDDEN' });
      expect(mockEmbedTokenService.create).not.toHaveBeenCalled();
    });

    it('denies create to a key holding only the read scope', async () => {
      await expect(
        keyCaller(['periods:read']).embedTokens.create({
          submissionPeriodId: PERIOD_ID,
          allowedOrigins: ['https://example.com'],
        }),
      ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    });

    it('denies revoke to a key without periods:write', async () => {
      await expect(
        keyCaller(['periods:read']).embedTokens.revoke({ tokenId: TOKEN_ID }),
      ).rejects.toMatchObject({ code: 'FORBIDDEN' });
      expect(mockEmbedTokenService.revoke).not.toHaveBeenCalled();
    });

    it('admits create to a key holding periods:write', async () => {
      mockEmbedTokenService.create.mockResolvedValueOnce({
        id: TOKEN_ID,
        submissionPeriodId: PERIOD_ID,
        tokenPrefix: 'col_emb_',
        plainTextToken: 'col_emb_abcdef1234567890abcdef1234567890',
        allowedOrigins: ['https://example.com'],
        themeConfig: null,
        active: true,
        createdAt: new Date(),
        expiresAt: null,
      });

      await expect(
        keyCaller(['periods:write']).embedTokens.create({
          submissionPeriodId: PERIOD_ID,
          allowedOrigins: ['https://example.com'],
        }),
      ).resolves.toMatchObject({ id: TOKEN_ID });
    });

    it('leaves interactive sessions unaffected — they carry no scopes at all', async () => {
      mockEmbedTokenService.revoke.mockResolvedValueOnce({
        id: TOKEN_ID,
        active: false,
      });

      await expect(
        createCaller(orgContext(['ADMIN'])).embedTokens.revoke({
          tokenId: TOKEN_ID,
        }),
      ).resolves.toMatchObject({ id: TOKEN_ID, active: false });
    });
  });
});
