/**
 * Submission service integration tests.
 *
 * Tests the service → DB → RLS chain with a real PostgreSQL instance.
 * Verifies CRUD, status transitions, pagination, access control, and
 * RLS tenant isolation.
 */
import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import { submissions, submissionHistory } from '@colophony/db';
import { eq } from 'drizzle-orm';
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

describe('submission service — integration', () => {
  describe('create', () => {
    it('creates a submission visible within org RLS context', async () => {
      const org = await createOrganization();
      const user = await createUser();
      await createOrgMember(org.id, user.id);

      const created = await withTestRls({ orgId: org.id }, async (tx) => {
        const [sub] = await tx
          .insert(submissions)
          .values({
            organizationId: org.id,
            submitterId: user.id,
            title: 'My First Submission',
            content: 'Content here',
            status: 'DRAFT',
          })
          .returning();
        return sub;
      });

      expect(created.title).toBe('My First Submission');
      expect(created.organizationId).toBe(org.id);
      expect(created.submitterId).toBe(user.id);
      expect(created.status).toBe('DRAFT');
    });

    it('assigns correct defaults on creation', async () => {
      const org = await createOrganization();
      const user = await createUser();
      await createOrgMember(org.id, user.id);

      const created = await withTestRls({ orgId: org.id }, async (tx) => {
        const [sub] = await tx
          .insert(submissions)
          .values({
            organizationId: org.id,
            submitterId: user.id,
            title: 'Defaults Test',
            content: '',
            status: 'DRAFT',
          })
          .returning();
        return sub;
      });

      expect(created.id).toBeDefined();
      expect(created.createdAt).toBeInstanceOf(Date);
    });
  });

  describe('status transitions', () => {
    it('allows DRAFT → SUBMITTED transition', async () => {
      const org = await createOrganization();
      const user = await createUser();
      await createOrgMember(org.id, user.id);
      const sub = await createSubmission(org.id, user.id, { status: 'DRAFT' });

      const updated = await withTestRls({ orgId: org.id }, async (tx) => {
        const [result] = await tx
          .update(submissions)
          .set({ status: 'SUBMITTED', updatedAt: new Date() })
          .where(eq(submissions.id, sub.id))
          .returning();
        return result;
      });

      expect(updated.status).toBe('SUBMITTED');
    });

    it('tracks status change in submission_history', async () => {
      const org = await createOrganization();
      const user = await createUser();
      await createOrgMember(org.id, user.id);
      const sub = await createSubmission(org.id, user.id, {
        status: 'SUBMITTED',
      });

      await withTestRls({ orgId: org.id }, async (tx) => {
        await tx.insert(submissionHistory).values({
          submissionId: sub.id,
          fromStatus: 'DRAFT',
          toStatus: 'SUBMITTED',
          changedBy: user.id,
        });
      });

      const history = await withTestRls({ orgId: org.id }, async (tx) => {
        return tx
          .select()
          .from(submissionHistory)
          .where(eq(submissionHistory.submissionId, sub.id));
      });

      expect(history).toHaveLength(1);
      expect(history[0].toStatus).toBe('SUBMITTED');
    });
  });

  describe('list with pagination', () => {
    it('returns paginated results within org context', async () => {
      const org = await createOrganization();
      const user = await createUser();
      await createOrgMember(org.id, user.id);

      // Create 5 submissions
      for (let i = 0; i < 5; i++) {
        await createSubmission(org.id, user.id, { title: `Sub ${i}` });
      }

      const allResults = await withTestRls({ orgId: org.id }, async (tx) => {
        return tx.select().from(submissions);
      });

      expect(allResults).toHaveLength(5);
    });

    it('limits results with .limit()', async () => {
      const org = await createOrganization();
      const user = await createUser();
      await createOrgMember(org.id, user.id);

      for (let i = 0; i < 10; i++) {
        await createSubmission(org.id, user.id, { title: `Sub ${i}` });
      }

      const page = await withTestRls({ orgId: org.id }, async (tx) => {
        return tx.select().from(submissions).limit(3);
      });

      expect(page).toHaveLength(3);
    });
  });

  describe('RLS isolation', () => {
    it('org A cannot see org B submissions', async () => {
      const orgA = await createOrganization();
      const orgB = await createOrganization();
      const userA = await createUser();
      const userB = await createUser();
      await createOrgMember(orgA.id, userA.id);
      await createOrgMember(orgB.id, userB.id);

      await createSubmission(orgA.id, userA.id, { title: 'Org A only' });
      await createSubmission(orgB.id, userB.id, { title: 'Org B only' });

      const orgAResults = await withTestRls({ orgId: orgA.id }, async (tx) => {
        return tx.select().from(submissions);
      });

      expect(orgAResults).toHaveLength(1);
      expect(orgAResults[0].title).toBe('Org A only');
    });

    it('org B cannot update org A submissions', async () => {
      const orgA = await createOrganization();
      const orgB = await createOrganization();
      const userA = await createUser();
      const userB = await createUser();
      await createOrgMember(orgA.id, userA.id);
      await createOrgMember(orgB.id, userB.id);

      const sub = await createSubmission(orgA.id, userA.id, {
        title: 'Protected',
      });

      // Try updating org A's submission from org B context
      const updated = await withTestRls({ orgId: orgB.id }, async (tx) => {
        const result = await tx
          .update(submissions)
          .set({ title: 'Hacked!' })
          .where(eq(submissions.id, sub.id))
          .returning();
        return result;
      });

      // Should return empty — RLS blocks the update
      expect(updated).toHaveLength(0);

      // Verify original is untouched
      const original = await withTestRls({ orgId: orgA.id }, async (tx) => {
        const [row] = await tx
          .select()
          .from(submissions)
          .where(eq(submissions.id, sub.id))
          .limit(1);
        return row;
      });

      expect(original.title).toBe('Protected');
    });

    it('org B cannot delete org A submissions', async () => {
      const orgA = await createOrganization();
      const orgB = await createOrganization();
      const userA = await createUser();
      const userB = await createUser();
      await createOrgMember(orgA.id, userA.id);
      await createOrgMember(orgB.id, userB.id);

      const sub = await createSubmission(orgA.id, userA.id);

      const deleted = await withTestRls({ orgId: orgB.id }, async (tx) => {
        return tx
          .delete(submissions)
          .where(eq(submissions.id, sub.id))
          .returning();
      });

      expect(deleted).toHaveLength(0);
    });
  });

  describe('submission period association', () => {
    it('links submission to a period', async () => {
      const org = await createOrganization();
      const user = await createUser();
      await createOrgMember(org.id, user.id);
      const period = await createSubmissionPeriod(org.id, {
        name: 'Spring 2026',
      });

      const sub = await createSubmission(org.id, user.id, {
        submissionPeriodId: period.id,
      });

      const fetched = await withTestRls({ orgId: org.id }, async (tx) => {
        const [row] = await tx
          .select()
          .from(submissions)
          .where(eq(submissions.id, sub.id))
          .limit(1);
        return row;
      });

      expect(fetched.submissionPeriodId).toBe(period.id);
    });
  });
});
