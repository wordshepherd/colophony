/**
 * Defense-in-depth: pipelineService's explicit organization predicates.
 *
 * The same shape as `api-key-service.test.ts`, `notification-service.test.ts`
 * and `audit-service.test.ts`, and for the same reason. Every query below runs
 * over the ADMIN pool, which connects as role `test`
 * (`rolsuper = t, rolbypassrls = t`), so RLS does not apply — not even the
 * `FORCE ROW LEVEL SECURITY` set on `pipeline_items` by `0017_pipeline.sql`,
 * which binds the table owner but not a superuser. The only thing separating
 * org A's items from org B's here is the `WHERE organization_id = $orgId` in the
 * service. Do not "fix" this by switching to the app pool — that reinstates RLS
 * and the suite would pass with or without the predicates, testing nothing.
 *
 * This is the first test of any kind to drive `pipelineService` against a real
 * database. The unit spec cannot substitute: its `tx` is `{}`, so no `WHERE`
 * clause is ever assembled, let alone executed.
 *
 * Two of the defects pinned here were live cross-tenant *writes*, not just
 * reads. `assignCopyeditor` and `assignProofreader` took no `orgId` at all, and
 * `create`'s submission-existence check was unscoped — so org A could attach a
 * pipeline item to org B's submission and then read B's title back out through
 * the `list`/`getById` joins.
 *
 * ON `updateStage`, WHICH IS DEFENDED TWICE. Its cross-org case is held by the
 * org-scoped `getById` guard AND by the predicate + `if (!updated) throw` on the
 * UPDATE itself, and **either one alone is sufficient** — measured, by reverting
 * each in turn: neither revert on its own fails the case, and reverting both
 * does. So do not read a green run as proof of both. That redundancy is the
 * point rather than an oversight: the guard is what runs today, and the UPDATE
 * predicate is what keeps the method correct if a future refactor drops it.
 * Without the `!updated` throw that fallback is worse than nothing — the history
 * insert below it is unconditional, so a zero-row update would still write a row
 * against the other org's item, which `getHistory` would hand back to them.
 */
import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import { drizzle } from 'drizzle-orm/node-postgres';
import { eq } from 'drizzle-orm';
import {
  pipelineItems,
  pipelineHistory,
  type Organization,
  type User,
  type Submission,
  type PipelineItem,
} from '@colophony/db';
import { globalSetup, getAdminPool } from './helpers/db-setup';
import { truncateAllTables } from './helpers/cleanup';
import {
  createOrganization,
  createUser,
  createOrgMember,
  createSubmissionPeriod,
  createSubmission,
  createPipelineItem,
} from './helpers/factories';
import {
  pipelineService,
  PipelineItemNotFoundError,
  PipelineItemAlreadyExistsError,
  SubmissionNotAcceptedError,
} from '../../services/pipeline.service.js';

type ServiceTx = Parameters<typeof pipelineService.getById>[0];

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

/** Read a pipeline item back over the admin pool, bypassing the service. */
async function readItem(id: string) {
  const [row] = await adminDb()
    .select()
    .from(pipelineItems)
    .where(eq(pipelineItems.id, id))
    .limit(1);
  return row ?? null;
}

async function countHistoryFor(pipelineItemId: string) {
  const rows = await adminDb()
    .select()
    .from(pipelineHistory)
    .where(eq(pipelineHistory.pipelineItemId, pipelineItemId));
  return rows.length;
}

