import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { eq } from 'drizzle-orm';
import { globalSetup, getAdminPool } from './helpers/db-setup';
import { truncateAllTables } from './helpers/cleanup';
import { withTestRls } from './helpers/rls-context';
import {
  createOrganization,
  createUser,
  createOrgMember,
} from './helpers/factories';
import {
  contributors,
  contributorPublications,
  rightsAgreements,
  paymentTransactions,
  pipelineItems,
  publications,
  submissions,
  submissionPeriods,
  manuscripts,
  manuscriptVersions,
} from '@colophony/db';
import { drizzle } from 'drizzle-orm/node-postgres';

function adminDb(): any {
  return drizzle(getAdminPool());
}

let orgA: { id: string };
let orgB: { id: string };
let userA: { id: string };
let userB: { id: string };
let contributorA: { id: string };
let contributorB: { id: string };
let pipelineItemA: { id: string };

describe('RLS Business Operations Tables', () => {
  beforeAll(async () => {
    await globalSetup();
    await truncateAllTables();

    const db = adminDb();

    // Create two orgs and users
    orgA = await createOrganization({ name: 'Org A' });
    orgB = await createOrganization({ name: 'Org B' });
    userA = await createUser();
    userB = await createUser();
    await createOrgMember(orgA.id, userA.id);
    await createOrgMember(orgB.id, userB.id);

    // Create contributors in each org
    [contributorA] = await db
      .insert(contributors)
      .values({
        organizationId: orgA.id,
        displayName: 'Contributor A',
      })
      .returning();

    [contributorB] = await db
      .insert(contributors)
      .values({
        organizationId: orgB.id,
        displayName: 'Contributor B',
      })
      .returning();

    // Create pipeline item prereqs for contributor_publications
    const [pubA] = await db
      .insert(publications)
      .values({ organizationId: orgA.id, name: 'Pub A', slug: 'pub-a' })
      .returning();

    const [manuscript] = await db
      .insert(manuscripts)
      .values({ ownerId: userA.id, title: 'Test Manuscript' })
      .returning();

    const [version] = await db
      .insert(manuscriptVersions)
      .values({ manuscriptId: manuscript.id, versionNumber: 1 })
      .returning();

    const [period] = await db
      .insert(submissionPeriods)
      .values({
        organizationId: orgA.id,
        name: 'Period A',
        publicationId: pubA.id,
        opensAt: new Date('2026-01-01'),
        closesAt: new Date('2026-12-31'),
      })
      .returning();

    const [submission] = await db
      .insert(submissions)
      .values({
        organizationId: orgA.id,
        submitterId: userA.id,
        submissionPeriodId: period.id,
        manuscriptVersionId: version.id,
        title: 'Test Submission',
      })
      .returning();

    [pipelineItemA] = await db
      .insert(pipelineItems)
      .values({
        organizationId: orgA.id,
        submissionId: submission.id,
        publicationId: pubA.id,
      })
      .returning();

    // Create contributor_publications
    await db.insert(contributorPublications).values({
      contributorId: contributorA.id,
      pipelineItemId: pipelineItemA.id,
      role: 'author',
    });

    // Create rights_agreements in each org
    await db.insert(rightsAgreements).values({
      organizationId: orgA.id,
      contributorId: contributorA.id,
      rightsType: 'first_north_american_serial',
    });

    await db.insert(rightsAgreements).values({
      organizationId: orgB.id,
      contributorId: contributorB.id,
      rightsType: 'electronic',
    });

    // Create payment_transactions in each org
    await db.insert(paymentTransactions).values({
      organizationId: orgA.id,
      type: 'contributor_payment',
      direction: 'outbound',
      amount: 5000,
    });

    await db.insert(paymentTransactions).values({
      organizationId: orgB.id,
      type: 'submission_fee',
      direction: 'inbound',
      amount: 1500,
    });
  });

  afterAll(async () => {
    await truncateAllTables();
  });

  // -----------------------------------------------------------------------
  // contributors (direct org isolation)
  // -----------------------------------------------------------------------

  describe('contributors', () => {
    it('org A context sees only org A contributors', async () => {
      const rows = await withTestRls(
        { orgId: orgA.id, userId: userA.id },
        (tx) => tx.select().from(contributors),
      );
      expect(rows).toHaveLength(1);
      expect(rows[0].id).toBe(contributorA.id);
    });

    it('org B context sees only org B contributors', async () => {
      const rows = await withTestRls(
        { orgId: orgB.id, userId: userB.id },
        (tx) => tx.select().from(contributors),
      );
      expect(rows).toHaveLength(1);
      expect(rows[0].id).toBe(contributorB.id);
    });

    it('org A context cannot find org B contributor by ID', async () => {
      const rows = await withTestRls(
        { orgId: orgA.id, userId: userA.id },
        (tx) =>
          tx
            .select()
            .from(contributors)
            .where(eq(contributors.id, contributorB.id)),
      );
      expect(rows).toHaveLength(0);
    });
  });

  // -----------------------------------------------------------------------
  // contributor_publications (parent-based isolation)
  // -----------------------------------------------------------------------

  describe('contributor_publications', () => {
    it('org A context sees contributor publications', async () => {
      const rows = await withTestRls(
        { orgId: orgA.id, userId: userA.id },
        (tx) => tx.select().from(contributorPublications),
      );
      expect(rows).toHaveLength(1);
      expect(rows[0].contributorId).toBe(contributorA.id);
    });

    it('org B context sees no contributor publications (none seeded for org B)', async () => {
      const rows = await withTestRls(
        { orgId: orgB.id, userId: userB.id },
        (tx) => tx.select().from(contributorPublications),
      );
      expect(rows).toHaveLength(0);
    });
  });

  // -----------------------------------------------------------------------
  // rights_agreements (direct org isolation)
  // -----------------------------------------------------------------------

  describe('rights_agreements', () => {
    it('org A context sees only org A rights agreements', async () => {
      const rows = await withTestRls(
        { orgId: orgA.id, userId: userA.id },
        (tx) => tx.select().from(rightsAgreements),
      );
      expect(rows).toHaveLength(1);
      expect(rows[0].rightsType).toBe('first_north_american_serial');
    });

    it('org B context sees only org B rights agreements', async () => {
      const rows = await withTestRls(
        { orgId: orgB.id, userId: userB.id },
        (tx) => tx.select().from(rightsAgreements),
      );
      expect(rows).toHaveLength(1);
      expect(rows[0].rightsType).toBe('electronic');
    });
  });

  // -----------------------------------------------------------------------
  // payment_transactions (direct org isolation)
  // -----------------------------------------------------------------------

  describe('payment_transactions', () => {
    it('org A context sees only org A transactions', async () => {
      const rows = await withTestRls(
        { orgId: orgA.id, userId: userA.id },
        (tx) => tx.select().from(paymentTransactions),
      );
      expect(rows).toHaveLength(1);
      expect(rows[0].type).toBe('contributor_payment');
      expect(rows[0].amount).toBe(5000);
    });

    it('org B context sees only org B transactions', async () => {
      const rows = await withTestRls(
        { orgId: orgB.id, userId: userB.id },
        (tx) => tx.select().from(paymentTransactions),
      );
      expect(rows).toHaveLength(1);
      expect(rows[0].type).toBe('submission_fee');
      expect(rows[0].amount).toBe(1500);
    });
  });
});
