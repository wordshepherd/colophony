import { describe, it, expect, vi } from 'vitest';
import { createLoaders } from './loaders.js';
import type { DrizzleDb } from '@colophony/db';

/**
 * Create a mock DrizzleDb where select().from().where() resolves to `rows`.
 * The Drizzle query chain: tx.select().from(table).where(cond) → Promise<Row[]>
 */
function mockTx(rows: unknown[] = []) {
  const mockWhere = vi.fn().mockResolvedValue(rows);
  const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
  const mockSelect = vi.fn().mockReturnValue({ from: mockFrom });
  return { select: mockSelect } as unknown as DrizzleDb;
}

describe('createLoaders', () => {
  describe('with null dbTx', () => {
    it('submissionFiles returns empty arrays', async () => {
      const loaders = createLoaders(null);
      const result = await loaders.submissionFiles.load('id-1');
      expect(result).toEqual([]);
    });

    it('user returns null', async () => {
      const loaders = createLoaders(null);
      const result = await loaders.user.load('id-1');
      expect(result).toBeNull();
    });

    it('orgMembers returns empty arrays', async () => {
      const loaders = createLoaders(null);
      const result = await loaders.orgMembers.load('id-1');
      expect(result).toEqual([]);
    });
  });

  describe('with valid dbTx', () => {
    it('submissionFiles groups results by submissionId', async () => {
      const files = [
        { id: 'f1', submissionId: 'sub-1', filename: 'a.pdf' },
        { id: 'f2', submissionId: 'sub-1', filename: 'b.pdf' },
        { id: 'f3', submissionId: 'sub-2', filename: 'c.pdf' },
      ];
      const tx = mockTx(files);
      const loaders = createLoaders(tx);

      const [r1, r2, r3] = await Promise.all([
        loaders.submissionFiles.load('sub-1'),
        loaders.submissionFiles.load('sub-2'),
        loaders.submissionFiles.load('sub-3'),
      ]);

      expect(r1).toHaveLength(2);
      expect(r2).toHaveLength(1);
      expect(r3).toHaveLength(0);
    });

    it('user maps results by id', async () => {
      const userRows = [
        { id: 'u1', email: 'a@test.com' },
        { id: 'u2', email: 'b@test.com' },
      ];
      const tx = mockTx(userRows);
      const loaders = createLoaders(tx);

      const [r1, r2, r3] = await Promise.all([
        loaders.user.load('u1'),
        loaders.user.load('u2'),
        loaders.user.load('u3'),
      ]);

      expect(r1).toEqual(userRows[0]);
      expect(r2).toEqual(userRows[1]);
      expect(r3).toBeNull();
    });

    it('orgMembers groups results by organizationId', async () => {
      const members = [
        { id: 'm1', organizationId: 'org-1', role: 'ADMIN' },
        { id: 'm2', organizationId: 'org-1', role: 'READER' },
      ];
      const tx = mockTx(members);
      const loaders = createLoaders(tx);

      const [r1, r2] = await Promise.all([
        loaders.orgMembers.load('org-1'),
        loaders.orgMembers.load('org-2'),
      ]);

      expect(r1).toHaveLength(2);
      expect(r2).toHaveLength(0);
    });
  });
});
