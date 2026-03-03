/**
 * Defense-in-depth security invariant tests.
 *
 * Verifies that RLS correctly isolates tenant data — even without explicit
 * organizationId WHERE clauses, the RLS policies should prevent cross-org
 * data leakage. These are integration tests against a real PostgreSQL
 * instance with RLS policies enabled.
 */
import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import { submissions, submissionPeriods } from '@colophony/db';
import { globalSetup } from '../rls/helpers/db-setup.js';
import { truncateAllTables } from '../rls/helpers/cleanup.js';
import { withTestRls } from '../rls/helpers/rls-context.js';
import {
  createOrganization,
  createUser,
  createOrgMember,
  createSubmissionPeriod,
  createSubmission,
} from '../rls/helpers/factories.js';

beforeAll(async () => {
  await globalSetup();
});

afterEach(async () => {
  await truncateAllTables();
});

describe('defense-in-depth — RLS tenant isolation', () => {
  it('submission SELECT returns only org A rows when RLS context is org A', async () => {
    const orgA = await createOrganization();
    const orgB = await createOrganization();
    const userA = await createUser();
    const userB = await createUser();
    await createOrgMember(orgA.id, userA.id);
    await createOrgMember(orgB.id, userB.id);

    await createSubmission(orgA.id, userA.id, { title: 'Org A submission' });
    await createSubmission(orgB.id, userB.id, { title: 'Org B submission' });

    // Query as org A — should only see org A's submission
    const orgARows = await withTestRls({ orgId: orgA.id }, async (tx) => {
      return tx.select().from(submissions);
    });

    expect(orgARows).toHaveLength(1);
    expect(orgARows[0].title).toBe('Org A submission');
    expect(orgARows[0].organizationId).toBe(orgA.id);
  });

  it('submission SELECT with no org context returns zero rows', async () => {
    const org = await createOrganization();
    const user = await createUser();
    await createOrgMember(org.id, user.id);
    await createSubmission(org.id, user.id);

    // Query with no org context — RLS should block all rows
    const rows = await withTestRls({}, async (tx) => {
      return tx.select().from(submissions);
    });

    expect(rows).toHaveLength(0);
  });

  it('cross-org submission query returns zero rows for wrong org context', async () => {
    const orgA = await createOrganization();
    const orgB = await createOrganization();
    const userA = await createUser();
    await createOrgMember(orgA.id, userA.id);

    await createSubmission(orgA.id, userA.id, {
      title: 'Should be invisible to org B',
    });

    // Query as org B — org A's submission should not be visible
    const rows = await withTestRls({ orgId: orgB.id }, async (tx) => {
      return tx.select().from(submissions);
    });

    expect(rows).toHaveLength(0);
  });

  it('submission period isolation — org B cannot see org A periods', async () => {
    const orgA = await createOrganization();
    const orgB = await createOrganization();
    await createSubmissionPeriod(orgA.id, { name: 'Spring Reading' });
    await createSubmissionPeriod(orgB.id, { name: 'Fall Reading' });

    const orgAPeriods = await withTestRls({ orgId: orgA.id }, async (tx) => {
      return tx.select().from(submissionPeriods);
    });

    expect(orgAPeriods).toHaveLength(1);
    expect(orgAPeriods[0].name).toBe('Spring Reading');
  });

  it('listBySubmitter-style query — RLS filters even when querying by submitter across orgs', async () => {
    const orgA = await createOrganization();
    const orgB = await createOrganization();
    // Same user is member of both orgs
    const user = await createUser();
    await createOrgMember(orgA.id, user.id);
    await createOrgMember(orgB.id, user.id);

    await createSubmission(orgA.id, user.id, { title: 'Org A sub' });
    await createSubmission(orgB.id, user.id, { title: 'Org B sub' });

    // Query as org A for this user's submissions — should only see org A's
    const { eq } = await import('@colophony/db');
    const rows = await withTestRls({ orgId: orgA.id }, async (tx) => {
      return tx
        .select()
        .from(submissions)
        .where(eq(submissions.submitterId, user.id));
    });

    expect(rows).toHaveLength(1);
    expect(rows[0].title).toBe('Org A sub');
  });

  it('INSERT with wrong org context is blocked by RLS', async () => {
    const orgA = await createOrganization();
    const orgB = await createOrganization();
    const user = await createUser();
    await createOrgMember(orgA.id, user.id);

    // Try inserting into org A while RLS context is org B
    await expect(
      withTestRls({ orgId: orgB.id }, async (tx) => {
        await tx.insert(submissions).values({
          organizationId: orgA.id,
          submitterId: user.id,
          title: 'Should fail',
          content: 'Malicious cross-org insert',
          status: 'DRAFT',
        });
      }),
    ).rejects.toThrow();
  });
});
