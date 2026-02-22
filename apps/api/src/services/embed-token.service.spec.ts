import { describe, it, expect, vi, beforeEach } from 'vitest';
import crypto from 'node:crypto';

const { mockPoolQuery } = vi.hoisted(() => {
  const mockPoolQuery = vi.fn();
  return { mockPoolQuery };
});

vi.mock('@colophony/db', () => ({
  pool: { query: mockPoolQuery },
  embedTokens: {
    id: 'id',
    organizationId: 'organization_id',
    submissionPeriodId: 'submission_period_id',
    tokenHash: 'token_hash',
    tokenPrefix: 'token_prefix',
    allowedOrigins: 'allowed_origins',
    themeConfig: 'theme_config',
    active: 'active',
    createdBy: 'created_by',
    createdAt: 'created_at',
    expiresAt: 'expires_at',
  },
  eq: vi.fn((_col: unknown, val: unknown) => val),
  and: vi.fn((...args: unknown[]) => args),
  sql: vi.fn(),
  DrizzleDb: {},
}));

vi.mock('@colophony/types', async (importOriginal) => {
  const original = await importOriginal<typeof import('@colophony/types')>();
  return { ...original };
});

import { embedTokenService } from './embed-token.service.js';

describe('embedTokenService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('verifyToken', () => {
    it('returns token details with joined period data', async () => {
      const plainTextToken = 'col_emb_abcdef1234567890abcdef1234567890';
      const expectedHash = crypto
        .createHash('sha256')
        .update(plainTextToken)
        .digest('hex');

      const now = new Date();
      mockPoolQuery.mockResolvedValueOnce({
        rows: [
          {
            id: 'token-1',
            organization_id: 'org-1',
            submission_period_id: 'period-1',
            allowed_origins: ['https://example.com'],
            theme_config: { primaryColor: '#3b82f6' },
            active: true,
            expires_at: null,
            period_name: 'Fall 2026',
            period_opens_at: new Date(now.getTime() - 86400000),
            period_closes_at: new Date(now.getTime() + 86400000),
            period_form_definition_id: 'form-1',
            period_max_submissions: 100,
            period_fee: '5.00',
          },
        ],
      });

      const result = await embedTokenService.verifyToken(plainTextToken);

      expect(mockPoolQuery).toHaveBeenCalledWith(
        'SELECT * FROM verify_embed_token($1)',
        [expectedHash],
      );
      expect(result).not.toBeNull();
      expect(result!.id).toBe('token-1');
      expect(result!.organizationId).toBe('org-1');
      expect(result!.period.name).toBe('Fall 2026');
      expect(result!.period.formDefinitionId).toBe('form-1');
    });

    it('returns null for invalid token', async () => {
      mockPoolQuery.mockResolvedValueOnce({ rows: [] });

      const result = await embedTokenService.verifyToken('col_emb_unknown');
      expect(result).toBeNull();
    });
  });

  describe('create', () => {
    it('generates token with col_emb_ prefix', async () => {
      const mockTx = {
        insert: vi.fn().mockReturnThis(),
        values: vi.fn().mockReturnThis(),
        returning: vi.fn().mockResolvedValue([
          {
            id: 'token-1',
            submissionPeriodId: 'period-1',
            tokenPrefix: 'col_emb_',
            allowedOrigins: ['https://example.com'],
            themeConfig: {},
            active: true,
            createdAt: new Date(),
            expiresAt: null,
          },
        ]),
      } as unknown as Parameters<typeof embedTokenService.create>[0];

      const result = await embedTokenService.create(mockTx, 'org-1', 'user-1', {
        submissionPeriodId: 'period-1',
        allowedOrigins: ['https://example.com'],
      });

      expect(result.plainTextToken).toMatch(/^col_emb_[0-9a-f]{32}$/);
      expect(result.id).toBe('token-1');
    });

    it('stores SHA-256 hash, never plain text', async () => {
      const mockTx = {
        insert: vi.fn().mockReturnThis(),
        values: vi.fn().mockReturnThis(),
        returning: vi.fn().mockResolvedValue([
          {
            id: 'token-1',
            submissionPeriodId: 'period-1',
            tokenPrefix: 'col_emb_',
            allowedOrigins: [],
            themeConfig: {},
            active: true,
            createdAt: new Date(),
            expiresAt: null,
          },
        ]),
      } as unknown as Parameters<typeof embedTokenService.create>[0];

      await embedTokenService.create(mockTx, 'org-1', 'user-1', {
        submissionPeriodId: 'period-1',
        allowedOrigins: [],
      });

      // eslint-disable-next-line @typescript-eslint/unbound-method
      const insertCall = mockTx.insert as ReturnType<typeof vi.fn>;
      const valuesCall =
        insertCall.mock.results[0].value.values.mock.calls[0][0];
      // tokenHash should be a 64-char hex string (SHA-256)
      expect(valuesCall.tokenHash).toMatch(/^[0-9a-f]{64}$/);
      // Should not store the plain text token
      expect(valuesCall.tokenHash).not.toMatch(/^col_emb_/);
    });

    it('stores allowedOrigins and themeConfig', async () => {
      const mockTx = {
        insert: vi.fn().mockReturnThis(),
        values: vi.fn().mockReturnThis(),
        returning: vi.fn().mockResolvedValue([
          {
            id: 'token-1',
            submissionPeriodId: 'period-1',
            tokenPrefix: 'col_emb_',
            allowedOrigins: ['https://example.com'],
            themeConfig: { primaryColor: '#ff0000' },
            active: true,
            createdAt: new Date(),
            expiresAt: null,
          },
        ]),
      } as unknown as Parameters<typeof embedTokenService.create>[0];

      await embedTokenService.create(mockTx, 'org-1', 'user-1', {
        submissionPeriodId: 'period-1',
        allowedOrigins: ['https://example.com'],
        themeConfig: { primaryColor: '#ff0000' },
      });

      // eslint-disable-next-line @typescript-eslint/unbound-method
      const insertCall = mockTx.insert as ReturnType<typeof vi.fn>;
      const valuesCall =
        insertCall.mock.results[0].value.values.mock.calls[0][0];
      expect(valuesCall.allowedOrigins).toEqual(['https://example.com']);
      expect(valuesCall.themeConfig).toEqual({ primaryColor: '#ff0000' });
    });
  });

  describe('revoke', () => {
    it('sets active = false', async () => {
      const mockTx = {
        update: vi.fn().mockReturnThis(),
        set: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        returning: vi
          .fn()
          .mockResolvedValue([{ id: 'token-1', active: false }]),
      } as unknown as Parameters<typeof embedTokenService.revoke>[0];

      const result = await embedTokenService.revoke(mockTx, 'token-1');
      expect(result).not.toBeNull();
      expect(result?.active).toBe(false);
    });

    it('returns null when token not found', async () => {
      const mockTx = {
        update: vi.fn().mockReturnThis(),
        set: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        returning: vi.fn().mockResolvedValue([]),
      } as unknown as Parameters<typeof embedTokenService.revoke>[0];

      const result = await embedTokenService.revoke(mockTx, 'nonexistent');
      expect(result).toBeNull();
    });
  });

  describe('list', () => {
    it('returns tokens for specific period', async () => {
      const items = [
        {
          id: 'token-1',
          submissionPeriodId: 'period-1',
          tokenPrefix: 'col_emb_',
          allowedOrigins: [],
          themeConfig: {},
          active: true,
          createdAt: new Date(),
          expiresAt: null,
        },
      ];

      const mockTx = {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              orderBy: vi.fn().mockResolvedValue(items),
            }),
          }),
        }),
      } as unknown as Parameters<typeof embedTokenService.list>[0];

      const result = await embedTokenService.list(mockTx, 'period-1');
      expect(result).toEqual(items);
    });
  });
});
