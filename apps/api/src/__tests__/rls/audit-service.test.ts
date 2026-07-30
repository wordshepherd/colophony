/**
 * Defense-in-depth: auditService's explicit organization predicates.
 *
 * The same shape as `api-key-service.test.ts` and `notification-service.test.ts`,
 * and for the same reason. Every query below runs over the ADMIN pool, which
 * connects as role `test` (`rolsuper = t, rolbypassrls = t`), so RLS does not
 * apply — not even the `FORCE ROW LEVEL SECURITY` set on `audit_events` by
 * `0002_apply_triggers.sql`, which binds the table owner but not a superuser.
 * The only thing separating org A's events from org B's here is the
 * `WHERE organization_id = $orgId` clause in the service.
 *
 * The audit log is the table this matters most for: it is the record of who did
 * what, so a cross-tenant read of it is worse than a cross-tenant read of the
 * rows it describes. Until 2026-07-30 both `list` and `getById` filtered without
 * any organization predicate and said so in their doc comments.
 *
 * `audit_events.organization_id` is NULLABLE, unlike `api_keys`'. Rows with a
 * NULL org are written deliberately — `logDirect` records auth failures before
 * an org is known, and `ON DELETE SET NULL` orphans rows when an org is removed.
 * Those rows were never visible through these methods: the SELECT policy is
 * `organization_id = current_org_id()`, and NULL never matches `=`. The
 * `excludes a global (null-org) event` cases below pin that equivalence, so the
 * explicit predicate cannot be accused of having narrowed the result set.
 *
 * Consequence: if someone deletes those predicates, this file fails while every
 * other test in the repo still passes. Do not "fix" it by switching to the app
 * pool — that reinstates RLS and the suite would pass with or without the
 * predicates, testing nothing. The unit spec cannot substitute either: it mocks
 * `eq`/`and` as bare `vi.fn()`s, so the assembled `where` is discarded entirely.
 */
import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import { drizzle } from 'drizzle-orm/node-postgres';
import { auditEvents, type Organization, type User } from '@colophony/db';
import { globalSetup, getAdminPool } from './helpers/db-setup';
import { truncateAllTables } from './helpers/cleanup';
import {
  createOrganization,
  createUser,
  createOrgMember,
  createAuditEvent,
} from './helpers/factories';
import { auditService } from '../../services/audit.service.js';

type ServiceTx = Parameters<typeof auditService.list>[0];

/**
 * A Drizzle handle over the RLS-bypassing admin pool, shaped as the `tx` the
 * service expects. The cast mirrors `helpers/factories.ts` — `@colophony/db`
 * and the test tree resolve drizzle through different optional peer-dep
 * contexts, so the types diverge while the runtime is a single copy.
 */
function adminTx(): ServiceTx {
  return drizzle(getAdminPool());
}

function adminDb(): ReturnType<typeof drizzle> {
  return drizzle(getAdminPool());
}

const PAGE = { page: 1, limit: 20 };

describe('auditService defense-in-depth (RLS bypassed)', () => {
  let orgA: Organization;
  let orgB: Organization;
  let user: User;
  let eventA: { id: string };
  let eventB: { id: string };
  // An org-less row, as `logDirect` writes for auth failures. Invisible under
  // the SELECT policy today; must stay invisible under the explicit predicate.
  let eventGlobal: { id: string };

  beforeAll(async () => {
    await globalSetup();
    await truncateAllTables();

    orgA = await createOrganization({ name: 'Org Alpha' });
    orgB = await createOrganization({ name: 'Org Beta' });
    user = await createUser();
    await createOrgMember(orgA.id, user.id, { roles: ['ADMIN'] });
    await createOrgMember(orgB.id, user.id, { roles: ['ADMIN'] });
  });

  // Fresh rows per test so the count assertions cannot drift as cases are
  // added or reordered.
  beforeEach(async () => {
    await adminDb().delete(auditEvents);

    eventA = await createAuditEvent({
      organizationId: orgA.id,
      actorId: user.id,
      action: 'USER_CREATED',
      resource: 'user',
    });
    eventB = await createAuditEvent({
      organizationId: orgB.id,
      actorId: user.id,
      action: 'USER_CREATED',
      resource: 'user',
    });
    eventGlobal = await createAuditEvent({
      organizationId: null,
      action: 'USER_CREATED',
      resource: 'user',
    });
  });

  afterAll(async () => {
    await truncateAllTables();
  });

  describe('list', () => {
    it("returns only the caller's org events", async () => {
      const result = await auditService.list(adminTx(), PAGE, orgA.id);

      expect(result.items.map((e) => e.id)).toEqual([eventA.id]);
      expect(result.items.map((e) => e.id)).not.toContain(eventB.id);
    });

    it('scopes the total count to the org', async () => {
      // Without a predicate on the count query, `total` reports every org's
      // events even when `items` is correctly filtered — the pagination
      // metadata leaks a row count across tenants.
      const result = await auditService.list(adminTx(), PAGE, orgA.id);

      expect(result.total).toBe(1);
      expect(result.totalPages).toBe(1);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);
    });

    it('applies the org predicate alongside an action filter', async () => {
      // Org B's event carries the same action, so only the org predicate can
      // exclude it.
      const result = await auditService.list(
        adminTx(),
        { ...PAGE, action: 'USER_CREATED' },
        orgA.id,
      );

      expect(result.items.map((e) => e.id)).toEqual([eventA.id]);
      expect(result.total).toBe(1);
    });

    it('excludes a global (null-org) event', async () => {
      const result = await auditService.list(adminTx(), PAGE, orgA.id);

      expect(result.items.map((e) => e.id)).not.toContain(eventGlobal.id);
    });
  });

  describe('getById', () => {
    it("returns an event in the caller's own org", async () => {
      const result = await auditService.getById(adminTx(), eventA.id, orgA.id);

      expect(result).not.toBeNull();
      expect(result!.id).toBe(eventA.id);
    });

    it('returns null for an event in another org', async () => {
      const result = await auditService.getById(adminTx(), eventB.id, orgA.id);

      expect(result).toBeNull();
    });

    it('returns null for a global (null-org) event', async () => {
      const result = await auditService.getById(
        adminTx(),
        eventGlobal.id,
        orgA.id,
      );

      expect(result).toBeNull();
    });
  });
});
