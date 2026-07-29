/**
 * Transitive tenant isolation — the service methods that carry NO explicit
 * organization predicate.
 *
 * WHAT THIS PROVES: that RLS, on its own, isolates each of these paths today.
 *
 * WHAT THIS DOES NOT PROVE: that these methods satisfy the house defense-in-depth
 * rule for tenant queries — always include an explicit `WHERE organization_id =
 * orgId`, never rely solely on RLS. Most do not. They are on the fix list in
 * `docs/tenant-isolation-audit.md` precisely because the database is the only
 * thing separating tenants in them. A green run here means the backstop is intact
 * — it is not permission to leave the predicate out.
 *
 * ONE EXCEPTION: `organizationService.listMembers` now carries an explicit
 * predicate on both its queries, and is deliberately kept here anyway. Scoping it
 * did not make the policy behind it less worth pinning — a regression in
 * `organization_members`' RLS would otherwise be invisible, since the predicate
 * would mask it. The predicate's own coverage lives in
 * `__tests__/rls/organization-service.test.ts`, over the RLS-bypassing admin pool.
 * Adding a predicate to any other method below should follow the same pattern:
 * keep the case here, add an admin-pool mirror there.
 *
 * Every query therefore runs over the APP pool via `withTestRls`, which connects
 * as `app_user` (`NOSUPERUSER`, `NOBYPASSRLS`) and sets `app.current_org` /
 * `app.user_id` with `set_config(..., true)`. This is the deliberate opposite of
 * `__tests__/rls/api-key-service.test.ts`, which drives the admin pool so that an
 * explicit predicate is the only thing under test. Two directions, two files:
 * that one isolates the `WHERE` clause, this one isolates the policy.
 *
 * Each test seeds BOTH orgs and asserts a non-zero org A count before asserting
 * zero org B rows. Without that guard "no org B rows" is trivially true of an
 * empty table, and four of these methods read tables `createTwoOrgScenario` does
 * not populate.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { globalSetup } from '../rls/helpers/db-setup.js';
import { truncateAllTables } from '../rls/helpers/cleanup.js';
import { withTestRls } from '../rls/helpers/rls-context.js';
import {
  createOrganization,
  createUser,
  createOrgMember,
  createSubmissionPeriod,
  createSubmission,
  createSubmissionDiscussion,
  createSubmissionVote,
  createSubmissionReviewer,
} from '../rls/helpers/factories.js';
import { organizationService } from '../../services/organization.service.js';
import { submissionService } from '../../services/submission.service.js';
import { submissionDiscussionService } from '../../services/submission-discussion.service.js';
import { submissionVoteService } from '../../services/submission-vote.service.js';
import { submissionReviewerService } from '../../services/submission-reviewer.service.js';
import { portfolioService } from '../../services/portfolio.service.js';

// `withTestRls` hands back a `DrizzleDb` that already matches
// `organizationService.listMembers`, so that call needs no cast. The others take
// a schema-typed handle from a different peer-dep resolution of drizzle — same
// runtime object, divergent types — hence `tx as never` at those sites only.
const PAGINATION = { page: 1, limit: 50 };
const LIST_INPUT = { ...PAGINATION };
const EXPORT_INPUT = { ...PAGINATION, format: 'json' as const };
const ADMIN_ROLES = ['ADMIN'] as const;

/** Old enough that `listAgingByOrg(tx, 7)` will match it. */
const LONG_AGO = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);

interface Fixture {
  orgId: string;
  userId: string;
  submissionId: string;
  title: string;
}

async function seedOrg(label: string): Promise<Fixture> {
  const org = await createOrganization({ name: `${label} Org` });
  const user = await createUser();
  await createOrgMember(org.id, user.id, { roles: ['ADMIN'] });
  const period = await createSubmissionPeriod(org.id);

  const title = `${label} manuscript`;
  const submission = await createSubmission(org.id, user.id, {
    submissionPeriodId: period.id,
    title,
    // Not DRAFT/ACCEPTED/REJECTED/WITHDRAWN, and submitted long ago, so the
    // aging digest picks it up.
    status: 'UNDER_REVIEW',
    submittedAt: LONG_AGO,
  });

  await createSubmissionDiscussion(org.id, submission.id, user.id, {
    content: `${label} discussion`,
  });
  await createSubmissionVote(org.id, submission.id, user.id, {
    decision: 'ACCEPT',
  });
  await createSubmissionReviewer(org.id, submission.id, user.id);

  return {
    orgId: org.id,
    userId: user.id,
    submissionId: submission.id,
    title,
  };
}

