/**
 * Withdrawal cascade integration tests.
 *
 * Tests findSiblingSubmissions and withdrawCascadeAsOwner against a real
 * PostgreSQL instance. Verifies cross-org sibling lookup, guarded status
 * updates, outbox event emission, and ownership enforcement.
 *
 * The service uses `db` from @colophony/db for cross-org superuser queries.
 * In the test env, DATABASE_URL points to app_user (RLS-enforced), so we
 * mock @colophony/db to re-export the admin pool's drizzle instance as `db`.
 */
import { describe, it, expect, beforeAll, afterEach, vi } from 'vitest';
import { submissions, submissionHistory, outboxEvents } from '@colophony/db';
import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { globalSetup, getAdminPool } from '../rls/helpers/db-setup.js';
import { truncateAllTables } from '../rls/helpers/cleanup.js';
import {
  createOrganization,
  createUser,
  createOrgMember,
  createSubmission,
  createManuscript,
  createManuscriptVersion,
} from '../rls/helpers/factories.js';

// Patch `db` to use the admin (superuser) pool so cross-org queries work.
// The service's cross-org queries use the superuser `db` singleton, but the
// test env's DATABASE_URL points to app_user (RLS-enforced).
vi.mock('@colophony/db', async (importOriginal) => {
  const original = await importOriginal();
  const mod: Record<string, unknown> = { ...(original as object) };
  const pg = await import('pg');
  const orm = await import('drizzle-orm/node-postgres');
  const adminUrl =
    process.env.DATABASE_TEST_URL ??
    'postgresql://test:test@localhost:5433/colophony_test';
  const adminPool = new pg.Pool({ connectionString: adminUrl, max: 3 });
  mod.db = orm.drizzle(adminPool);
  return mod;
});

let submissionService: Awaited<
  typeof import('../../services/submission.service.js')
>['submissionService'];

function adminDb(): ReturnType<typeof drizzle> {
  return drizzle(getAdminPool()) as ReturnType<typeof drizzle>;
}

beforeAll(async () => {
  await globalSetup();
  const mod = await import('../../services/submission.service.js');
  submissionService = mod.submissionService;
});

afterEach(async () => {
  await truncateAllTables();
});

/**
 * Helper: create the standard multi-org scenario for cascade tests.
 *
 * One writer, two orgs, one manuscript with one version,
 * the same version submitted to both orgs.
 */
async function createCascadeScenario() {
  const writer = await createUser();
  const orgA = await createOrganization({ name: 'Magazine A' });
  const orgB = await createOrganization({ name: 'Magazine B' });
  await createOrgMember(orgA.id, writer.id, { roles: ['READER'] });
  await createOrgMember(orgB.id, writer.id, { roles: ['READER'] });

  const manuscript = await createManuscript(writer.id);
  const version = await createManuscriptVersion(manuscript.id);

  // Submission at org A — ACCEPTED
  const subA = await createSubmission(orgA.id, writer.id, {
    manuscriptVersionId: version.id,
    title: 'Shared Poem',
    status: 'ACCEPTED',
  });

  // Submission at org B — SUBMITTED (active, should be withdrawable)
  const subB = await createSubmission(orgB.id, writer.id, {
    manuscriptVersionId: version.id,
    title: 'Shared Poem',
    status: 'SUBMITTED',
  });

  return { writer, orgA, orgB, manuscript, version, subA, subB };
}