describe('pipelineService defense-in-depth (RLS bypassed)', () => {
  let orgA: Organization;
  let orgB: Organization;
  let user: User;
  // One submission per intended pipeline item: the unique index on
  // submission_id is global, so a submission can back at most one item ever.
  let subA: Submission;
  let subB: Submission;
  let subACreate: Submission;
  let subBCreate: Submission;
  let subBPending: Submission;

  beforeAll(async () => {
    await globalSetup();
    await truncateAllTables();

    orgA = await createOrganization({ name: 'Org Alpha' });
    orgB = await createOrganization({ name: 'Org Beta' });
    user = await createUser();
    await createOrgMember(orgA.id, user.id, { roles: ['ADMIN'] });
    await createOrgMember(orgB.id, user.id, { roles: ['ADMIN'] });

    const periodA = await createSubmissionPeriod(orgA.id);
    const periodB = await createSubmissionPeriod(orgB.id);

    [subA, subB, subACreate, subBCreate, subBPending] = await Promise.all([
      createSubmission(orgA.id, user.id, {
        submissionPeriodId: periodA.id,
        status: 'ACCEPTED',
      }),
      createSubmission(orgB.id, user.id, {
        submissionPeriodId: periodB.id,
        status: 'ACCEPTED',
      }),
      createSubmission(orgA.id, user.id, {
        submissionPeriodId: periodA.id,
        status: 'ACCEPTED',
      }),
      createSubmission(orgB.id, user.id, {
        submissionPeriodId: periodB.id,
        status: 'ACCEPTED',
      }),
      // Org B, deliberately NOT accepted — the status-oracle case.
      createSubmission(orgB.id, user.id, {
        submissionPeriodId: periodB.id,
        status: 'UNDER_REVIEW',
      }),
    ]);
  });

  // Fresh items per test. Deleting the parent cascades to pipeline_history and
  // pipeline_comments, so history counts cannot drift as cases are reordered.
  let itemA: PipelineItem;
  let itemB: PipelineItem;

  beforeEach(async () => {
    await adminDb().delete(pipelineItems);
    itemA = await createPipelineItem(orgA.id, subA.id);
    itemB = await createPipelineItem(orgB.id, subB.id);
  });

  afterAll(async () => {
    await truncateAllTables();
  });

  describe('assignCopyeditor', () => {
    it('returns null for an item in another org and leaves it untouched', async () => {
      const result = await pipelineService.assignCopyeditor(
        adminTx(),
        itemB.id,
        { userId: user.id },
        orgA.id,
      );

      expect(result).toBeNull();

      // The read-back is the point: a predicate-less UPDATE returns the row AND
      // mutates it, so asserting only on the return value would miss half of it.
      const stored = await readItem(itemB.id);
      expect(stored?.assignedCopyeditorId).toBeNull();
    });

    it("assigns within the caller's own org", async () => {
      const result = await pipelineService.assignCopyeditor(
        adminTx(),
        itemA.id,
        { userId: user.id },
        orgA.id,
      );

      expect(result).not.toBeNull();
      expect(result.assignedCopyeditorId).toBe(user.id);

      const stored = await readItem(itemA.id);
      expect(stored?.assignedCopyeditorId).toBe(user.id);
    });
  });

  describe('assignProofreader', () => {
    it('returns null for an item in another org and leaves it untouched', async () => {
      const result = await pipelineService.assignProofreader(
        adminTx(),
        itemB.id,
        { userId: user.id },
        orgA.id,
      );

      expect(result).toBeNull();

      const stored = await readItem(itemB.id);
      expect(stored?.assignedProofreaderId).toBeNull();
    });

    it("assigns within the caller's own org", async () => {
      const result = await pipelineService.assignProofreader(
        adminTx(),
        itemA.id,
        { userId: user.id },
        orgA.id,
      );

      expect(result).not.toBeNull();
      expect(result.assignedProofreaderId).toBe(user.id);

      const stored = await readItem(itemA.id);
      expect(stored?.assignedProofreaderId).toBe(user.id);
    });
  });

  describe('getBySubmissionId', () => {
    it('returns null for a submission in another org', async () => {
      const result = await pipelineService.getBySubmissionId(
        adminTx(),
        subB.id,
        orgA.id,
      );

      expect(result).toBeNull();
    });

    it("returns the item for a submission in the caller's own org", async () => {
      const result = await pipelineService.getBySubmissionId(
        adminTx(),
        subA.id,
        orgA.id,
      );

      expect(result?.id).toBe(itemA.id);
    });
  });

  describe('create', () => {
    it('refuses a submission belonging to another org, and writes nothing', async () => {
      await expect(
        pipelineService.create(
          adminTx(),
          { submissionId: subBCreate.id },
          orgA.id,
        ),
      ).rejects.toThrow(PipelineItemNotFoundError);

      const rows = await adminDb()
        .select()
        .from(pipelineItems)
        .where(eq(pipelineItems.submissionId, subBCreate.id));
      expect(rows).toHaveLength(0);
    });

    it("does not leak another org's submission status", async () => {
      // Scoping only the uniqueness check would still let this through:
      // SubmissionNotAcceptedError interpolates the status into its message, so
      // an unscoped existence read is a status oracle for submissions the caller
      // cannot otherwise see. It must fail as "not found", never as "not accepted".
      const promise = pipelineService.create(
        adminTx(),
        { submissionId: subBPending.id },
        orgA.id,
      );

      await expect(promise).rejects.toThrow(PipelineItemNotFoundError);
      await expect(promise).rejects.not.toThrow(SubmissionNotAcceptedError);
    });

    it("creates for a submission in the caller's own org", async () => {
      const row = await pipelineService.create(
        adminTx(),
        { submissionId: subACreate.id },
        orgA.id,
      );

      expect(row.organizationId).toBe(orgA.id);
      expect(row.submissionId).toBe(subACreate.id);
      expect(await countHistoryFor(row.id)).toBe(1);
    });

    it('surfaces a global-uniqueness collision as PipelineItemAlreadyExistsError', async () => {
      // `pipeline_items_submission_id_idx` is unique across ALL orgs, so the
      // org-scoped pre-check cannot pre-empt it. Seed the mismatched pair that
      // was creatable before the predicate above existed: org B owning an item
      // on org A's submission. Org A's create then passes the pre-check (which
      // sees nothing in org A) and collides at the insert.
      await createPipelineItem(orgB.id, subACreate.id);

      await expect(
        pipelineService.create(
          adminTx(),
          { submissionId: subACreate.id },
          orgA.id,
        ),
      ).rejects.toThrow(PipelineItemAlreadyExistsError);
    });
  });

  describe('updateStage', () => {
    // NOTE: two independent defences hold this — see the file header. Reverting
    // only `getById`'s predicate, or only the UPDATE's, leaves it green; revert
    // both to see it fail.
    it('refuses an item in another org and writes no history for it', async () => {
      await expect(
        pipelineService.updateStage(
          adminTx(),
          itemB.id,
          { stage: 'COPYEDIT_IN_PROGRESS' },
          orgA.id,
        ),
      ).rejects.toThrow(PipelineItemNotFoundError);

      const stored = await readItem(itemB.id);
      expect(stored?.stage).toBe('COPYEDIT_PENDING');
      expect(await countHistoryFor(itemB.id)).toBe(0);
    });

    it("transitions an item in the caller's own org", async () => {
      const updated = await pipelineService.updateStage(
        adminTx(),
        itemA.id,
        { stage: 'COPYEDIT_IN_PROGRESS' },
        orgA.id,
      );

      expect(updated.stage).toBe('COPYEDIT_IN_PROGRESS');
      expect(await countHistoryFor(itemA.id)).toBe(1);
    });
  });

  describe('addComment', () => {
    it('refuses to comment on an item in another org', async () => {
      await expect(
        pipelineService.addComment(
          adminTx(),
          itemB.id,
          { content: 'cross-tenant' },
          user.id,
          'COPYEDIT_PENDING',
          orgA.id,
        ),
      ).rejects.toThrow(PipelineItemNotFoundError);

      const comments = await pipelineService.listComments(
        adminTx(),
        itemB.id,
        orgB.id,
      );
      expect(comments).toHaveLength(0);
    });

    it("comments on an item in the caller's own org", async () => {
      const comment = await pipelineService.addComment(
        adminTx(),
        itemA.id,
        { content: 'looks good' },
        user.id,
        'COPYEDIT_PENDING',
        orgA.id,
      );

      expect(comment.pipelineItemId).toBe(itemA.id);
    });
  });

  describe('list', () => {
    it("returns only the caller's own items", async () => {
      const result = await pipelineService.list(
        adminTx(),
        { page: 1, limit: 20 },
        orgA.id,
      );

      expect(result.items.map((i) => i.id)).toEqual([itemA.id]);
      expect(result.total).toBe(1);
    });

    // Deliberately NOT a proof of the search subquery's org predicate, and
    // measured to be sure: reverting that predicate leaves this green. The outer
    // `inArray` intersects the subquery against an already org-scoped set, so
    // results were correct either way and no input can distinguish them. The
    // predicate narrows what the subquery scans, which is a performance property
    // this suite has no way to assert. Kept as a result-correctness regression
    // guard on the search path — nothing more.
    it("does not match another org's submission title through search", async () => {
      const result = await pipelineService.list(
        adminTx(),
        { page: 1, limit: 20, search: subB.title ?? undefined },
        orgA.id,
      );

      expect(result.items).toHaveLength(0);
    });
  });
});
