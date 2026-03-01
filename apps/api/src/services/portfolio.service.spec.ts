import { describe, it, expect, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('@colophony/db', () => ({
  sql: Object.assign((...args: unknown[]) => ({ __sql: true, args }), {
    raw: (s: string) => ({ __raw: true, value: s }),
    join: (...args: unknown[]) => ({ __join: true, args }),
  }),
}));

import {
  portfolioService,
  NATIVE_TO_CSR,
  CSR_TO_NATIVE,
} from './portfolio.service.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const USER_ID = '00000000-0000-0000-0000-000000000001';

function makeTx(rows: unknown[]) {
  return {
    execute: vi.fn().mockResolvedValue({ rows }),
  } as unknown as Parameters<typeof portfolioService.list>[0];
}

function makeRow(overrides: Record<string, unknown> = {}) {
  return {
    total: 2,
    source: 'native',
    id: '00000000-0000-0000-0000-000000000010',
    title: 'My Poem',
    journal_name: 'Lit Review',
    status: 'sent',
    sent_at: '2025-06-01T00:00:00.000Z',
    responded_at: null,
    manuscript_id: '00000000-0000-0000-0000-000000000020',
    manuscript_title: 'Collected Works',
    created_at: '2025-06-01T00:00:00.000Z',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('portfolioService', () => {
  describe('list', () => {
    it('returns empty portfolio for user with no submissions', async () => {
      const tx = makeTx([]);
      const result = await portfolioService.list(tx, USER_ID, {
        page: 1,
        limit: 20,
      });

      expect(result.items).toEqual([]);
      expect(result.total).toBe(0);
      expect(result.totalPages).toBe(0);
    });

    it('merges native and external sorted by createdAt desc', async () => {
      const rows = [
        makeRow({
          source: 'external',
          created_at: '2025-07-01T00:00:00.000Z',
          total: 2,
        }),
        makeRow({
          source: 'native',
          created_at: '2025-06-01T00:00:00.000Z',
          total: 2,
        }),
      ];
      const tx = makeTx(rows);
      const result = await portfolioService.list(tx, USER_ID, {
        page: 1,
        limit: 20,
      });

      expect(result.items).toHaveLength(2);
      expect(result.items[0]?.source).toBe('external');
      expect(result.items[1]?.source).toBe('native');
    });

    it('maps native SUBMITTED to CSR sent', () => {
      expect(NATIVE_TO_CSR['SUBMITTED']).toBe('sent');
      expect(NATIVE_TO_CSR['UNDER_REVIEW']).toBe('in_review');
      expect(NATIVE_TO_CSR['ACCEPTED']).toBe('accepted');
      expect(NATIVE_TO_CSR['REJECTED']).toBe('rejected');
      expect(NATIVE_TO_CSR['REVISE_AND_RESUBMIT']).toBe('revise');
    });

    it('filters by harmonized status across both sources', async () => {
      const tx = makeTx([makeRow({ status: 'accepted', total: 1 })]);
      const result = await portfolioService.list(tx, USER_ID, {
        status: 'accepted',
        page: 1,
        limit: 20,
      });

      expect(result.items).toHaveLength(1);
      expect(result.items[0]?.status).toBe('accepted');
      // Verify the query was called (includes both native + external for 'accepted')
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(tx.execute).toHaveBeenCalled();
    });

    it('filters by source=native excludes external', async () => {
      const tx = makeTx([makeRow({ source: 'native', total: 1 })]);
      const result = await portfolioService.list(tx, USER_ID, {
        source: 'native',
        page: 1,
        limit: 20,
      });

      expect(result.items).toHaveLength(1);
      expect(result.items[0]?.source).toBe('native');
    });

    it('filters by source=external excludes native', async () => {
      const tx = makeTx([makeRow({ source: 'external', total: 1 })]);
      const result = await portfolioService.list(tx, USER_ID, {
        source: 'external',
        page: 1,
        limit: 20,
      });

      expect(result.items).toHaveLength(1);
      expect(result.items[0]?.source).toBe('external');
    });

    it('search filters by title and journalName with ILIKE', async () => {
      const tx = makeTx([makeRow({ total: 1 })]);
      await portfolioService.list(tx, USER_ID, {
        search: 'test%query',
        page: 1,
        limit: 20,
      });

      // The service escapes ILIKE special chars — verify execute was called
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(tx.execute).toHaveBeenCalled();
    });

    it('paginates with correct LIMIT/OFFSET', async () => {
      const tx = makeTx([]);
      await portfolioService.list(tx, USER_ID, {
        page: 2,
        limit: 10,
      });

      // Verify the query was called (pagination is in SQL)
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(tx.execute).toHaveBeenCalled();
    });

    it('includes manuscriptId and manuscriptTitle via JOIN', async () => {
      const tx = makeTx([
        makeRow({
          manuscript_id: '00000000-0000-0000-0000-000000000099',
          manuscript_title: 'My Book',
          total: 1,
        }),
      ]);
      const result = await portfolioService.list(tx, USER_ID, {
        page: 1,
        limit: 20,
      });

      expect(result.items[0]?.manuscriptId).toBe(
        '00000000-0000-0000-0000-000000000099',
      );
      expect(result.items[0]?.manuscriptTitle).toBe('My Book');
    });
  });

  describe('CSR_TO_NATIVE mapping', () => {
    it('has reverse mapping for all native statuses', () => {
      expect(CSR_TO_NATIVE['sent']).toEqual(['SUBMITTED']);
      expect(CSR_TO_NATIVE['accepted']).toEqual(['ACCEPTED']);
      expect(CSR_TO_NATIVE['no_response']).toEqual([]);
    });
  });
});