describe('findSiblingSubmissions', () => {
  it('finds active submissions for the same manuscript at other orgs', async () => {
    const { writer, subA, subB, orgB } = await createCascadeScenario();

    const siblings = await submissionService.findSiblingSubmissions(
      writer.id,
      subA.id,
    );

    expect(siblings).toHaveLength(1);
    expect(siblings[0].id).toBe(subB.id);
    expect(siblings[0].organizationName).toBe('Magazine B');
    expect(siblings[0].organizationId).toBe(orgB.id);
    expect(siblings[0].status).toBe('SUBMITTED');
  });

  it('excludes the queried submission from results', async () => {
    const { writer, subA } = await createCascadeScenario();

    const siblings = await submissionService.findSiblingSubmissions(
      writer.id,
      subA.id,
    );

    const ids = siblings.map((s) => s.id);
    expect(ids).not.toContain(subA.id);
  });

  it('excludes terminal-status submissions (WITHDRAWN, REJECTED)', async () => {
    const writer = await createUser();
    const orgA = await createOrganization();
    const orgB = await createOrganization();
    const orgC = await createOrganization();
    await createOrgMember(orgA.id, writer.id);
    await createOrgMember(orgB.id, writer.id);
    await createOrgMember(orgC.id, writer.id);

    const ms = await createManuscript(writer.id);
    const ver = await createManuscriptVersion(ms.id);

    const subA = await createSubmission(orgA.id, writer.id, {
      manuscriptVersionId: ver.id,
      status: 'ACCEPTED',
    });
    // WITHDRAWN — should NOT appear
    await createSubmission(orgB.id, writer.id, {
      manuscriptVersionId: ver.id,
      status: 'WITHDRAWN',
    });
    // REJECTED — should NOT appear
    await createSubmission(orgC.id, writer.id, {
      manuscriptVersionId: ver.id,
      status: 'REJECTED',
    });

    const siblings = await submissionService.findSiblingSubmissions(
      writer.id,
      subA.id,
    );

    expect(siblings).toHaveLength(0);
  });

  it('returns empty for a submission without a manuscript version', async () => {
    const writer = await createUser();
    const org = await createOrganization();
    await createOrgMember(org.id, writer.id);

    // Submission with no manuscriptVersionId
    const sub = await createSubmission(org.id, writer.id, {
      status: 'ACCEPTED',
    });

    const siblings = await submissionService.findSiblingSubmissions(
      writer.id,
      sub.id,
    );

    expect(siblings).toHaveLength(0);
  });

  it('returns empty when called by a non-owner', async () => {
    const { subA } = await createCascadeScenario();
    const otherUser = await createUser();

    const siblings = await submissionService.findSiblingSubmissions(
      otherUser.id,
      subA.id,
    );

    expect(siblings).toHaveLength(0);
  });

  it('finds siblings across different versions of the same manuscript', async () => {
    const writer = await createUser();
    const orgA = await createOrganization({ name: 'Mag A' });
    const orgB = await createOrganization({ name: 'Mag B' });
    await createOrgMember(orgA.id, writer.id);
    await createOrgMember(orgB.id, writer.id);

    const ms = await createManuscript(writer.id);
    const v1 = await createManuscriptVersion(ms.id, { versionNumber: 1 });
    const v2 = await createManuscriptVersion(ms.id, { versionNumber: 2 });

    // v1 submitted to org A (accepted)
    const subA = await createSubmission(orgA.id, writer.id, {
      manuscriptVersionId: v1.id,
      status: 'ACCEPTED',
    });
    // v2 submitted to org B (still active)
    await createSubmission(orgB.id, writer.id, {
      manuscriptVersionId: v2.id,
      status: 'UNDER_REVIEW',
    });

    const siblings = await submissionService.findSiblingSubmissions(
      writer.id,
      subA.id,
    );

    expect(siblings).toHaveLength(1);
    expect(siblings[0].status).toBe('UNDER_REVIEW');
  });
});

