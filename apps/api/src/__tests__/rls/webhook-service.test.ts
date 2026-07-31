/**
 * Defense-in-depth: webhookService's explicit organization predicates.
 *
 * The same shape as `notification-service.test.ts`, and for the same reason.
 * Every query below runs over the ADMIN pool, which connects as a superuser
 * (`rolsuper = t, rolbypassrls = t`), so RLS does not apply — not even the
 * `FORCE ROW LEVEL SECURITY` set by `0033_webhook_endpoints.sql`, which binds
 * the table owner but not a superuser. The only thing separating org A's rows
 * from org B's here is the `WHERE organization_id = $orgId` in the service.
 *
 * **Read the coverage note before trusting a green run.** This service was
 * mostly already scoped: a 2026-03-04 pass fixed `getEndpoint`,
 * `listEndpoints`, `updateEndpoint`, `deleteEndpoint` and `rotateSecret`, and
 * missed every delivery method. So most cases below are regression pins on
 * predicates that predate this change, and only some prove a fix:
 *
 *   - `retryDelivery` was the live gap — `UPDATE … WHERE id = $1` with no org
 *     term, and its caller compared ownership *after* the mutation. Because
 *     tRPC turns a throw into a normal reply, `db-context` committed rather
 *     than rolled back, so another org's delivery was left permanently QUEUED
 *     with its failure fields nulled. `refuses another org's delivery …` is the
 *     case that catches it, and it fails twice over on the old code: the call
 *     resolves instead of throwing, *and* the row is mutated.
 *   - `listDeliveries` took `organizationId?` and applied it only under an
 *     `if`. `endpointId` is caller-supplied, so `ignores an endpointId
 *     belonging to another org` is the sharp case.
 *   - `updateDeliveryStatus` and `countRecentFailures` are defence-in-depth,
 *     not live fixes: their only caller resolves the delivery through the
 *     org-scoped `getEndpointForDelivery` join first. The predicate exists
 *     because that guard is a property of one call site, not of the statement.
 *
 * Do not "fix" this by switching to the app pool. That reinstates RLS and the
 * suite would pass with or without the predicates, testing nothing. The unit
 * spec cannot substitute either — it mocks `eq`/`and` as bare `vi.fn()`s
 * returning `undefined`, so the assembled `where` is discarded entirely.
 *
 * **Non-vacuity, measured by reverting each change in turn** (23 cases total):
 *
 * | Reverted                                          | Failing |
 * | ------------------------------------------------- | ------- |
 * | `retryDelivery` predicate + throw (original code) | 2       |
 * | `retryDelivery` throw only, predicate kept        | 2       |
 * | `retryDelivery` predicate only, throw kept        | 2       |
 * | `listDeliveries` seeded org condition             | 3       |
 * | `updateDeliveryStatus` predicate                  | 1       |
 * | `countRecentFailures` predicate                   | 1       |
 * | the four endpoint not-found throws                | 5       |
 *
 * The two `retryDelivery` halves show the same *count* but different *sets*,
 * which is the point of `does not write to another org's delivery,
 * independently of the throw`. Removing the throw fails the two cases that
 * assert on rejection; removing the predicate fails the write-only case
 * instead, because a nonexistent id matches nothing either way. Without that
 * third case the suite could not tell the two halves apart at all.
 */
