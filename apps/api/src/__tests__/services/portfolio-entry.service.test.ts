import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import { globalSetup } from '../rls/helpers/db-setup.js';
import { truncateAllTables } from '../rls/helpers/cleanup.js';
import { withTestRls } from '../rls/helpers/rls-context.js';
import { createUser } from '../rls/helpers/factories.js';
import { portfolioEntryService } from '../../services/portfolio-entry.service.js';

beforeAll(async () => {
  await globalSetup();
});

afterEach(async () => {
  await truncateAllTables();
});

describe('portfolioEntryService — integration', () => {
  describe('CRUD lifecycle', () => {
    it('creates an external portfolio entry', async () => {
      const user = await createUser();

      const entry = await withTestRls({ userId: user.id }, async (tx) => {
        return portfolioEntryService.create(tx, user.id, {
          title: 'My Published Story',
          publicationName: 'The Paris Review',
        });
      });

      expect(entry.title).toBe('My Published Story');
      expect(entry.publicationName).toBe('The Paris Review');
      expect(entry.type).toBe('external');
      expect(entry.userId).toBe(user.id);
    });

    it('lists and filters by type', async () => {
      const user = await createUser();

      await withTestRls({ userId: user.id }, async (tx) => {
        await portfolioEntryService.create(tx, user.id, {
          title: 'Story 1',
          publicationName: 'Mag A',
        });
        await portfolioEntryService.create(tx, user.id, {
          title: 'Story 2',
          publicationName: 'Mag B',
        });
      });

      const all = await withTestRls({ userId: user.id }, async (tx) => {
        return portfolioEntryService.list(tx, user.id, {
          page: 1,
          limit: 20,
        });
      });

      expect(all.items).toHaveLength(2);
      expect(all.total).toBe(2);

      const external = await withTestRls({ userId: user.id }, async (tx) => {
        return portfolioEntryService.list(tx, user.id, {
          type: 'external',
          page: 1,
          limit: 20,
        });
      });

      expect(external.items).toHaveLength(2);
    });

    it('updates an external entry', async () => {
      const user = await createUser();

      const entry = await withTestRls({ userId: user.id }, async (tx) => {
        return portfolioEntryService.create(tx, user.id, {
          title: 'Original',
          publicationName: 'Mag',
        });
      });

      const updated = await withTestRls({ userId: user.id }, async (tx) => {
        return portfolioEntryService.update(tx, entry.id, {
          title: 'Updated Title',
        });
      });

      expect(updated.title).toBe('Updated Title');
    });

    it('deletes an external entry', async () => {
      const user = await createUser();

      const entry = await withTestRls({ userId: user.id }, async (tx) => {
        return portfolioEntryService.create(tx, user.id, {
          title: 'To Delete',
          publicationName: 'Mag',
        });
      });

      const deleted = await withTestRls({ userId: user.id }, async (tx) => {
        return portfolioEntryService.delete(tx, entry.id);
      });

      expect(deleted).not.toBeNull();
      expect(deleted.id).toBe(entry.id);
    });
  });

  describe('RLS isolation', () => {
    it('user A cannot see user B entries', async () => {
      const userA = await createUser();
      const userB = await createUser();

      await withTestRls({ userId: userA.id }, async (tx) => {
        await portfolioEntryService.create(tx, userA.id, {
          title: 'A Entry',
          publicationName: 'Mag A',
        });
      });
      await withTestRls({ userId: userB.id }, async (tx) => {
        await portfolioEntryService.create(tx, userB.id, {
          title: 'B Entry',
          publicationName: 'Mag B',
        });
      });

      const aEntries = await withTestRls({ userId: userA.id }, async (tx) => {
        return portfolioEntryService.list(tx, userA.id, {
          page: 1,
          limit: 20,
        });
      });

      expect(aEntries.items).toHaveLength(1);
      expect(aEntries.items[0].title).toBe('A Entry');
    });
  });

  describe('create always uses external type', () => {
    it('sets type to external regardless of input', async () => {
      const user = await createUser();

      const entry = await withTestRls({ userId: user.id }, async (tx) => {
        return portfolioEntryService.create(tx, user.id, {
          title: 'Test',
          publicationName: 'Mag',
        });
      });

      expect(entry.type).toBe('external');
    });
  });
});
