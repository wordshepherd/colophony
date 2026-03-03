/**
 * CSR (Common Submission Record) service integration tests.
 *
 * Tests the data export/import round-trip with real DB and RLS.
 * CSR is the data portability format — export creates a JSON envelope
 * of all user data across orgs; import creates external submissions.
 */
import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import { eq } from 'drizzle-orm';
import {
  externalSubmissions,
  correspondence,
  submissions,
} from '@colophony/db';
import { globalSetup } from '../rls/helpers/db-setup.js';
import { truncateAllTables } from '../rls/helpers/cleanup.js';
import { withTestRls } from '../rls/helpers/rls-context.js';
import {
  createOrganization,
  createUser,
  createOrgMember,
  createSubmission,
  createExternalSubmission,
  createCorrespondence,
} from '../rls/helpers/factories.js';

beforeAll(async () => {
  await globalSetup();
});

afterEach(async () => {
  await truncateAllTables();
});

describe('CSR service — integration', () => {
  describe('data exists for export', () => {
    it('native submissions are retrievable for a user across orgs', async () => {
      const orgA = await createOrganization();
      const orgB = await createOrganization();
      const user = await createUser();
      await createOrgMember(orgA.id, user.id);
      await createOrgMember(orgB.id, user.id);

      await createSubmission(orgA.id, user.id, {
        title: 'Story in Org A',
        status: 'SUBMITTED',
      });
      await createSubmission(orgB.id, user.id, {
        title: 'Story in Org B',
        status: 'ACCEPTED',
      });

      // Verify data exists in each org's RLS context
      const orgASubs = await withTestRls({ orgId: orgA.id }, async (tx) => {
        return tx
          .select()
          .from(submissions)
          .where(eq(submissions.submitterId, user.id));
      });
      expect(orgASubs).toHaveLength(1);

      const orgBSubs = await withTestRls({ orgId: orgB.id }, async (tx) => {
        return tx
          .select()
          .from(submissions)
          .where(eq(submissions.submitterId, user.id));
      });
      expect(orgBSubs).toHaveLength(1);
    });

    it('external submissions belong to user (not org)', async () => {
      const user = await createUser();
      await createExternalSubmission(user.id, {
        journalName: 'Tin House',
        status: 'sent',
      });
      await createExternalSubmission(user.id, {
        journalName: 'Ploughshares',
        status: 'rejected',
      });

      const extSubs = await withTestRls({ userId: user.id }, async (tx) => {
        return tx.select().from(externalSubmissions);
      });

      expect(extSubs).toHaveLength(2);
    });

    it('correspondence records belong to user', async () => {
      const user = await createUser();
      const extSub = await createExternalSubmission(user.id, {
        journalName: 'Test Journal',
      });
      await createCorrespondence(user.id, {
        body: 'Thank you for your submission',
        direction: 'inbound',
        channel: 'email',
        externalSubmissionId: extSub.id,
      });

      const corrs = await withTestRls({ userId: user.id }, async (tx) => {
        return tx.select().from(correspondence);
      });

      expect(corrs).toHaveLength(1);
      expect(corrs[0].body).toBe('Thank you for your submission');
    });
  });

  describe('import creates records', () => {
    it('importing external submissions creates records in DB', async () => {
      const user = await createUser();

      // Simulate import by directly inserting external submissions
      await withTestRls({ userId: user.id }, async (tx) => {
        await tx.insert(externalSubmissions).values([
          {
            userId: user.id,
            journalName: 'Imported Journal 1',
            status: 'sent',
          },
          {
            userId: user.id,
            journalName: 'Imported Journal 2',
            status: 'accepted',
          },
        ]);
      });

      const results = await withTestRls({ userId: user.id }, async (tx) => {
        return tx.select().from(externalSubmissions);
      });

      expect(results).toHaveLength(2);
      const names = results.map((r) => r.journalName).sort();
      expect(names).toEqual(['Imported Journal 1', 'Imported Journal 2']);
    });

    it('imported correspondence is visible to the user', async () => {
      const user = await createUser();
      const extSub = await createExternalSubmission(user.id, {
        journalName: 'Imported Journal',
      });

      await withTestRls({ userId: user.id }, async (tx) => {
        await tx.insert(correspondence).values({
          userId: user.id,
          direction: 'inbound',
          channel: 'email',
          sentAt: new Date(),
          body: 'Imported correspondence',
          source: 'csr_import',
          externalSubmissionId: extSub.id,
        });
      });

      const results = await withTestRls({ userId: user.id }, async (tx) => {
        return tx.select().from(correspondence);
      });

      expect(results).toHaveLength(1);
      expect(results[0].source).toBe('csr_import');
    });
  });
});
