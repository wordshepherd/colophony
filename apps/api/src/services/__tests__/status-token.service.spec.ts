import { describe, it, expect, vi, beforeEach } from 'vitest';
import crypto from 'node:crypto';

const mockUpdate = vi.fn().mockReturnThis();
const mockSet = vi.fn().mockReturnThis();
const mockWhere = vi.fn().mockResolvedValue(undefined);

vi.mock('@colophony/db', () => ({
  pool: {
    query: vi.fn(),
  },
  submissions: { id: 'id', statusTokenHash: 'status_token_hash' },
  eq: vi.fn(),
}));

vi.mock('@colophony/types', () => ({
  STATUS_TOKEN_PREFIX: 'col_sta_',
}));

import { statusTokenService } from '../status-token.service.js';
import { pool } from '@colophony/db';

describe('statusTokenService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('generateAndStore', () => {
    it('stores SHA-256 hash and returns col_sta_ prefixed token', async () => {
      const mockTx = {
        update: mockUpdate,
      } as unknown as Parameters<typeof statusTokenService.generateAndStore>[0];
      mockUpdate.mockReturnValue({ set: mockSet });
      mockSet.mockReturnValue({ where: mockWhere });

      const token = await statusTokenService.generateAndStore(
        mockTx,
        'sub-123',
      );

      expect(token).toMatch(/^col_sta_[a-f0-9]{32}$/);
      expect(mockUpdate).toHaveBeenCalled();
      expect(mockSet).toHaveBeenCalledWith({
        statusTokenHash: expect.stringMatching(/^[a-f0-9]{64}$/),
      });

      // Verify the stored hash is the SHA-256 of the returned token
      const expectedHash = crypto
        .createHash('sha256')
        .update(token)
        .digest('hex');
      expect(mockSet).toHaveBeenCalledWith({
        statusTokenHash: expectedHash,
      });
    });
  });

  describe('verifyToken', () => {
    it('returns null for unknown token', async () => {
      vi.mocked(pool.query).mockResolvedValue({ rows: [] } as never);

      const result = await statusTokenService.verifyToken(
        'col_sta_0000000000000000000000000000dead',
      );

      expect(result).toBeNull();
      expect(pool.query).toHaveBeenCalledWith(
        'SELECT * FROM verify_status_token($1)',
        [expect.stringMatching(/^[a-f0-9]{64}$/)],
      );
    });

    it('returns mapped result for valid token with user-friendly status', async () => {
      vi.mocked(pool.query).mockResolvedValue({
        rows: [
          {
            submission_id: 'sub-1',
            submission_title: 'My Poem',
            submission_status: 'HOLD',
            submitted_at: new Date('2026-01-15T00:00:00Z'),
            organization_name: 'Poetry Review',
            period_name: 'Spring 2026',
          },
        ],
      } as never);

      const result = await statusTokenService.verifyToken(
        'col_sta_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa1',
      );

      expect(result).toEqual({
        submissionId: 'sub-1',
        title: 'My Poem',
        status: 'Under Review', // HOLD maps to Under Review
        submittedAt: new Date('2026-01-15T00:00:00Z'),
        organizationName: 'Poetry Review',
        periodName: 'Spring 2026',
      });
    });

    it('maps ACCEPTED status correctly', async () => {
      vi.mocked(pool.query).mockResolvedValue({
        rows: [
          {
            submission_id: 'sub-2',
            submission_title: 'Story',
            submission_status: 'ACCEPTED',
            submitted_at: null,
            organization_name: 'Lit Mag',
            period_name: null,
          },
        ],
      } as never);

      const result = await statusTokenService.verifyToken('col_sta_test');

      expect(result?.status).toBe('Accepted');
    });

    it('maps REJECTED to Not Accepted', async () => {
      vi.mocked(pool.query).mockResolvedValue({
        rows: [
          {
            submission_id: 'sub-3',
            submission_title: 'Essay',
            submission_status: 'REJECTED',
            submitted_at: null,
            organization_name: 'Review',
            period_name: null,
          },
        ],
      } as never);

      const result = await statusTokenService.verifyToken('col_sta_test');

      expect(result?.status).toBe('Not Accepted');
    });
  });
});