describe('transitive tenant isolation (RLS is the only defense)', () => {
  let a: Fixture;
  let b: Fixture;

  beforeAll(async () => {
    await globalSetup();
    await truncateAllTables();
    a = await seedOrg('Alpha');
    b = await seedOrg('Beta');
  });

  afterAll(async () => {
    await truncateAllTables();
  });

  // organization_members_org_isolation
  it('organizationService.listMembers returns only the current org, in items and total', async () => {
    const result = await withTestRls(
      { orgId: a.orgId, userId: a.userId },
      (tx) => organizationService.listMembers(tx, PAGINATION, a.orgId),
    );

    expect(result.items.length).toBeGreaterThan(0);
    expect(result.items.map((m) => m.userId)).toEqual([a.userId]);
    expect(result.items.map((m) => m.userId)).not.toContain(b.userId);
    // Both queries now carry the predicate, so this pins the policy *behind* it
    // rather than instead of it. The predicate's own coverage is in
    // `__tests__/rls/organization-service.test.ts`, over the admin pool.
    expect(result.total).toBe(1);
  });

  // submissions_org_isolation
  it('submissionService.listAll returns only the current org, in items and total', async () => {
    const result = await withTestRls(
      { orgId: a.orgId, userId: a.userId },
      (tx) => submissionService.listAll(tx as never, LIST_INPUT, ADMIN_ROLES),
    );

    expect(result.items.length).toBeGreaterThan(0);
    expect(result.items.map((s) => s.id)).toEqual([a.submissionId]);
    expect(result.items.map((s) => s.id)).not.toContain(b.submissionId);
    expect(result.total).toBe(1);
  });

  // submissions_org_isolation
  it('submissionService.exportAll returns only the current org', async () => {
    const rows = await withTestRls({ orgId: a.orgId, userId: a.userId }, (tx) =>
      submissionService.exportAll(tx as never, EXPORT_INPUT, ADMIN_ROLES),
    );

    const ids = (rows as Array<{ id: string }>).map((r) => r.id);
    expect(ids.length).toBeGreaterThan(0);
    expect(ids).toEqual([a.submissionId]);
    expect(ids).not.toContain(b.submissionId);
  });

  // submissions_org_isolation — note the method is named ByOrg but takes no orgId
  it('submissionService.listAgingByOrg returns only the current org', async () => {
    const result = await withTestRls(
      { orgId: a.orgId, userId: a.userId },
      (tx) => submissionService.listAgingByOrg(tx as never, 7),
    );

    expect(result.submissions.length).toBeGreaterThan(0);
    expect(result.submissions.map((s) => s.id)).toEqual([a.submissionId]);
    expect(result.totalCount).toBe(1);
  });

  // submission_discussions_org_isolation
  it('submissionDiscussionService.listBySubmission cannot read another org submission', async () => {
    const own = await withTestRls({ orgId: a.orgId, userId: a.userId }, (tx) =>
      submissionDiscussionService.listBySubmission(tx as never, a.submissionId),
    );
    expect(own.length).toBeGreaterThan(0);

    // Org A context, org B's submission id — the policy, not the argument, is
    // what must return nothing.
    const foreign = await withTestRls(
      { orgId: a.orgId, userId: a.userId },
      (tx) =>
        submissionDiscussionService.listBySubmission(
          tx as never,
          b.submissionId,
        ),
    );
    expect(foreign).toHaveLength(0);
  });

  // submission_votes_org_isolation
  it('submissionVoteService.listBySubmission cannot read another org submission', async () => {
    const own = await withTestRls({ orgId: a.orgId, userId: a.userId }, (tx) =>
      submissionVoteService.listBySubmission(tx as never, a.submissionId),
    );
    expect(own.length).toBeGreaterThan(0);

    const foreign = await withTestRls(
      { orgId: a.orgId, userId: a.userId },
      (tx) =>
        submissionVoteService.listBySubmission(tx as never, b.submissionId),
    );
    expect(foreign).toHaveLength(0);
  });

  // submission_reviewers_org_isolation (+ organization_members join)
  it('submissionReviewerService.listBySubmission cannot read another org submission', async () => {
    const own = await withTestRls({ orgId: a.orgId, userId: a.userId }, (tx) =>
      submissionReviewerService.listBySubmission(tx as never, a.submissionId),
    );
    expect(own.length).toBeGreaterThan(0);

    const foreign = await withTestRls(
      { orgId: a.orgId, userId: a.userId },
      (tx) =>
        submissionReviewerService.listBySubmission(tx as never, b.submissionId),
    );
    expect(foreign).toHaveLength(0);
  });

  /**
   * submissions_org_isolation, reached through a raw-SQL join.
   *
   * Despite the name, `portfolioService.list` never queries `portfolio_entries`
   * — it reads `submissions` and `external_submissions`, and `LEFT JOIN`s
   * `organizations` at `:95` purely to surface journal names (which are also a
   * search target at `:65`). So what is under test here is that join: the only
   * predicate on the native half is `s.submitter_id = userId` (`:52`), and the
   * org name of a submission belonging to another tenant must not appear.
   *
   * Classified USER-SCOPED for that reason — an explicit predicate, just not an
   * org one. This does NOT cover `portfolio_entries_user_owner`; no service
   * method in this suite reads that table.
   */
  it('portfolioService.list is user-scoped and leaks no other org journal name', async () => {
    const result = await withTestRls({ userId: a.userId }, (tx) =>
      portfolioService.list(tx as never, a.userId, LIST_INPUT),
    );

    expect(result.items.length).toBeGreaterThan(0);
    const serialized = JSON.stringify(result.items);
    expect(serialized).toContain('Alpha');
    expect(serialized).not.toContain('Beta');
  });
});
