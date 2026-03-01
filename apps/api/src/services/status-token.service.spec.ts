import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockUpdate = vi.fn().mockReturnValue({
  set: vi.fn().mockReturnValue({
    where: vi.fn().mockResolvedValue(undefined),
  }),
});

const mockPoolQuery = vi.fn();

vi.mock('@colophony/db', () => ({
  pool: { query: (...args: unknown[]) => mockPoolQuery(...args) },
  submissions: { id: 'id' },
  eq: vi.fn(),
}));

vi.mock('@colophony/types', () => ({
  STATUS_TOKEN_PREFIX: 'col_sta_',
}));

import { statusTokenService } from './status-token.service.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createMockTx() {
  return {
    update: mockUpdate,
  } as any;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('statusTokenService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('generateAndStore', () => {
    it('generates token with col_sta_ prefix and correct length', async () => {
      const tx = createMockTx();
      const token = await statusTokenService.generateAndStore(tx, 'sub-1', 90);

      expect(token).toMatch(/^col_sta_[0-9a-f]{32}$/);
    });

    it('stores hash and expiresAt in submissions table', async () => {
      const tx = createMockTx();
      const setBefore = Date.now();
      await statusTokenService.generateAndStore(tx, 'sub-1', 90);
      const setAfter = Date.now();

      expect(mockUpdate).toHaveBeenCalled();
      const setCall = mockUpdate.mock.results[0].value.set;
      const setArg = setCall.mock.calls[0][0];

      expect(setArg.statusTokenHash).toBeDefined();
      expect(typeof setArg.statusTokenHash).toBe('string');
      expect(setArg.statusTokenHash.length).toBe(64); // SHA-256 hex

      expect(setArg.statusTokenExpiresAt).toBeInstanceOf(Date);
      const expiresMs = setArg.statusTokenExpiresAt.getTime();
      // Should be ~90 days from now
      expect(expiresMs).toBeGreaterThanOrEqual(
        setBefore + 90 * 24 * 60 * 60 * 1000 - 1000,
      );
      expect(expiresMs).toBeLessThanOrEqual(
        setAfter + 90 * 24 * 60 * 60 * 1000 + 1000,
      );
    });

    it('uses custom TTL when provided', async () => {
      const tx = createMockTx();
      const now = Date.now();
      await statusTokenService.generateAndStore(tx, 'sub-1', 30);

      const setCall = mockUpdate.mock.results[0].value.set;
      const setArg = setCall.mock.calls[0][0];

      const expiresMs = setArg.statusTokenExpiresAt.getTime();
      const expectedMs = now + 30 * 24 * 60 * 60 * 1000;
      expect(Math.abs(expiresMs - expectedMs)).toBeLessThan(2000);
    });

    it('sets null expiresAt when no TTL provided', async () => {
      const tx = createMockTx();
      await statusTokenService.generateAndStore(tx, 'sub-1');

      const setCall = mockUpdate.mock.results[0].value.set;
      const setArg = setCall.mock.calls[0][0];
      expect(setArg.statusTokenExpiresAt).toBeNull();
    });
  });

  describe('verifyToken', () => {
    it('returns null for unknown hash', async () => {
      mockPoolQuery.mockResolvedValue({ rows: [] });

      const result = await statusTokenService.verifyToken(
        'col_sta_nonexistent',
      );
      expect(result).toBeNull();
    });

    it('returns expired=false for valid token', async () => {
      mockPoolQuery.mockResolvedValue({
        rows: [
          {
            submission_id: 'sub-1',
            submission_title: 'My Poem',
            submission_status: 'SUBMITTED',
            submitted_at: new Date('2026-01-15'),
            organization_name: 'Test Org',
            period_name: 'Spring 2026',
            token_expired: false,
          },
        ],
      });

      const result = await statusTokenService.verifyToken('col_sta_abc123');

      expect(result).not.toBeNull();
      expect(result!.expired).toBe(false);
      expect(result!.title).toBe('My Poem');
      expect(result!.status).toBe('Under Review');
    });

    it('returns expired=true for expired token', async () => {
      mockPoolQuery.mockResolvedValue({
        rows: [
          {
            submission_id: 'sub-1',
            submission_title: 'My Poem',
            submission_status: 'SUBMITTED',
            submitted_at: new Date('2026-01-15'),
            organization_name: 'Test Org',
            period_name: 'Spring 2026',
            token_expired: true,
          },
        ],
      });

      const result = await statusTokenService.verifyToken('col_sta_expired');

      expect(result).not.toBeNull();
      expect(result!.expired).toBe(true);
    });

    it('maps internal status to display status correctly', async () => {
      const testCases = [
        { internal: 'SUBMITTED', display: 'Under Review' },
        { internal: 'UNDER_REVIEW', display: 'Under Review' },
        { internal: 'HOLD', display: 'Under Review' },
        { internal: 'ACCEPTED', display: 'Accepted' },
        { internal: 'REJECTED', display: 'Not Accepted' },
        { internal: 'WITHDRAWN', display: 'Withdrawn' },
        { internal: 'REVISE_AND_RESUBMIT', display: 'Revision Requested' },
        { internal: 'UNKNOWN_STATUS', display: 'Under Review' },
      ];

      for (const tc of testCases) {
        mockPoolQuery.mockResolvedValueOnce({
          rows: [
            {
              submission_id: 'sub-1',
              submission_title: 'Test',
              submission_status: tc.internal,
              submitted_at: new Date(),
              organization_name: 'Org',
              period_name: null,
              token_expired: false,
            },
          ],
        });

        const result = await statusTokenService.verifyToken('col_sta_test');
        expect(result!.status).toBe(tc.display);
      }
    });
  });
});
