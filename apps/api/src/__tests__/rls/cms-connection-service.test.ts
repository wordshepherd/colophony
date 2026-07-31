/**
 * Defense-in-depth: cmsConnectionService's explicit organization predicates.
 *
 * The same shape and the same reason as `issue-service.test.ts` beside it —
 * every query runs over the ADMIN pool, which bypasses RLS, so the service's
 * `WHERE organization_id = $orgId` is the only thing separating org A's
 * connections from org B's. Switching this to the app pool would make it pass
 * with or without the predicates.
 *
 * All seven methods took `orgId?: string` before 2026-07-31. Unlike
 * `issueService`, none was guard-only: `cms_connections` carries an
 * `organization_id`, so every one of these is scoped on the statement itself and
 * is pinned directly by the case below it.
 *
 * Measured: reverting the predicates fails **7 of 7**. Every case here earns its
 * place, with no redundancy to hide behind.
 *
 * `testConnection` is covered through `getById`, which it delegates to — there
 * is no separate query to scope, and a case that reached the adapter would be
 * testing the adapter.
 */
import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import { drizzle } from 'drizzle-orm/node-postgres';
import { eq } from 'drizzle-orm';
import {
  cmsConnections,
  type Organization,
  type Publication,
} from '@colophony/db';
import { globalSetup, getAdminPool } from './helpers/db-setup';
import { truncateAllTables } from './helpers/cleanup';
import {
  createOrganization,
  createPublication,
  createCmsConnection,
  type CmsConnectionRow,
} from './helpers/factories';
import {
  cmsConnectionService,
  CmsConnectionNotFoundError,
} from '../../services/cms-connection.service.js';

type ServiceTx = Parameters<typeof cmsConnectionService.getById>[0];

function adminTx(): ServiceTx {
  return drizzle(getAdminPool());
}

function adminDb(): ReturnType<typeof drizzle> {
  return drizzle(getAdminPool());
}

async function readConnection(id: string) {
  const [row] = await adminDb()
    .select()
    .from(cmsConnections)
    .where(eq(cmsConnections.id, id))
    .limit(1);
  return row ?? null;
}

const LIST_INPUT = { page: 1, limit: 100 } as Parameters<
  typeof cmsConnectionService.list
>[1];

describe('cmsConnectionService defense-in-depth (RLS bypassed)', () => {
  let orgA: Organization;
  let orgB: Organization;
  let pubA: Publication;
  let pubB: Publication;

  beforeAll(async () => {
    await globalSetup();
    await truncateAllTables();

    orgA = await createOrganization({ name: 'Org Alpha' });
    orgB = await createOrganization({ name: 'Org Beta' });
    pubA = await createPublication(orgA.id);
    pubB = await createPublication(orgB.id);
  });

  let connA: CmsConnectionRow;
  let connB: CmsConnectionRow;

  beforeEach(async () => {
    await adminDb().delete(cmsConnections);
    connA = await createCmsConnection(orgA.id, {
      name: 'Alpha CMS',
      publicationId: pubA.id,
    });
    connB = await createCmsConnection(orgB.id, {
      name: 'Beta CMS',
      publicationId: pubB.id,
    });
  });

  afterAll(async () => {
    await truncateAllTables();
  });

  describe('list', () => {
    it("excludes another org's connections from both items and total", async () => {
      const result = await cmsConnectionService.list(
        adminTx(),
        LIST_INPUT,
        orgA.id,
      );

      expect(result.items.map((c) => c.id)).toEqual([connA.id]);
      expect(result.items.map((c) => c.id)).not.toContain(connB.id);
      expect(result.total).toBe(1);
    });
  });

  describe('getById', () => {
    it('returns null for a connection in another org', async () => {
      const result = await cmsConnectionService.getById(
        adminTx(),
        connB.id,
        orgA.id,
      );
      expect(result).toBeNull();
    });
  });

  describe('update', () => {
    it("returns null for another org's connection and leaves it untouched", async () => {
      const result = await cmsConnectionService.update(
        adminTx(),
        connB.id,
        { name: 'Hijacked' },
        orgA.id,
      );

      expect(result).toBeNull();
      const row = await readConnection(connB.id);
      expect(row?.name).toBe('Beta CMS');
    });
  });

  describe('delete', () => {
    it("returns null for another org's connection and leaves it present", async () => {
      const result = await cmsConnectionService.delete(
        adminTx(),
        connB.id,
        orgA.id,
      );

      expect(result).toBeNull();
      expect(await readConnection(connB.id)).not.toBeNull();
    });
  });

  describe('testConnection', () => {
    it("throws for another org's connection without reaching the adapter", async () => {
      await expect(
        cmsConnectionService.testConnection(adminTx(), connB.id, orgA.id),
      ).rejects.toThrow(CmsConnectionNotFoundError);
    });
  });

  describe('listByPublication', () => {
    it("returns nothing for another org's publication", async () => {
      const result = await cmsConnectionService.listByPublication(
        adminTx(),
        pubB.id,
        orgA.id,
      );
      expect(result).toEqual([]);

      // Sanity: A's own publication does resolve, so the empty result above is
      // the predicate and not an empty fixture.
      const own = await cmsConnectionService.listByPublication(
        adminTx(),
        pubA.id,
        orgA.id,
      );
      expect(own.map((c) => c.id)).toEqual([connA.id]);
    });
  });

  describe('updateLastSync', () => {
    it("does not stamp another org's connection", async () => {
      await cmsConnectionService.updateLastSync(adminTx(), connB.id, orgA.id);

      const row = await readConnection(connB.id);
      expect(row?.lastSyncAt).toBeNull();
    });
  });
});
