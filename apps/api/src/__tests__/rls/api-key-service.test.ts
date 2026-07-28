/**
 * Defense-in-depth: apiKeyService's explicit organization predicates.
 *
 * This suite is the deliberate mirror of `__tests__/security/defense-in-depth.test.ts`,
 * which proves RLS isolates tenants when a service carries no explicit filter. Here we
 * prove the other layer: that the explicit filter isolates tenants when RLS is not
 * there to help.
 *
 * That is why every query below runs over the ADMIN pool. It connects as role `test`,
 * which is `rolsuper = t, rolbypassrls = t`, so RLS does not apply — not even the
 * `FORCE ROW LEVEL SECURITY` set on `api_keys` by `0008_api_keys_rls.sql`, which binds
 * the table owner but not a superuser. The only thing separating org A's keys from
 * org B's in these tests is the `WHERE organization_id = $orgId` clause in the service.
 *
 * Consequence: if someone deletes those predicates, this file fails while every other
 * test in the repo still passes. Do not "fix" it by switching to the app pool — that
 * reinstates RLS and the suite would pass with or without the predicates, testing
 * nothing.
 */
import crypto from 'node:crypto';
import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import { drizzle } from 'drizzle-orm/node-postgres';
import { eq } from 'drizzle-orm';
import { apiKeys, type Organization, type User } from '@colophony/db';
import { globalSetup, getAdminPool } from './helpers/db-setup';
import { truncateAllTables } from './helpers/cleanup';
import {
  createOrganization,
  createUser,
  createOrgMember,
} from './helpers/factories';
import { apiKeyService } from '../../services/api-key.service.js';

type ServiceTx = Parameters<typeof apiKeyService.list>[0];

/**
 * A Drizzle handle over the RLS-bypassing admin pool, shaped as the `tx` the service
 * expects. The cast mirrors `helpers/factories.ts` — `@colophony/db` and the test tree
 * resolve drizzle through different optional peer-dep contexts, so the types diverge
 * while the runtime is a single copy.
 */
function adminTx(): ServiceTx {
  return drizzle(getAdminPool());
}

function adminDb(): ReturnType<typeof drizzle> {
  return drizzle(getAdminPool());
}

interface SeededKey {
  id: string;
  organizationId: string;
  revokedAt: Date | null;
}

async function createApiKey(
  organizationId: string,
  createdBy: string,
  name: string,
): Promise<SeededKey> {
  const [row] = await adminDb()
    .insert(apiKeys)
    .values({
      organizationId,
      createdBy,
      name,
      // Unique per row — `key_hash` carries a UNIQUE constraint.
      keyHash: crypto.randomBytes(32).toString('hex'),
      keyPrefix: 'col_live_',
      scopes: ['api-keys:read'],
    })
    .returning();
  return row;
}

/** Read a key back over the admin pool, bypassing RLS — used to assert writes. */
async function readKey(keyId: string): Promise<SeededKey | null> {
  const rows = await adminDb()
    .select()
    .from(apiKeys)
    .where(eq(apiKeys.id, keyId));
  return rows[0] ?? null;
}

const PAGINATION = { page: 1, limit: 20 };

describe('apiKeyService defense-in-depth (RLS bypassed)', () => {
  let orgA: Organization;
  let orgB: Organization;
  let userA: User;
  let userB: User;
  let keyA: SeededKey;
  let keyB: SeededKey;

  beforeAll(async () => {
    await globalSetup();
    await truncateAllTables();

    orgA = await createOrganization({ name: 'Org Alpha' });
    orgB = await createOrganization({ name: 'Org Beta' });
    userA = await createUser();
    userB = await createUser();
    await createOrgMember(orgA.id, userA.id, { roles: ['ADMIN'] });
    await createOrgMember(orgB.id, userB.id, { roles: ['ADMIN'] });
  });

  // Fresh keys per test: revoke/delete mutate, so the cases must not depend on
  // each other's ordering.
  beforeEach(async () => {
    await adminDb().delete(apiKeys);
    keyA = await createApiKey(orgA.id, userA.id, 'Alpha Key');
    keyB = await createApiKey(orgB.id, userB.id, 'Beta Key');
  });

  afterAll(async () => {
    await truncateAllTables();
  });

  describe('list', () => {
    it("returns only the caller's org keys", async () => {
      const result = await apiKeyService.list(adminTx(), PAGINATION, orgA.id);

      expect(result.items.map((k) => k.id)).toEqual([keyA.id]);
      expect(result.items.map((k) => k.id)).not.toContain(keyB.id);
    });

    it('scopes the total count to the org', async () => {
      // Without a predicate on the count query, `total` reports every org's keys
      // even when `items` is correctly filtered — the pagination metadata leaks a
      // row count across tenants.
      const result = await apiKeyService.list(adminTx(), PAGINATION, orgA.id);

      expect(result.total).toBe(1);
      expect(result.totalPages).toBe(1);
    });

    it('never returns keyHash', async () => {
      const result = await apiKeyService.list(adminTx(), PAGINATION, orgA.id);

      expect(result.items[0]).not.toHaveProperty('keyHash');
    });
  });

  describe('revoke', () => {
    it('returns null for a key in another org and writes nothing', async () => {
      const result = await apiKeyService.revoke(adminTx(), keyB.id, orgA.id);

      expect(result).toBeNull();

      const stored = await readKey(keyB.id);
      expect(stored?.revokedAt).toBeNull();
    });

    it("revokes a key in the caller's own org", async () => {
      const result = await apiKeyService.revoke(adminTx(), keyA.id, orgA.id);

      expect(result?.id).toBe(keyA.id);
      expect(result?.revokedAt).toBeInstanceOf(Date);

      const stored = await readKey(keyA.id);
      expect(stored?.revokedAt).not.toBeNull();
    });
  });

  describe('delete', () => {
    it('returns null for a key in another org and leaves the row in place', async () => {
      const result = await apiKeyService.delete(adminTx(), keyB.id, orgA.id);

      expect(result).toBeNull();
      expect(await readKey(keyB.id)).not.toBeNull();
    });

    it("deletes a key in the caller's own org", async () => {
      const result = await apiKeyService.delete(adminTx(), keyA.id, orgA.id);

      expect(result?.id).toBe(keyA.id);
      expect(await readKey(keyA.id)).toBeNull();
    });
  });
});
