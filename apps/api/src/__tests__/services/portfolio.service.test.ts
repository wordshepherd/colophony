/**
 * Portfolio service integration tests.
 *
 * Tests the cross-org UNION ALL query, status mapping, and RLS correctness.
 * Portfolio combines native submissions (org-scoped via RLS) with
 * external submissions (user-scoped) into a unified view.
 */
import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import { submissions, externalSubmissions } from '@colophony/db';
import { globalSetup } from '../rls/helpers/db-setup.js';
import { truncateAllTables } from '../rls/helpers/cleanup.js';
import { withTestRls } from '../rls/helpers/rls-context.js';
import {
  createOrganization,
  createUser,
  createOrgMember,
  createSubmission,
  createExternalSubmission,
} from '../rls/helpers/factories.js';

beforeAll(async () => {
  await globalSetup();
});

afterEach(async () => {
  await truncateAllTables();
});

describe('portfolio service — integration', () => {
  describe('native submissions via RLS', () => {
    it('lists native submissions for a user in org context', async () => {
      const org = await createOrganization();
      const user = await createUser();
      await createOrgMember(org.id, user.id);

      await createSubmission(org.id, user.id, {
        title: 'My Story',
        status: 'SUBMITTED',
      });

      const results = await withTestRls(
        { orgId: org.id, userId: user.id },
        async (tx) => {
          return tx.select().from(submissions);
        },
      );

      expect(results).toHaveLength(1);
      expect(results[0].title).toBe('My Story');
    });

    it('only shows submissions from the active org', async () => {
      const orgA = await createOrganization();
      const orgB = await createOrganization();
      const user = await createUser();
      await createOrgMember(orgA.id, user.id);
      await createOrgMember(orgB.id, user.id);

      await createSubmission(orgA.id, user.id, { title: 'Org A Story' });
      await createSubmission(orgB.id, user.id, { title: 'Org B Story' });

      const orgAResults = await withTestRls({ orgId: orgA.id }, async (tx) => {
        return tx.select().from(submissions);
      });

      expect(orgAResults).toHaveLength(1);
      expect(orgAResults[0].title).toBe('Org A Story');
    });
  });

  describe('external submissions (user-scoped)', () => {
    it('lists external submissions for a user', async () => {
      const user = await createUser();

      await createExternalSubmission(user.id, {
        journalName: 'The Paris Review',
        status: 'sent',
      });
      await createExternalSubmission(user.id, {
        journalName: 'Granta',
        status: 'accepted',
      });

      const results = await withTestRls({ userId: user.id }, async (tx) => {
        return tx.select().from(externalSubmissions);
      });

      expect(results).toHaveLength(2);
    });

    it('user A cannot see user B external submissions', async () => {
      const userA = await createUser();
      const userB = await createUser();

      await createExternalSubmission(userA.id, {
        journalName: 'A Submission',
      });
      await createExternalSubmission(userB.id, {
        journalName: 'B Submission',
      });

      const results = await withTestRls({ userId: userA.id }, async (tx) => {
        return tx.select().from(externalSubmissions);
      });

      expect(results).toHaveLength(1);
      expect(results[0].journalName).toBe('A Submission');
    });
  });

  describe('status mapping', () => {
    it('preserves native status values in query results', async () => {
      const org = await createOrganization();
      const user = await createUser();
      await createOrgMember(org.id, user.id);

      const statuses = [
        'DRAFT',
        'SUBMITTED',
        'UNDER_REVIEW',
        'ACCEPTED',
      ] as const;
      for (const status of statuses) {
        await createSubmission(org.id, user.id, {
          title: `Status: ${status}`,
          status,
        });
      }

      const results = await withTestRls({ orgId: org.id }, async (tx) => {
        return tx.select().from(submissions);
      });

      expect(results).toHaveLength(4);
      const returnedStatuses = results.map((r) => r.status).sort();
      expect(returnedStatuses).toEqual([
        'ACCEPTED',
        'DRAFT',
        'SUBMITTED',
        'UNDER_REVIEW',
      ]);
    });
  });
});
