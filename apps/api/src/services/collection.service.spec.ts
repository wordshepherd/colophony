import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ForbiddenError } from './errors.js';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('@colophony/db', () => ({
  workspaceCollections: {
    id: 'wc.id',
    organizationId: 'wc.org_id',
    ownerId: 'wc.owner_id',
    name: 'wc.name',
    visibility: 'wc.visibility',
    typeHint: 'wc.type_hint',
    updatedAt: 'wc.updated_at',
    description: 'wc.description',
  },
  workspaceItems: {
    id: 'wi.id',
    collectionId: 'wi.collection_id',
    submissionId: 'wi.submission_id',
    position: 'wi.position',
    notes: 'wi.notes',
    color: 'wi.color',
    icon: 'wi.icon',
  },
  submissions: {
    id: 's.id',
    organizationId: 's.org_id',
    title: 's.title',
  },
  eq: vi.fn(),
  and: vi.fn(),
  asc: vi.fn(),
  desc: vi.fn(),
}));

vi.mock('drizzle-orm', () => ({
  ilike: vi.fn(),
  count: vi.fn(),
  getTableColumns: vi.fn(() => ({
    id: 'wi.id',
    collectionId: 'wi.collection_id',
    submissionId: 'wi.submission_id',
    position: 'wi.position',
    notes: 'wi.notes',
    color: 'wi.color',
    icon: 'wi.icon',
  })),
  or: vi.fn(),
}));

vi.mock('./errors.js', () => ({
  assertEditorOrAdmin: vi.fn(),
  ForbiddenError: class ForbiddenError extends Error {
    constructor(msg: string) {
      super(msg);
      this.name = 'ForbiddenError';
    }
  },
}));

import {
  collectionService,
  CollectionNotFoundError,
  CollectionItemAlreadyExistsError,
  SubmissionNotInOrgError,
  CollectionItemNotFoundError,
} from './collection.service.js';
import { assertEditorOrAdmin } from './errors.js';
import { ilike, or } from 'drizzle-orm';
import { eq } from '@colophony/db';
import type { ServiceContext } from './types.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const ORG_ID = 'org-1';
const USER_ID = 'user-1';
const COLLECTION_ID = 'col-1';
const ITEM_ID = 'item-1';
const SUB_ID = 'sub-1';

const fakeCollection = {
  id: COLLECTION_ID,
  organizationId: ORG_ID,
  ownerId: USER_ID,
  name: 'My List',
  description: null,
  visibility: 'private' as const,
  typeHint: 'custom' as const,
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
};

const fakeItem = {
  id: ITEM_ID,
  collectionId: COLLECTION_ID,
  submissionId: SUB_ID,
  position: 0,
  notes: null,
  color: null,
  icon: null,
  readingAnchor: null,
  addedAt: new Date('2026-01-01'),
  touchedAt: new Date('2026-01-01'),
};

/**
 * Build a select chain: select → from → leftJoin? → where → orderBy → limit → offset
 * Drizzle query chains are awaitable at any point, so intermediate objects are
 * thenables (have a .then method) that also expose the next chain method.
 */
function createSelectChain(rows: unknown[]) {
  const offset = vi.fn().mockResolvedValue(rows);
  const limit = vi.fn().mockImplementation(() => {
    const p = Promise.resolve(rows);
    (p as Record<string, unknown>).offset = offset;
    return p;
  });
  const orderBy = vi.fn().mockReturnValue({ limit });
  // where() returns a thenable (for short chains like count) with orderBy/limit
  const where = vi.fn().mockImplementation(() => {
    const p = Promise.resolve(rows);
    (p as Record<string, unknown>).orderBy = orderBy;
    (p as Record<string, unknown>).limit = limit;
    return p;
  });
  const leftJoin = vi.fn().mockReturnValue({ where });
  const from = vi.fn().mockReturnValue({ where, leftJoin });
  const select = vi.fn().mockReturnValue({ from });
  return { select, from, where, leftJoin, orderBy, limit, offset };
}

