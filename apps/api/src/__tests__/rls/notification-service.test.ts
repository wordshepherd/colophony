/**
 * Defense-in-depth: notificationService's explicit organization predicates.
 *
 * The same shape as `api-key-service.test.ts`, and for the same reason. Every
 * query below runs over the ADMIN pool, which connects as role `test`
 * (`rolsuper = t, rolbypassrls = t`), so RLS does not apply — not even the
 * `FORCE ROW LEVEL SECURITY` set on `notifications_inbox` by
 * `0034_notifications_inbox.sql`, which binds the table owner but not a
 * superuser. The only thing separating org A's notifications from org B's here
 * is the `WHERE organization_id = $orgId` clause in the service.
 *
 * This matters more than usual for this table. Its RLS policy uses the raising
 * idiom (`current_setting('app.current_org')::uuid`), and `userId` looks like it
 * is doing the isolating — so a reader can easily conclude these queries were
 * already scoped. They were not: before this suite, all four methods filtered on
 * `userId` alone, and the same user id can legitimately appear in two orgs'
 * inboxes.
 *
 * Do not "fix" this by switching to the app pool. That reinstates RLS and the
 * suite would pass with or without the predicates, testing nothing. The unit
 * spec cannot substitute either — it mocks `eq`/`and` as bare `vi.fn()`s
 * returning `undefined`, so the assembled `where` is discarded entirely.
 */
import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import { drizzle } from 'drizzle-orm/node-postgres';
import { eq } from 'drizzle-orm';
import {
  notificationsInbox,
  type Organization,
  type User,
} from '@colophony/db';
import { globalSetup, getAdminPool } from './helpers/db-setup';
import { truncateAllTables } from './helpers/cleanup';
import {
  createOrganization,
  createUser,
  createOrgMember,
} from './helpers/factories';
import { notificationService } from '../../services/notification.service.js';

type ServiceTx = Parameters<typeof notificationService.list>[0];

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

interface SeededNotification {
  id: string;
  organizationId: string;
  userId: string;
  readAt: Date | null;
}

async function createNotification(
  organizationId: string,
  userId: string,
  title: string,
): Promise<SeededNotification> {
  const [row] = await adminDb()
    .insert(notificationsInbox)
    .values({
      organizationId,
      userId,
      eventType: 'submission.received',
      title,
    })
    .returning();
  return row;
}

/** Read a row back over the admin pool, bypassing RLS — used to assert writes. */
async function readNotification(
  id: string,
): Promise<SeededNotification | null> {
  const rows = await adminDb()
    .select()
    .from(notificationsInbox)
    .where(eq(notificationsInbox.id, id));
  return rows[0] ?? null;
}

const PAGE = { unreadOnly: false, page: 1, limit: 20 };

describe('notificationService defense-in-depth (RLS bypassed)', () => {
  let orgA: Organization;
  let orgB: Organization;
  // One user, a member of both orgs. This is the case the userId-only predicate
  // could not distinguish, and it is not contrived — a writer submitting to two
  // magazines on one instance has exactly this shape.
  let user: User;
  let notifA: SeededNotification;
  let notifB: SeededNotification;

  beforeAll(async () => {
    await globalSetup();
    await truncateAllTables();

    orgA = await createOrganization({ name: 'Org Alpha' });
    orgB = await createOrganization({ name: 'Org Beta' });
    user = await createUser();
    await createOrgMember(orgA.id, user.id, { roles: ['ADMIN'] });
    await createOrgMember(orgB.id, user.id, { roles: ['ADMIN'] });
  });

  // Fresh rows per test: markRead/markAllRead mutate, so cases must not depend
  // on each other's ordering.
  beforeEach(async () => {
    await adminDb().delete(notificationsInbox);
    notifA = await createNotification(orgA.id, user.id, 'Alpha notification');
    notifB = await createNotification(orgB.id, user.id, 'Beta notification');
  });

  afterAll(async () => {
    await truncateAllTables();
  });

  describe('list', () => {
    it("returns only the caller's org notifications", async () => {
      const result = await notificationService.list(
        adminTx(),
        { ...PAGE, userId: user.id },
        orgA.id,
      );

      expect(result.items.map((n) => n.id)).toEqual([notifA.id]);
      expect(result.items.map((n) => n.id)).not.toContain(notifB.id);
    });

    it('scopes the total count to the org', async () => {
      // Without a predicate on the count query, `total` reports every org's rows
      // even when `items` is correctly filtered — the pagination metadata leaks
      // a row count across tenants.
      const result = await notificationService.list(
        adminTx(),
        { ...PAGE, userId: user.id },
        orgA.id,
      );

      expect(result.total).toBe(1);
      expect(result.totalPages).toBe(1);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);
    });

    it('applies the org predicate alongside the unread filter', async () => {
      await notificationService.markRead(
        adminTx(),
        notifA.id,
        user.id,
        orgA.id,
      );

      const result = await notificationService.list(
        adminTx(),
        { ...PAGE, userId: user.id, unreadOnly: true },
        orgA.id,
      );

      // Org B's row is still unread, but belongs to another tenant.
      expect(result.items).toHaveLength(0);
      expect(result.total).toBe(0);
    });
  });

  describe('unreadCount', () => {
    it("counts only the caller's org", async () => {
      const result = await notificationService.unreadCount(
        adminTx(),
        user.id,
        orgA.id,
      );

      expect(result).toBe(1);
    });
  });

  describe('markRead', () => {
    it('refuses a notification in another org and writes nothing', async () => {
      const result = await notificationService.markRead(
        adminTx(),
        notifB.id,
        user.id,
        orgA.id,
      );

      expect(result).toBe(false);

      const stored = await readNotification(notifB.id);
      expect(stored?.readAt).toBeNull();
    });

    it("marks a notification in the caller's own org", async () => {
      const result = await notificationService.markRead(
        adminTx(),
        notifA.id,
        user.id,
        orgA.id,
      );

      expect(result).toBe(true);

      const stored = await readNotification(notifA.id);
      expect(stored?.readAt).not.toBeNull();
    });
  });

  describe('markAllRead', () => {
    it("marks only the caller's org and leaves other tenants unread", async () => {
      const result = await notificationService.markAllRead(
        adminTx(),
        user.id,
        orgA.id,
      );

      expect(result).toBe(1);

      expect((await readNotification(notifA.id))?.readAt).not.toBeNull();
      expect((await readNotification(notifB.id))?.readAt).toBeNull();
    });
  });
});
