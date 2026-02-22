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

      const ctx = orgContext('ADMIN');
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
      const caller = createCaller(orgContext('EDITOR'));
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

      const caller = createCaller(orgContext('READER'));
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

      const ctx = orgContext('ADMIN');
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

      const caller = createCaller(orgContext('ADMIN'));
      await expect(
        caller.embedTokens.revoke({
          tokenId: 'b2222222-2222-2222-a222-222222222222',
        }),
      ).rejects.toThrow('Embed token not found');
    });

    it('rejects non-admin users', async () => {
      const caller = createCaller(orgContext('EDITOR'));
      await expect(
        caller.embedTokens.revoke({
          tokenId: 'a1111111-1111-1111-a111-111111111111',
        }),
      ).rejects.toThrow('Admin role required');
    });
  });
});
