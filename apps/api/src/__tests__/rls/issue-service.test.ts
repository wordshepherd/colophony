/**
 * Defense-in-depth: issueService's explicit organization predicates.
 *
 * The same shape as `pipeline-service.test.ts`, `api-key-service.test.ts`,
 * `notification-service.test.ts` and `audit-service.test.ts`, and for the same
 * reason. Every query below runs over the ADMIN pool, which connects as a role
 * with `rolsuper`/`rolbypassrls`, so RLS does not apply. The only thing
 * separating org A's issues from org B's here is the `WHERE organization_id =
 * $orgId` in the service. Do not "fix" this by switching to the app pool — that
 * reinstates RLS and the suite would pass with or without the predicates,
 * testing nothing. (`issue-date-filter.test.ts` deliberately does the opposite:
 * it runs over the app pool because it is testing date filtering, not scoping.)
 *
 * Every method here took `orgId?: string` before 2026-07-31. An optional org id
 * is a silent bypass: omit it and the predicate is skipped, with nothing at the
 * type level to flag it. Twelve methods, of which seven were *guard-only* — the
 * org check was an `if (orgId)` block and the underlying query carried no org
 * term at all.
 *
 * TWO CLASSES OF DEFENCE, AND THEY ARE NOT INTERCHANGEABLE.
 *
 * `list`, `getById`, `update`, `updateStatus` and `saveCmsPublishResult` carry
 * the predicate on the statement itself — `issues` has an `organization_id`
 * column to filter on.
 *
 * `getItems`, `getSections`, `addItem`, `reorderItems`, `addSection`,
 * `removeItem` and `removeSection` cannot: `issue_items` and `issue_sections`
 * have no `organization_id`, and their RLS policies scope transitively with
 * `EXISTS (SELECT 1 FROM issues WHERE issues.id = issue_id AND
 * issues.organization_id = current_org_id())`. Their service-layer defence is
 * the org-scoped `getById` guard. Duplicating that EXISTS in each statement
 * would be a second copy of the policy to keep true, so it is deliberately not
 * done — with one exception: `removeItem` and `removeSection` additionally
 * resolve the row through an org-scoped join before deleting, because a DELETE
 * that fires on an unverified row is the case where a dropped guard is
 * unrecoverable rather than merely wrong.
 *
 * MEASURED, by reverting each defence in turn — do not re-derive this by
 * reading, and do not read a green run as proof of more than it shows:
 *
 *   - Revert the five `issues`-table predicates → **9 of 14 fail**. That covers
 *     every guard-only method too, since the guard is `getById`.
 *   - Revert only `addItem`'s pipeline-item org check → **exactly 1 fails**, the
 *     `foreign pipeline item` case. Nothing else notices, which is the point:
 *     that hole is invisible to every other assertion here.
 *   - Revert only the `removeItem` / `removeSection` scoped joins → **0 fail**.
 *
 * That last number is the one to be honest about. `removeItem` and
 * `removeSection` are defended twice — the `getById` guard and the scoped join —
 * and **either alone is sufficient**, exactly as with `pipelineService.updateStage`.
 * So these two cases passing does not demonstrate the joins work; the guard
 * above them would carry the case on its own. The joins are there for the
 * refactor that drops the guard, and their value is that a DELETE can then no
 * longer fire on an unverified row. If you remove them, this suite will not tell
 * you.
 *
 * The five guard-only methods (`getItems`, `getSections`, `addItem`,
 * `reorderItems`, `addSection`) are pinned once. A change that drops a guard
 * fails here — but their child-table statements are not independently scoped,
 * and nothing in this file claims otherwise.
 *
 * ON `addItem`, WHICH IS NOT JUST A SCOPING FIX. Its guard checked the *issue*
 * and never the `pipelineItemId` it was handed, so org A could attach org B's
 * pipeline item to an A-owned issue — a row that is valid under RLS, since
 * `issue_items` scopes only through its parent. `getItems` then joins that item
 * through `pipeline_items` to `submissions` and returns `submissionTitle`,
 * handing B's submission title to A. Same shape as `pipelineService.create`'s
 * unscoped submission read (#537): a scoped parent and an unscoped foreign key.
 * The `foreign pipeline item` case below is the one that pins it, and it is the
 * only case here that fails on `main` for a reason other than a missing `orgId`.
 */