describe('withdrawCascadeAsOwner', () => {
  it('withdraws all active siblings and returns results', async () => {
    const { writer, subA, subB } = await createCascadeScenario();

    const result = await submissionService.withdrawCascadeAsOwner(
      writer.id,
      subA.id,
    );

    expect(result.withdrawn).toHaveLength(1);
    expect(result.withdrawn[0].submissionId).toBe(subB.id);
    expect(result.withdrawn[0].previousStatus).toBe('SUBMITTED');
    expect(result.withdrawn[0].organizationName).toBe('Magazine B');
  });

  it('updates submission status to WITHDRAWN in the database', async () => {
    const { writer, subA, subB } = await createCascadeScenario();

    await submissionService.withdrawCascadeAsOwner(writer.id, subA.id);

    const db = adminDb();
    const [updated] = await db
      .select({ status: submissions.status })
      .from(submissions)
      .where(eq(submissions.id, subB.id))
      .limit(1);

    expect(updated.status).toBe('WITHDRAWN');
  });

  it('creates submission history entries', async () => {
    const { writer, subA, subB } = await createCascadeScenario();

    await submissionService.withdrawCascadeAsOwner(writer.id, subA.id);

    const db = adminDb();
    const history = await db
      .select()
      .from(submissionHistory)
      .where(eq(submissionHistory.submissionId, subB.id));

    expect(history).toHaveLength(1);
    expect(history[0].fromStatus).toBe('SUBMITTED');
    expect(history[0].toStatus).toBe('WITHDRAWN');
    expect(history[0].changedBy).toBe(writer.id);
  });

  it('uses custom withdrawal note when provided', async () => {
    const { writer, subA, subB } = await createCascadeScenario();
    const note = 'Accepted at another venue — withdrawing with thanks.';

    await submissionService.withdrawCascadeAsOwner(writer.id, subA.id, note);

    const db = adminDb();
    const [entry] = await db
      .select({ comment: submissionHistory.comment })
      .from(submissionHistory)
      .where(eq(submissionHistory.submissionId, subB.id))
      .limit(1);

    expect(entry.comment).toBe(note);
  });

  it('enqueues outbox events for each withdrawn submission', async () => {
    const { writer, subA, subB, orgB } = await createCascadeScenario();

    await submissionService.withdrawCascadeAsOwner(writer.id, subA.id);

    const db = adminDb();
    const events = await db
      .select()
      .from(outboxEvents)
      .where(eq(outboxEvents.eventType, 'hopper/submission.withdrawn'));

    const matching = events.filter((e) => {
      const payload = e.payload as Record<string, unknown>;
      return payload.submissionId === subB.id;
    });

    expect(matching).toHaveLength(1);
    const payload = matching[0].payload as Record<string, unknown>;
    expect(payload.orgId).toBe(orgB.id);
    expect(payload.submitterId).toBe(writer.id);
  });

  it('skips siblings whose status changed concurrently', async () => {
    const { writer, subA, subB } = await createCascadeScenario();

    // Simulate concurrent editorial decision: mark subB as ACCEPTED
    const db = adminDb();
    await db
      .update(submissions)
      .set({ status: 'ACCEPTED' })
      .where(eq(submissions.id, subB.id));

    const result = await submissionService.withdrawCascadeAsOwner(
      writer.id,
      subA.id,
    );

    // Should skip since subB is no longer in an active status
    expect(result.withdrawn).toHaveLength(0);

    // Verify subB is still ACCEPTED (not overwritten)
    const [check] = await db
      .select({ status: submissions.status })
      .from(submissions)
      .where(eq(submissions.id, subB.id))
      .limit(1);

    expect(check.status).toBe('ACCEPTED');
  });

  it('returns empty when no active siblings exist', async () => {
    const writer = await createUser();
    const org = await createOrganization();
    await createOrgMember(org.id, writer.id);

    const sub = await createSubmission(org.id, writer.id, {
      status: 'ACCEPTED',
    });

    const result = await submissionService.withdrawCascadeAsOwner(
      writer.id,
      sub.id,
    );

    expect(result.withdrawn).toHaveLength(0);
  });

  it('handles multiple siblings across three orgs', async () => {
    const writer = await createUser();
    const orgA = await createOrganization({ name: 'Org A' });
    const orgB = await createOrganization({ name: 'Org B' });
    const orgC = await createOrganization({ name: 'Org C' });
    await createOrgMember(orgA.id, writer.id);
    await createOrgMember(orgB.id, writer.id);
    await createOrgMember(orgC.id, writer.id);

    const ms = await createManuscript(writer.id);
    const ver = await createManuscriptVersion(ms.id);

    const subA = await createSubmission(orgA.id, writer.id, {
      manuscriptVersionId: ver.id,
      status: 'ACCEPTED',
    });
    await createSubmission(orgB.id, writer.id, {
      manuscriptVersionId: ver.id,
      status: 'SUBMITTED',
    });
    await createSubmission(orgC.id, writer.id, {
      manuscriptVersionId: ver.id,
      status: 'UNDER_REVIEW',
    });

    const result = await submissionService.withdrawCascadeAsOwner(
      writer.id,
      subA.id,
    );

    expect(result.withdrawn).toHaveLength(2);
    const orgNames = result.withdrawn.map((w) => w.organizationName).sort();
    expect(orgNames).toEqual(['Org B', 'Org C']);
  });
});