import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import { drizzle } from 'drizzle-orm/node-postgres';
import { eq } from 'drizzle-orm';
import {
  webhookEndpoints,
  webhookDeliveries,
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
import { webhookService } from '../../services/webhook.service.js';

type ServiceTx = Parameters<typeof webhookService.listDeliveries>[0];

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

interface SeededEndpoint {
  id: string;
  organizationId: string;
  url: string;
  secret: string;
  status: 'ACTIVE' | 'DISABLED';
}

interface SeededDelivery {
  id: string;
  organizationId: string;
  webhookEndpointId: string;
  status: string;
  httpStatusCode: number | null;
  errorMessage: string | null;
  nextRetryAt: Date | null;
}

/**
 * Insert directly rather than through `createEndpoint`.
 *
 * `createEndpoint` calls `validateOutboundUrl`, which would couple these
 * fixtures to `NODE_ENV` and to DNS resolution of the seeded host.
 */
async function createEndpoint(
  organizationId: string,
  url: string,
): Promise<SeededEndpoint> {
  const [row] = await adminDb()
    .insert(webhookEndpoints)
    .values({
      organizationId,
      url,
      secret: 'seeded-secret',
      eventTypes: ['hopper/submission.submitted'],
      status: 'ACTIVE',
    })
    .returning();
  return row;
}

async function createDelivery(
  organizationId: string,
  webhookEndpointId: string,
  overrides: Record<string, unknown> = {},
): Promise<SeededDelivery> {
  const [row] = await adminDb()
    .insert(webhookDeliveries)
    .values({
      organizationId,
      webhookEndpointId,
      eventType: 'hopper/submission.submitted',
      eventId: crypto.randomUUID(),
      payload: { hello: 'world' },
      status: 'FAILED',
      httpStatusCode: 500,
      errorMessage: 'boom',
      nextRetryAt: new Date('2026-01-01T00:00:00.000Z'),
      ...overrides,
    })
    .returning();
  return row;
}

/** Read back over the admin pool, bypassing RLS — used to assert writes. */
async function readDelivery(id: string): Promise<SeededDelivery | null> {
  const rows = await adminDb()
    .select()
    .from(webhookDeliveries)
    .where(eq(webhookDeliveries.id, id));
  return rows[0] ?? null;
}

async function readEndpoint(id: string): Promise<SeededEndpoint | null> {
  const rows = await adminDb()
    .select()
    .from(webhookEndpoints)
    .where(eq(webhookEndpoints.id, id));
  return rows[0] ?? null;
}

const PAGE = { page: 1, limit: 20 };

describe('webhookService defense-in-depth (RLS bypassed)', () => {
  let orgA: Organization;
  let orgB: Organization;
  let user: User;
  let endpointA: SeededEndpoint;
  let endpointB: SeededEndpoint;
  let deliveryA: SeededDelivery;
  let deliveryB: SeededDelivery;

  beforeAll(async () => {
    await globalSetup();
    await truncateAllTables();

    orgA = await createOrganization({ name: 'Org Alpha' });
    orgB = await createOrganization({ name: 'Org Beta' });
    user = await createUser();
    await createOrgMember(orgA.id, user.id, { roles: ['ADMIN'] });
    await createOrgMember(orgB.id, user.id, { roles: ['ADMIN'] });
  });

  // Fresh rows per test: several cases mutate, so they must not depend on each
  // other's ordering. Deleting endpoints cascades to deliveries.
  beforeEach(async () => {
    await adminDb().delete(webhookDeliveries);
    await adminDb().delete(webhookEndpoints);
    endpointA = await createEndpoint(orgA.id, 'https://alpha.example.com/hook');
    endpointB = await createEndpoint(orgB.id, 'https://beta.example.com/hook');
    deliveryA = await createDelivery(orgA.id, endpointA.id);
    deliveryB = await createDelivery(orgB.id, endpointB.id);
  });

  afterAll(async () => {
    await truncateAllTables();
  });

  describe('getEndpoint', () => {
    it("throws for another org's endpoint", async () => {
      await expect(
        webhookService.getEndpoint(adminTx(), endpointB.id, orgA.id),
      ).rejects.toThrow(/endpoint .*not found/i);
    });

    it('throws the same error for an endpoint that does not exist at all', async () => {
      // Indistinguishable on purpose. A distinct error for "exists but is not
      // yours" is an existence oracle over another tenant's ids.
      await expect(
        webhookService.getEndpoint(adminTx(), crypto.randomUUID(), orgA.id),
      ).rejects.toThrow(/endpoint .*not found/i);
    });

    it("returns the caller's own endpoint with the secret stripped", async () => {
      const row = await webhookService.getEndpoint(
        adminTx(),
        endpointA.id,
        orgA.id,
      );
      expect(row.id).toBe(endpointA.id);
      expect(row).not.toHaveProperty('secret');
    });
  });

  describe('listEndpoints', () => {
    it("excludes another org's endpoints from both items and total", async () => {
      const result = await webhookService.listEndpoints(
        adminTx(),
        PAGE,
        orgA.id,
      );
      expect(result.items.map((e) => e.id)).toEqual([endpointA.id]);
      // Without a predicate on the count query, `total` leaks a cross-tenant
      // row count even when `items` is correctly filtered.
      expect(result.total).toBe(1);
    });

    it('strips the secret from every item', async () => {
      const result = await webhookService.listEndpoints(
        adminTx(),
        PAGE,
        orgA.id,
      );
      for (const item of result.items) {
        expect(item).not.toHaveProperty('secret');
      }
    });
  });

  describe('updateEndpoint', () => {
    it("throws for another org's endpoint and leaves the row untouched", async () => {
      await expect(
        webhookService.updateEndpoint(
          adminTx(),
          endpointB.id,
          { status: 'DISABLED' },
          orgA.id,
        ),
      ).rejects.toThrow(/endpoint .*not found/i);

      const after = await readEndpoint(endpointB.id);
      expect(after?.status).toBe('ACTIVE');
    });

    it("updates the caller's own endpoint and returns it without the secret", async () => {
      const row = await webhookService.updateEndpoint(
        adminTx(),
        endpointA.id,
        { status: 'DISABLED' },
        orgA.id,
      );
      expect(row.status).toBe('DISABLED');
      expect(row).not.toHaveProperty('secret');
    });
  });

  describe('deleteEndpoint', () => {
    it("throws for another org's endpoint and leaves it present", async () => {
      await expect(
        webhookService.deleteEndpoint(adminTx(), endpointB.id, orgA.id),
      ).rejects.toThrow(/endpoint .*not found/i);

      expect(await readEndpoint(endpointB.id)).not.toBeNull();
    });

    it("deletes the caller's own endpoint and cascades its deliveries", async () => {
      await webhookService.deleteEndpoint(adminTx(), endpointA.id, orgA.id);

      expect(await readEndpoint(endpointA.id)).toBeNull();
      // The worker's "endpoint deleted → discard the job" branch relies on the
      // delivery row going with it.
      expect(await readDelivery(deliveryA.id)).toBeNull();
    });
  });

  describe('rotateSecret', () => {
    it("throws for another org's endpoint and leaves the stored secret unchanged", async () => {
      const before = await readEndpoint(endpointB.id);

      await expect(
        webhookService.rotateSecret(adminTx(), endpointB.id, orgA.id),
      ).rejects.toThrow(/endpoint .*not found/i);

      const after = await readEndpoint(endpointB.id);
      expect(after?.secret).toBe(before?.secret);
    });

    it('returns the new plaintext secret, deliberately unredacted', async () => {
      const row = await webhookService.rotateSecret(
        adminTx(),
        endpointA.id,
        orgA.id,
      );
      // This and `createEndpoint` are the only two paths that hand back the
      // plaintext secret. Redacting here would break signing setup.
      expect(row.secret).toBeTruthy();
      expect(row.secret).not.toBe('seeded-secret');
    });
  });

  describe('disableEndpoint', () => {
    it("returns null for another org's endpoint rather than throwing, and leaves it ACTIVE", async () => {
      // Deliberately unlike `updateEndpoint`. Its only caller is the worker's
      // onFailed tail, inside a transaction that has already written the
      // delivery's FAILED status and audit row — a throw there would roll both
      // back to report an endpoint that is already gone.
      const result = await webhookService.disableEndpoint(
        adminTx(),
        endpointB.id,
        orgA.id,
      );
      expect(result).toBeNull();

      const after = await readEndpoint(endpointB.id);
      expect(after?.status).toBe('ACTIVE');
    });
  });

  describe('listDeliveries', () => {
    it("excludes another org's deliveries from both items and total", async () => {
      const result = await webhookService.listDeliveries(
        adminTx(),
        PAGE,
        orgA.id,
      );
      expect(result.items.map((d) => d.id)).toEqual([deliveryA.id]);
      expect(result.total).toBe(1);
    });

    it('ignores an endpointId belonging to another org', async () => {
      // The sharp case for the old `organizationId?`: `endpointId` is
      // caller-supplied and carries no tenancy, so with the org term applied
      // only under an `if`, pointing it at another org's endpoint returned
      // that org's deliveries.
      const result = await webhookService.listDeliveries(
        adminTx(),
        { ...PAGE, endpointId: endpointB.id },
        orgA.id,
      );
      expect(result.items).toEqual([]);
      expect(result.total).toBe(0);
    });

    it('applies the org predicate alongside a status filter', async () => {
      const result = await webhookService.listDeliveries(
        adminTx(),
        { ...PAGE, status: 'FAILED' },
        orgA.id,
      );
      expect(result.items.map((d) => d.id)).toEqual([deliveryA.id]);
    });
  });

  describe('retryDelivery', () => {
    it("refuses another org's delivery, writes nothing, and does not requeue it", async () => {
      // The headline case. On the old code this fails twice over: the call
      // resolves instead of throwing, and the row is mutated to QUEUED with its
      // failure fields nulled — a change tRPC then committed rather than rolled
      // back, because a thrown error becomes a normal HTTP reply.
      await expect(
        webhookService.retryDelivery(adminTx(), deliveryB.id, orgA.id),
      ).rejects.toThrow(/delivery .*not found/i);

      const after = await readDelivery(deliveryB.id);
      expect(after?.status).toBe('FAILED');
      expect(after?.httpStatusCode).toBe(500);
      expect(after?.errorMessage).toBe('boom');
      expect(after?.nextRetryAt).not.toBeNull();
    });

    it('throws the same error for a delivery that does not exist at all', async () => {
      await expect(
        webhookService.retryDelivery(adminTx(), crypto.randomUUID(), orgA.id),
      ).rejects.toThrow(/delivery .*not found/i);
    });

    it("does not write to another org's delivery, independently of the throw", async () => {
      // Deliberately swallows the rejection rather than asserting on it.
      //
      // The case above stops at `rejects.toThrow`, so it fails identically
      // whether the predicate is missing, the throw is missing, or both — it
      // cannot tell them apart. This one asserts only the write, so it holds
      // when the throw is removed and fails when the predicate is, which is
      // what makes the two halves separately measurable.
      await webhookService
        .retryDelivery(adminTx(), deliveryB.id, orgA.id)
        .catch(() => undefined);

      const after = await readDelivery(deliveryB.id);
      expect(after?.status).toBe('FAILED');
      expect(after?.httpStatusCode).toBe(500);
      expect(after?.nextRetryAt).not.toBeNull();
    });

    it("requeues the caller's own delivery and clears the previous attempt", async () => {
      const row = await webhookService.retryDelivery(
        adminTx(),
        deliveryA.id,
        orgA.id,
      );
      expect(row.status).toBe('QUEUED');

      const after = await readDelivery(deliveryA.id);
      expect(after?.status).toBe('QUEUED');
      expect(after?.httpStatusCode).toBeNull();
      expect(after?.errorMessage).toBeNull();
      expect(after?.nextRetryAt).toBeNull();
    });
  });

  describe('updateDeliveryStatus', () => {
    it("refuses another org's delivery and writes nothing", async () => {
      await webhookService.updateDeliveryStatus(
        adminTx(),
        deliveryB.id,
        'DELIVERED',
        orgA.id,
        { httpStatusCode: 200 },
      );

      const after = await readDelivery(deliveryB.id);
      expect(after?.status).toBe('FAILED');
      expect(after?.httpStatusCode).toBe(500);
    });

    it("updates the caller's own delivery", async () => {
      await webhookService.updateDeliveryStatus(
        adminTx(),
        deliveryA.id,
        'DELIVERED',
        orgA.id,
        { httpStatusCode: 200 },
      );

      const after = await readDelivery(deliveryA.id);
      expect(after?.status).toBe('DELIVERED');
    });
  });

  describe('countRecentFailures', () => {
    it("counts only the caller's org", async () => {
      // Both orgs have one FAILED delivery seeded. Without the org predicate
      // this would be 2 for an endpoint id that only org B owns — and this
      // count feeds the auto-disable threshold, so another tenant's failures
      // would help disable this org's endpoint.
      const countA = await webhookService.countRecentFailures(
        adminTx(),
        endpointA.id,
        orgA.id,
      );
      expect(countA).toBe(1);

      const crossOrg = await webhookService.countRecentFailures(
        adminTx(),
        endpointB.id,
        orgA.id,
      );
      expect(crossOrg).toBe(0);
    });
  });

  describe('getEndpointForDelivery', () => {
    it('returns null when the delivery and its endpoint sit in different orgs', async () => {
      // The FK does not constrain org, so this row is insertable. It is the
      // case the two-table predicate exists for, and the unit spec can only
      // check it by asserting `eq` call arguments.
      const mismatched = await createDelivery(orgA.id, endpointB.id);

      const result = await webhookService.getEndpointForDelivery(
        adminTx(),
        mismatched.id,
        orgA.id,
      );
      expect(result).toBeNull();
    });
  });
});