import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import { drizzle } from 'drizzle-orm/node-postgres';
import { eq } from 'drizzle-orm';
import {
  issues,
  issueItems,
  issueSections,
  pipelineItems,
  type Organization,
  type User,
  type Submission,
  type Publication,
  type Issue,
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
  createPublication,
  createIssue,
  createIssueSection,
  createIssueItem,
} from './helpers/factories';
import {
  issueService,
  IssueNotFoundError,
  IssueItemAlreadyExistsError,
} from '../../services/issue.service.js';

type ServiceTx = Parameters<typeof issueService.getById>[0];

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

/** Read an issue back over the admin pool, bypassing the service. */
async function readIssue(id: string) {
  const [row] = await adminDb()
    .select()
    .from(issues)
    .where(eq(issues.id, id))
    .limit(1);
  return row ?? null;
}

async function readItem(id: string) {
  const [row] = await adminDb()
    .select()
    .from(issueItems)
    .where(eq(issueItems.id, id))
    .limit(1);
  return row ?? null;
}

async function readSection(id: string) {
  const [row] = await adminDb()
    .select()
    .from(issueSections)
    .where(eq(issueSections.id, id))
    .limit(1);
  return row ?? null;
}

async function countItemsFor(issueId: string) {
  const rows = await adminDb()
    .select()
    .from(issueItems)
    .where(eq(issueItems.issueId, issueId));
  return rows.length;
}

const LIST_INPUT = { page: 1, limit: 100 } as Parameters<
  typeof issueService.list
>[1];

