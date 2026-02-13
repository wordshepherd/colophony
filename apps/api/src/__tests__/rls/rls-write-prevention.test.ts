import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { eq } from 'drizzle-orm';
import { globalSetup } from './helpers/db-setup';
import { truncateAllTables } from './helpers/cleanup';
import { withTestRls } from './helpers/rls-context';
import {
  createTwoOrgScenario,
  createUser,
  type TwoOrgScenario,
} from './helpers/factories';
import {
  submissions,
  submissionPeriods,
  payments,
  organizationMembers,
  submissionFiles,
} from '@colophony/db';

let scenario: TwoOrgScenario;

describe('RLS Write Prevention', () => {
  beforeAll(async () => {
    await globalSetup();
    await truncateAllTables();
    scenario = await createTwoOrgScenario();
  });

  afterAll(async () => {
    await truncateAllTables();
  });

  describe('cross-org INSERT blocked', () => {
    it('INSERT submission with wrong org_id throws 42501', async () => {
      await expect(
        withTestRls(
          { orgId: scenario.orgA.id, userId: scenario.userA.id },
          (tx) =>
            tx.insert(submissions).values({
              organizationId: scenario.orgB.id,
              submitterId: scenario.userA.id,
              title: 'Cross-org submission',
              status: 'DRAFT',
            }),
        ),
      ).rejects.toMatchObject({ cause: { code: '42501' } });
    });

    it('INSERT payment with wrong org_id throws 42501', async () => {
      await expect(
        withTestRls(
          { orgId: scenario.orgA.id, userId: scenario.userA.id },
          (tx) =>
            tx.insert(payments).values({
              organizationId: scenario.orgB.id,
              amount: 1000,
              currency: 'usd',
            }),
        ),
      ).rejects.toMatchObject({ cause: { code: '42501' } });
    });

    it('INSERT org_member with wrong org_id throws 42501', async () => {
      const extraUser = await createUser();
      await expect(
        withTestRls(
          { orgId: scenario.orgA.id, userId: scenario.userA.id },
          (tx) =>
            tx.insert(organizationMembers).values({
              organizationId: scenario.orgB.id,
              userId: extraUser.id,
              role: 'READER',
            }),
        ),
      ).rejects.toMatchObject({ cause: { code: '42501' } });
    });

    it("INSERT submission_file for other org's submission throws 42501", async () => {
      await expect(
        withTestRls(
          { orgId: scenario.orgA.id, userId: scenario.userA.id },
          (tx) =>
            tx.insert(submissionFiles).values({
              submissionId: scenario.submissionB.id,
              filename: 'cross-org-file.pdf',
              mimeType: 'application/pdf',
              size: 1024,
              storageKey: 'uploads/cross-org/file.pdf',
            }),
        ),
      ).rejects.toMatchObject({ cause: { code: '42501' } });
    });

    it('INSERT submission_period with wrong org_id throws 42501', async () => {
      await expect(
        withTestRls(
          { orgId: scenario.orgA.id, userId: scenario.userA.id },
          (tx) =>
            tx.insert(submissionPeriods).values({
              organizationId: scenario.orgB.id,
              name: 'Cross-org period',
              opensAt: new Date(),
              closesAt: new Date(Date.now() + 86400000),
            }),
        ),
      ).rejects.toMatchObject({ cause: { code: '42501' } });
    });
  });

  describe('cross-org UPDATE blocked', () => {
    it("UPDATE other org's submission returns empty", async () => {
      const result = await withTestRls(
        { orgId: scenario.orgA.id, userId: scenario.userA.id },
        (tx) =>
          tx
            .update(submissions)
            .set({ title: 'Hacked title' })
            .where(eq(submissions.id, scenario.submissionB.id))
            .returning(),
      );
      expect(result).toHaveLength(0);
    });

    it("UPDATE other org's payment returns empty", async () => {
      const result = await withTestRls(
        { orgId: scenario.orgA.id, userId: scenario.userA.id },
        (tx) =>
          tx
            .update(payments)
            .set({ amount: 9999 })
            .where(eq(payments.id, scenario.paymentB.id))
            .returning(),
      );
      expect(result).toHaveLength(0);
    });

    it('UPDATE submission changing org_id to different org throws 42501', async () => {
      await expect(
        withTestRls(
          { orgId: scenario.orgA.id, userId: scenario.userA.id },
          (tx) =>
            tx
              .update(submissions)
              .set({ organizationId: scenario.orgB.id })
              .where(eq(submissions.id, scenario.submissionA.id))
              .returning(),
        ),
      ).rejects.toMatchObject({ cause: { code: '42501' } });
    });

    it('UPDATE payment changing org_id to different org throws 42501', async () => {
      await expect(
        withTestRls(
          { orgId: scenario.orgA.id, userId: scenario.userA.id },
          (tx) =>
            tx
              .update(payments)
              .set({ organizationId: scenario.orgB.id })
              .where(eq(payments.id, scenario.paymentA.id))
              .returning(),
        ),
      ).rejects.toMatchObject({ cause: { code: '42501' } });
    });
  });

  describe('cross-org DELETE blocked', () => {
    it("DELETE other org's submission returns empty", async () => {
      const result = await withTestRls(
        { orgId: scenario.orgA.id, userId: scenario.userA.id },
        (tx) =>
          tx
            .delete(submissions)
            .where(eq(submissions.id, scenario.submissionB.id))
            .returning(),
      );
      expect(result).toHaveLength(0);
    });

    it("DELETE other org's file returns empty", async () => {
      const result = await withTestRls(
        { orgId: scenario.orgA.id, userId: scenario.userA.id },
        (tx) =>
          tx
            .delete(submissionFiles)
            .where(eq(submissionFiles.id, scenario.fileB.id))
            .returning(),
      );
      expect(result).toHaveLength(0);
    });

    it("DELETE other org's member returns empty", async () => {
      const result = await withTestRls(
        { orgId: scenario.orgA.id, userId: scenario.userA.id },
        (tx) =>
          tx
            .delete(organizationMembers)
            .where(eq(organizationMembers.id, scenario.memberB.id))
            .returning(),
      );
      expect(result).toHaveLength(0);
    });
  });
});