/** Build an insert chain: insert → values → returning */
function createInsertChain(rows: unknown[]) {
  const returning = vi.fn().mockResolvedValue(rows);
  const values = vi.fn().mockReturnValue({ returning });
  const insert = vi.fn().mockReturnValue({ values });
  return { insert, values, returning };
}

/** Build an update chain: update → set → where → returning */
function createUpdateChain(rows: unknown[]) {
  const returning = vi.fn().mockResolvedValue(rows);
  const where = vi.fn().mockReturnValue({ returning });
  const set = vi.fn().mockReturnValue({ where });
  const update = vi.fn().mockReturnValue({ set });
  return { update, set, where, returning };
}

/** Build a delete chain: delete → where → returning */
function createDeleteChain(rows: unknown[]) {
  const returning = vi.fn().mockResolvedValue(rows);
  const where = vi.fn().mockReturnValue({ returning });
  const deleteFn = vi.fn().mockReturnValue({ where });
  return { delete: deleteFn, where, returning };
}

function makeCtx(overrides?: Partial<ServiceContext>): ServiceContext {
  return {
    tx: {} as never,
    actor: { userId: USER_ID, orgId: ORG_ID, role: 'EDITOR' },
    audit: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('collectionService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // -----------------------------------------------------------------------
  // list()
  // -----------------------------------------------------------------------

  describe('list()', () => {
    it('returns paginated results with total/totalPages', async () => {
      const items = [fakeCollection];
      const listChain = createSelectChain(items);
      const countChain = createSelectChain([{ count: 5 }]);

      // tx.select() is called twice (items + count) via Promise.all
      // Build the return values lazily so chain construction doesn't consume them
      const selectFn = vi.fn();
      selectFn.mockReturnValueOnce({ from: listChain.from });
      selectFn.mockReturnValueOnce({ from: countChain.from });
      const tx = { select: selectFn } as never;

      const result = await collectionService.list(
        tx,
        { page: 2, limit: 10 },
        ORG_ID,
        USER_ID,
      );

      expect(result).toEqual({
        items,
        total: 5,
        page: 2,
        limit: 10,
        totalPages: 1,
      });
    });

    it('filters by typeHint when provided', async () => {
      const chain = createSelectChain([]);
      const countChain = createSelectChain([{ count: 0 }]);
      const selectFn = vi
        .fn()
        .mockReturnValueOnce(chain.select())
        .mockReturnValueOnce(countChain.select());
      const tx = { select: selectFn } as never;

      await collectionService.list(
        tx,
        { page: 1, limit: 20, typeHint: 'holds' },
        ORG_ID,
      );

      expect(eq).toHaveBeenCalledWith('wc.type_hint', 'holds');
    });

    it('filters by search with ilike', async () => {
      const chain = createSelectChain([]);
      const countChain = createSelectChain([{ count: 0 }]);
      const selectFn = vi
        .fn()
        .mockReturnValueOnce(chain.select())
        .mockReturnValueOnce(countChain.select());
      const tx = { select: selectFn } as never;

      await collectionService.list(
        tx,
        { page: 1, limit: 20, search: 'poetry' },
        ORG_ID,
      );

      expect(ilike).toHaveBeenCalledWith('wc.name', '%poetry%');
    });

    it('applies visibility filter when userId provided', async () => {
      const chain = createSelectChain([]);
      const countChain = createSelectChain([{ count: 0 }]);
      const selectFn = vi
        .fn()
        .mockReturnValueOnce(chain.select())
        .mockReturnValueOnce(countChain.select());
      const tx = { select: selectFn } as never;

      await collectionService.list(tx, { page: 1, limit: 20 }, ORG_ID, USER_ID);

      expect(or).toHaveBeenCalled();
      // or() receives three args: team eq, collaborators eq, and(private, ownerId)
      expect(eq).toHaveBeenCalledWith('wc.visibility', 'team');
      expect(eq).toHaveBeenCalledWith('wc.visibility', 'collaborators');
      expect(eq).toHaveBeenCalledWith('wc.visibility', 'private');
      expect(eq).toHaveBeenCalledWith('wc.owner_id', USER_ID);
    });
  });

  // -----------------------------------------------------------------------
  // getById()
  // -----------------------------------------------------------------------

  describe('getById()', () => {
    it('returns collection when found', async () => {
      const chain = createSelectChain([fakeCollection]);
      const tx = { select: chain.select } as never;

      const result = await collectionService.getById(tx, COLLECTION_ID, ORG_ID);
      expect(result).toEqual(fakeCollection);
    });

    it('returns null when not found', async () => {
      const chain = createSelectChain([]);
      const tx = { select: chain.select } as never;

      const result = await collectionService.getById(tx, 'missing', ORG_ID);
      expect(result).toBeNull();
    });
  });

  // -----------------------------------------------------------------------
  // getItems()
  // -----------------------------------------------------------------------

  describe('getItems()', () => {
    it('returns items with submissionTitle join when collection exists', async () => {
      const itemsWithTitle = [{ ...fakeItem, submissionTitle: 'Poem A' }];
      // First select call: getById (returns collection)
      const getByIdChain = createSelectChain([fakeCollection]);
      // Second select call: items query with leftJoin
      const itemsChain = createSelectChain(itemsWithTitle);

      const selectFn = vi
        .fn()
        .mockReturnValueOnce(getByIdChain.select())
        .mockReturnValueOnce(itemsChain.select());
      const tx = { select: selectFn } as never;

      const result = await collectionService.getItems(
        tx,
        COLLECTION_ID,
        ORG_ID,
      );
      expect(result).toEqual(itemsWithTitle);
    });

    it('returns empty array when collection not found', async () => {
      const chain = createSelectChain([]);
      const tx = { select: chain.select } as never;

      const result = await collectionService.getItems(tx, 'missing', ORG_ID);
      expect(result).toEqual([]);
    });
  });

  // -----------------------------------------------------------------------
  // create()
  // -----------------------------------------------------------------------

  describe('create()', () => {
    it('inserts with defaults', async () => {
      const chain = createInsertChain([fakeCollection]);
      const tx = { insert: chain.insert } as never;

      const result = await collectionService.create(
        tx,
        { name: 'My List' },
        ORG_ID,
        USER_ID,
      );

      expect(result).toEqual(fakeCollection);
      expect(chain.values).toHaveBeenCalledWith({
        organizationId: ORG_ID,
        ownerId: USER_ID,
        name: 'My List',
        description: null,
        visibility: 'private',
        typeHint: 'custom',
      });
    });
  });

  // -----------------------------------------------------------------------
  // createWithAudit()
  // -----------------------------------------------------------------------

  describe('createWithAudit()', () => {
    it('creates collection and logs COLLECTION_CREATED audit', async () => {
      const chain = createInsertChain([fakeCollection]);
      const ctx = makeCtx({ tx: { insert: chain.insert } as never });

      const result = await collectionService.createWithAudit(ctx, {
        name: 'My List',
      });

      expect(result).toEqual(fakeCollection);
      expect(assertEditorOrAdmin).toHaveBeenCalledWith('EDITOR');
      expect(ctx.audit).toHaveBeenCalledWith({
        action: 'COLLECTION_CREATED',
        resource: 'collection',
        resourceId: COLLECTION_ID,
        newValue: { name: 'My List', typeHint: undefined },
      });
    });

    it('rejects READER role', async () => {
      vi.mocked(assertEditorOrAdmin).mockImplementation(() => {
        throw new ForbiddenError('Editor or admin role required');
      });

      const ctx = makeCtx({
        actor: { userId: USER_ID, orgId: ORG_ID, role: 'READER' },
      });

      await expect(
        collectionService.createWithAudit(ctx, { name: 'Nope' }),
      ).rejects.toThrow(ForbiddenError);

      // Reset so subsequent tests don't inherit the throwing mock
      vi.mocked(assertEditorOrAdmin).mockReset();
    });
  });

  // -----------------------------------------------------------------------
  // update()
  // -----------------------------------------------------------------------

  describe('update()', () => {
    it('updates specified fields and returns updated row', async () => {
      const updated = { ...fakeCollection, name: 'Renamed' };
      const chain = createUpdateChain([updated]);
      const tx = { update: chain.update } as never;

      const result = await collectionService.update(
        tx,
        COLLECTION_ID,
        { name: 'Renamed' },
        ORG_ID,
      );

      expect(result).toEqual(updated);
      const setArg = chain.set.mock.calls[0][0];
      expect(setArg.name).toBe('Renamed');
      expect(setArg.updatedAt).toBeInstanceOf(Date);
      // description not included since it wasn't in the input
      expect(setArg.description).toBeUndefined();
    });
  });

  // -----------------------------------------------------------------------
  // updateWithAudit()
  // -----------------------------------------------------------------------

  describe('updateWithAudit()', () => {
    it('updates and logs COLLECTION_UPDATED audit', async () => {
      // getById select chain
      const getByIdChain = createSelectChain([fakeCollection]);
      // update chain
      const updated = { ...fakeCollection, name: 'Renamed' };
      const updateChain = createUpdateChain([updated]);

      const tx = {
        select: getByIdChain.select,
        update: updateChain.update,
      } as never;
      const ctx = makeCtx({ tx });

      const result = await collectionService.updateWithAudit(
        ctx,
        COLLECTION_ID,
        { name: 'Renamed' },
      );

      expect(result).toEqual(updated);
      expect(ctx.audit).toHaveBeenCalledWith({
        action: 'COLLECTION_UPDATED',
        resource: 'collection',
        resourceId: COLLECTION_ID,
        newValue: { name: 'Renamed' },
      });
    });

    it('throws CollectionNotFoundError when getById returns null', async () => {
      const chain = createSelectChain([]);
      const ctx = makeCtx({ tx: { select: chain.select } as never });

      await expect(
        collectionService.updateWithAudit(ctx, 'missing', { name: 'X' }),
      ).rejects.toThrow(CollectionNotFoundError);
    });
  });

  // -----------------------------------------------------------------------
  // deleteWithAudit()
  // -----------------------------------------------------------------------

  describe('deleteWithAudit()', () => {
    it('deletes and logs COLLECTION_DELETED audit with name', async () => {
      const getByIdChain = createSelectChain([fakeCollection]);
      const deleteChain = createDeleteChain([fakeCollection]);

      const tx = {
        select: getByIdChain.select,
        delete: deleteChain.delete,
      } as never;
      const ctx = makeCtx({ tx });

      const result = await collectionService.deleteWithAudit(
        ctx,
        COLLECTION_ID,
      );

      expect(result).toEqual(fakeCollection);
      expect(ctx.audit).toHaveBeenCalledWith({
        action: 'COLLECTION_DELETED',
        resource: 'collection',
        resourceId: COLLECTION_ID,
        newValue: { name: 'My List' },
      });
    });
  });

  // -----------------------------------------------------------------------
  // addItem()
  // -----------------------------------------------------------------------

  describe('addItem()', () => {
    it('auto-calculates position when not provided', async () => {
      // getById chain returns collection
      const getByIdChain = createSelectChain([fakeCollection]);
      // org check chain returns submission
      const orgCheckChain = createSelectChain([{ id: SUB_ID }]);
      // max position chain returns existing item at position 3
      const maxPosChain = createSelectChain([{ position: 3 }]);
      // insert chain returns new item
      const newItem = { ...fakeItem, position: 4 };
      const insertChain = createInsertChain([newItem]);

      const selectFn = vi
        .fn()
        .mockReturnValueOnce(getByIdChain.select()) // getById
        .mockReturnValueOnce(orgCheckChain.select()) // org check
        .mockReturnValueOnce(maxPosChain.select()); // max position
      const tx = {
        select: selectFn,
        insert: insertChain.insert,
      } as never;

      const result = await collectionService.addItem(
        tx,
        COLLECTION_ID,
        { submissionId: SUB_ID },
        ORG_ID,
        USER_ID,
      );

      expect(result).toEqual(newItem);
      // position should be max + 1 = 4
      const insertValues = insertChain.values.mock.calls[0][0];
      expect(insertValues.position).toBe(4);
    });

    it('throws SubmissionNotInOrgError for cross-tenant submission', async () => {
      const getByIdChain = createSelectChain([fakeCollection]);
      const orgCheckChain = createSelectChain([]); // no submission found

      const selectFn = vi
        .fn()
        .mockReturnValueOnce(getByIdChain.select())
        .mockReturnValueOnce(orgCheckChain.select());
      const tx = { select: selectFn } as never;

      await expect(
        collectionService.addItem(
          tx,
          COLLECTION_ID,
          { submissionId: 'cross-tenant-sub' },
          ORG_ID,
          USER_ID,
        ),
      ).rejects.toThrow(SubmissionNotInOrgError);
    });

    it('throws CollectionItemAlreadyExistsError on unique constraint (23505)', async () => {
      const getByIdChain = createSelectChain([fakeCollection]);
      const orgCheckChain = createSelectChain([{ id: SUB_ID }]);
      const maxPosChain = createSelectChain([]);

      const dbError = Object.assign(new Error('unique violation'), {
        code: '23505',
      });
      const insertReturning = vi.fn().mockRejectedValue(dbError);
      const insertValues = vi
        .fn()
        .mockReturnValue({ returning: insertReturning });
      const insertFn = vi.fn().mockReturnValue({ values: insertValues });

      const selectFn = vi
        .fn()
        .mockReturnValueOnce(getByIdChain.select())
        .mockReturnValueOnce(orgCheckChain.select())
        .mockReturnValueOnce(maxPosChain.select());
      const tx = {
        select: selectFn,
        insert: insertFn,
      } as never;

      await expect(
        collectionService.addItem(
          tx,
          COLLECTION_ID,
          { submissionId: SUB_ID },
          ORG_ID,
          USER_ID,
        ),
      ).rejects.toThrow(CollectionItemAlreadyExistsError);
    });
  });

  // -----------------------------------------------------------------------
  // addItemWithAudit()
  // -----------------------------------------------------------------------

  describe('addItemWithAudit()', () => {
    it('adds item and logs COLLECTION_ITEM_ADDED audit', async () => {
      const getByIdChain = createSelectChain([fakeCollection]);
      const orgCheckChain = createSelectChain([{ id: SUB_ID }]);
      const maxPosChain = createSelectChain([]);
      const insertChain = createInsertChain([fakeItem]);

      const selectFn = vi
        .fn()
        .mockReturnValueOnce(getByIdChain.select())
        .mockReturnValueOnce(orgCheckChain.select())
        .mockReturnValueOnce(maxPosChain.select());
      const tx = {
        select: selectFn,
        insert: insertChain.insert,
      } as never;
      const ctx = makeCtx({ tx });

      const result = await collectionService.addItemWithAudit(
        ctx,
        COLLECTION_ID,
        {
          submissionId: SUB_ID,
        },
      );

      expect(result).toEqual(fakeItem);
      expect(assertEditorOrAdmin).toHaveBeenCalledWith('EDITOR');
      expect(ctx.audit).toHaveBeenCalledWith({
        action: 'COLLECTION_ITEM_ADDED',
        resource: 'collection',
        resourceId: COLLECTION_ID,
        newValue: { submissionId: SUB_ID },
      });
    });
  });

  // -----------------------------------------------------------------------
  // updateItem()
  // -----------------------------------------------------------------------

  describe('updateItem()', () => {
    it('updates item fields and returns updated row', async () => {
      const getByIdChain = createSelectChain([fakeCollection]);
      const updatedItem = { ...fakeItem, notes: 'Great piece' };
      const updateChain = createUpdateChain([updatedItem]);

      const tx = {
        select: getByIdChain.select,
        update: updateChain.update,
      } as never;

      const result = await collectionService.updateItem(
        tx,
        COLLECTION_ID,
        ITEM_ID,
        { notes: 'Great piece' },
        ORG_ID,
        USER_ID,
      );

      expect(result).toEqual(updatedItem);
      const setArg = updateChain.set.mock.calls[0][0];
      expect(setArg.notes).toBe('Great piece');
      expect(setArg.touchedAt).toBeInstanceOf(Date);
    });
  });

  // -----------------------------------------------------------------------
  // updateItemWithAudit()
  // -----------------------------------------------------------------------

  describe('updateItemWithAudit()', () => {
    it('throws CollectionItemNotFoundError when updateItem returns null', async () => {
      // getById returns collection but update returns nothing
      const getByIdChain = createSelectChain([fakeCollection]);
      const updateChain = createUpdateChain([]);

      const tx = {
        select: getByIdChain.select,
        update: updateChain.update,
      } as never;
      const ctx = makeCtx({ tx });

      await expect(
        collectionService.updateItemWithAudit(ctx, COLLECTION_ID, ITEM_ID, {
          notes: 'test',
        }),
      ).rejects.toThrow(CollectionItemNotFoundError);
      expect(assertEditorOrAdmin).toHaveBeenCalled();
    });
  });

  // -----------------------------------------------------------------------
  // removeItem()
  // -----------------------------------------------------------------------

  describe('removeItem()', () => {
    it('returns null when collection not visible', async () => {
      const getByIdChain = createSelectChain([]);
      const tx = { select: getByIdChain.select } as never;

      const result = await collectionService.removeItem(
        tx,
        COLLECTION_ID,
        ITEM_ID,
        ORG_ID,
        USER_ID,
      );

      expect(result).toBeNull();
    });
  });

  // -----------------------------------------------------------------------
  // removeItemWithAudit()
  // -----------------------------------------------------------------------

  describe('removeItemWithAudit()', () => {
    it('removes item and logs COLLECTION_ITEM_REMOVED audit', async () => {
      const getByIdChain = createSelectChain([fakeCollection]);
      const deleteChain = createDeleteChain([fakeItem]);

      const tx = {
        select: getByIdChain.select,
        delete: deleteChain.delete,
      } as never;
      const ctx = makeCtx({ tx });

      const result = await collectionService.removeItemWithAudit(
        ctx,
        COLLECTION_ID,
        ITEM_ID,
      );

      expect(result).toEqual(fakeItem);
      expect(ctx.audit).toHaveBeenCalledWith({
        action: 'COLLECTION_ITEM_REMOVED',
        resource: 'collection',
        resourceId: COLLECTION_ID,
        newValue: { itemId: ITEM_ID, submissionId: SUB_ID },
      });
    });
  });

  // -----------------------------------------------------------------------
  // reorderItems()
  // -----------------------------------------------------------------------

  describe('reorderItems()', () => {
    it('updates all positions and returns refreshed items', async () => {
      // getById for visibility check
      const getByIdChain = createSelectChain([fakeCollection]);
      // getItems after reorder (via internal getById + items query)
      const getByIdChain2 = createSelectChain([fakeCollection]);
      const reorderedItems = [
        { ...fakeItem, position: 1, submissionTitle: 'A' },
        { ...fakeItem, id: 'item-2', position: 0, submissionTitle: 'B' },
      ];
      const itemsChain = createSelectChain(reorderedItems);

      const selectFn = vi
        .fn()
        .mockReturnValueOnce(getByIdChain.select()) // reorderItems getById
        .mockReturnValueOnce(getByIdChain2.select()) // getItems → getById
        .mockReturnValueOnce(itemsChain.select()); // getItems → items query

      // update chain for each item position
      const updateChain1 = createUpdateChain([]);
      const updateChain2 = createUpdateChain([]);
      const updateFn = vi
        .fn()
        .mockReturnValueOnce(updateChain1.update())
        .mockReturnValueOnce(updateChain2.update());

      const tx = { select: selectFn, update: updateFn } as never;

      // Note: reorderItems passes orgId but not userId to the refresh
      // getItems call — this is a known behavior gap (line 549)
      const result = await collectionService.reorderItems(
        tx,
        COLLECTION_ID,
        {
          items: [
            { id: ITEM_ID, position: 1 },
            { id: 'item-2', position: 0 },
          ],
        },
        ORG_ID,
        USER_ID,
      );

      expect(result).toEqual(reorderedItems);
      expect(updateFn).toHaveBeenCalledTimes(2);
    });
  });
});