describe('issueService defense-in-depth (RLS bypassed)', () => {
  let orgA: Organization;
  let orgB: Organization;
  let user: User;
  let pubA: Publication;
  let pubB: Publication;
  // One submission per intended pipeline item: the unique index on
  // submission_id is global, so a submission can back at most one item ever.
  let subA: Submission;
  let subB: Submission;
  let subASpare: Submission;

  beforeAll(async () => {
    await globalSetup();
    await truncateAllTables();

    orgA = await createOrganization({ name: 'Org Alpha' });
    orgB = await createOrganization({ name: 'Org Beta' });
    user = await createUser();
    await createOrgMember(orgA.id, user.id, { roles: ['ADMIN'] });
    await createOrgMember(orgB.id, user.id, { roles: ['ADMIN'] });

    pubA = await createPublication(orgA.id);
    pubB = await createPublication(orgB.id);

    const periodA = await createSubmissionPeriod(orgA.id);
    const periodB = await createSubmissionPeriod(orgB.id);

    [subA, subB, subASpare] = await Promise.all([
      createSubmission(orgA.id, user.id, { submissionPeriodId: periodA.id }),
      createSubmission(orgB.id, user.id, { submissionPeriodId: periodB.id }),
      createSubmission(orgA.id, user.id, { submissionPeriodId: periodA.id }),
    ]);
  });

  // Fresh issues per test. Deleting the parent cascades to issue_items and
  // issue_sections, so counts cannot drift as cases are reordered.
  let issueA: Issue;
  let issueB: Issue;
  let itemB: PipelineItem;

  beforeEach(async () => {
    await adminDb().delete(issues);
    // Deleting issues cascades to issue_items and issue_sections but not to
    // pipeline_items, and `pipeline_items_submission_id_idx` is global — so
    // without this a second case reusing a submission collides.
    await adminDb().delete(pipelineItems);
    issueA = await createIssue(orgA.id, pubA.id, { title: 'Alpha Issue' });
    issueB = await createIssue(orgB.id, pubB.id, { title: 'Beta Issue' });
    itemB = await createPipelineItem(orgB.id, subB.id);
  });

  afterAll(async () => {
    await truncateAllTables();
  });

  describe('list', () => {
    it("excludes another org's issues from both items and total", async () => {
      const result = await issueService.list(adminTx(), LIST_INPUT, orgA.id);

      expect(result.items.map((i) => i.id)).toEqual([issueA.id]);
      expect(result.items.map((i) => i.id)).not.toContain(issueB.id);
      // The count query shares the predicate — filtering only the page would
      // leave `total` reporting every org's issue count.
      expect(result.total).toBe(1);
    });
  });

  describe('getById', () => {
    it('returns null for an issue in another org', async () => {
      const result = await issueService.getById(adminTx(), issueB.id, orgA.id);
      expect(result).toBeNull();
    });
  });

  describe('getItems / getSections', () => {
    it("returns [] for another org's issue", async () => {
      const pipelineItemA = await createPipelineItem(orgA.id, subA.id);
      await createIssueItem(issueB.id, itemB.id);
      await createIssueSection(issueB.id);

      expect(
        await issueService.getItems(adminTx(), issueB.id, orgA.id),
      ).toEqual([]);
      expect(
        await issueService.getSections(adminTx(), issueB.id, orgA.id),
      ).toEqual([]);

      // Sanity: the same calls against A's own issue do return rows, so the
      // empty results above are the guard and not an empty fixture.
      await createIssueItem(issueA.id, pipelineItemA.id);
      expect(
        await issueService.getItems(adminTx(), issueA.id, orgA.id),
      ).toHaveLength(1);
    });
  });

  describe('update', () => {
    it("returns null for another org's issue and leaves it untouched", async () => {
      const result = await issueService.update(
        adminTx(),
        issueB.id,
        { title: 'Hijacked' },
        orgA.id,
      );

      expect(result).toBeNull();
      const row = await readIssue(issueB.id);
      expect(row?.title).toBe('Beta Issue');
    });
  });

  describe('updateStatus', () => {
    it("returns null for another org's issue and leaves its status untouched", async () => {
      const before = await readIssue(issueB.id);

      const result = await issueService.updateStatus(
        adminTx(),
        issueB.id,
        'PUBLISHED',
        orgA.id,
      );

      expect(result).toBeNull();
      const row = await readIssue(issueB.id);
      expect(row?.status).toBe(before?.status);
      expect(row?.publishedAt).toBeNull();
    });
  });

  describe('saveCmsPublishResult', () => {
    it("returns null for another org's issue and leaves its metadata untouched", async () => {
      const result = await issueService.saveCmsPublishResult(
        adminTx(),
        issueB.id,
        'conn-1',
        { externalId: 'ext-1', adapterType: 'GHOST' },
        orgA.id,
      );

      expect(result).toBeNull();
      const row = await readIssue(issueB.id);
      expect(row?.metadata ?? {}).toEqual({});
    });
  });

  describe('addItem', () => {
    it("throws for another org's issue and writes no row", async () => {
      const pipelineItemA = await createPipelineItem(orgA.id, subA.id);

      await expect(
        issueService.addItem(
          adminTx(),
          issueB.id,
          { pipelineItemId: pipelineItemA.id },
          orgA.id,
        ),
      ).rejects.toThrow(IssueNotFoundError);

      expect(await countItemsFor(issueB.id)).toBe(0);
    });

    /**
     * The §0 case. A's own issue, so the guard passes — what must reject is the
     * foreign `pipelineItemId`. Without the org-scoped pipeline-item lookup this
     * inserts successfully and `getItems` hands back B's submission title.
     */
    it("rejects another org's pipeline item on the caller's own issue", async () => {
      await expect(
        issueService.addItem(
          adminTx(),
          issueA.id,
          { pipelineItemId: itemB.id },
          orgA.id,
        ),
      ).rejects.toThrow(IssueNotFoundError);

      expect(await countItemsFor(issueA.id)).toBe(0);

      // The read-back path that made this exploitable: nothing of B's is
      // reachable through A's issue.
      const items = await issueService.getItems(adminTx(), issueA.id, orgA.id);
      expect(items).toEqual([]);
    });

    it("accepts the caller's own pipeline item", async () => {
      const pipelineItemA = await createPipelineItem(orgA.id, subA.id);

      const row = await issueService.addItem(
        adminTx(),
        issueA.id,
        { pipelineItemId: pipelineItemA.id },
        orgA.id,
      );

      expect(row.issueId).toBe(issueA.id);
      expect(await countItemsFor(issueA.id)).toBe(1);
    });
  });

  describe('addSection', () => {
    it("throws for another org's issue and writes no row", async () => {
      await expect(
        issueService.addSection(
          adminTx(),
          issueB.id,
          { title: 'Injected' },
          orgA.id,
        ),
      ).rejects.toThrow(IssueNotFoundError);

      const rows = await adminDb()
        .select()
        .from(issueSections)
        .where(eq(issueSections.issueId, issueB.id));
      expect(rows).toHaveLength(0);
    });
  });

  describe('removeItem', () => {
    it("returns null for another org's item and leaves it present", async () => {
      const target = await createIssueItem(issueB.id, itemB.id);

      const result = await issueService.removeItem(
        adminTx(),
        issueB.id,
        target.id,
        orgA.id,
      );

      expect(result).toBeNull();
      expect(await readItem(target.id)).not.toBeNull();
    });
  });

  describe('removeSection', () => {
    it("returns null for another org's section and leaves it present", async () => {
      const target = await createIssueSection(issueB.id);

      const result = await issueService.removeSection(
        adminTx(),
        issueB.id,
        target.id,
        orgA.id,
      );

      expect(result).toBeNull();
      expect(await readSection(target.id)).not.toBeNull();
    });
  });

  describe('reorderItems', () => {
    it("returns [] for another org's issue and leaves sort order untouched", async () => {
      const target = await createIssueItem(issueB.id, itemB.id, {
        sortOrder: 0,
      });

      const result = await issueService.reorderItems(
        adminTx(),
        issueB.id,
        { items: [{ id: target.id, sortOrder: 99 }] },
        orgA.id,
      );

      expect(result).toEqual([]);
      const row = await readItem(target.id);
      expect(row?.sortOrder).toBe(0);
    });
  });

  /**
   * Not a scoping case. `addItemWithAudit`'s catch checked `e.code` directly,
   * which never matches: Drizzle wraps the pg error and the SQLSTATE lives on
   * `.cause`, so every duplicate add rethrew as a 500 (and, because
   * `rest/error-mapper.ts` does the same direct check while tRPC's recurses,
   * the two surfaces disagreed about the status code). No unit spec can catch
   * this — a mocked `tx` never produces a real driver error — which is why it
   * is pinned here.
   */
  describe('addItemWithAudit duplicate handling', () => {
    it('maps a 23505 to IssueItemAlreadyExistsError rather than rethrowing', async () => {
      const pipelineItemA = await createPipelineItem(orgA.id, subASpare.id);
      const ctx = {
        tx: adminTx(),
        actor: { orgId: orgA.id, userId: user.id, roles: ['ADMIN'] },
        audit: async () => {},
      } as unknown as Parameters<typeof issueService.addItemWithAudit>[0];

      await issueService.addItemWithAudit(ctx, issueA.id, {
        pipelineItemId: pipelineItemA.id,
      });

      await expect(
        issueService.addItemWithAudit(ctx, issueA.id, {
          pipelineItemId: pipelineItemA.id,
        }),
      ).rejects.toThrow(IssueItemAlreadyExistsError);
    });
  });
});
