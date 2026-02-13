import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { eq } from 'drizzle-orm';
import { globalSetup } from './helpers/db-setup';
import { truncateAllTables } from './helpers/cleanup';
import { withTestRls } from './helpers/rls-context';
import { createTwoOrgScenario, type TwoOrgScenario } from './helpers/factories';
import {
  submissions,
  submissionPeriods,
  payments,
  organizationMembers,
} from '@colophony/db';

let scenario: TwoOrgScenario;

describe('RLS Direct Isolation (organization_id = current_org_id())', () => {
  beforeAll(async () => {
    await globalSetup();
    await truncateAllTables();
    scenario = await createTwoOrgScenario();
  });

  afterAll(async () => {
    await truncateAllTables();
  });

  describe('submissions', () => {
    it('org A context sees only org A submissions', async () => {
      const rows = await withTestRls(
        { orgId: scenario.orgA.id, userId: scenario.userA.id },
        (tx) => tx.select().from(submissions),
      );
      expect(rows).toHaveLength(1);
      expect(rows[0].id).toBe(scenario.submissionA.id);
    });

    it('org B context sees only org B submissions', async () => {
      const rows = await withTestRls(
        { orgId: scenario.orgB.id, userId: scenario.userB.id },
        (tx) => tx.select().from(submissions),
      );
      expect(rows).toHaveLength(1);
      expect(rows[0].id).toBe(scenario.submissionB.id);
    });

    it('org A context cannot find org B submission by ID', async () => {
      const rows = await withTestRls(
        { orgId: scenario.orgA.id, userId: scenario.userA.id },
        (tx) =>
          tx
            .select()
            .from(submissions)
            .where(eq(submissions.id, scenario.submissionB.id)),
      );
      expect(rows).toHaveLength(0);
    });
  });

  describe('submission_periods', () => {
    it('org A context sees only org A periods', async () => {
      const rows = await withTestRls(
        { orgId: scenario.orgA.id, userId: scenario.userA.id },
        (tx) => tx.select().from(submissionPeriods),
      );
      expect(rows).toHaveLength(1);
      expect(rows[0].id).toBe(scenario.periodA.id);
    });

    it('org B context sees only org B periods', async () => {
      const rows = await withTestRls(
        { orgId: scenario.orgB.id, userId: scenario.userB.id },
        (tx) => tx.select().from(submissionPeriods),
      );
      expect(rows).toHaveLength(1);
      expect(rows[0].id).toBe(scenario.periodB.id);
    });

    it('org A context cannot find org B period by ID', async () => {
      const rows = await withTestRls(
        { orgId: scenario.orgA.id, userId: scenario.userA.id },
        (tx) =>
          tx
            .select()
            .from(submissionPeriods)
            .where(eq(submissionPeriods.id, scenario.periodB.id)),
      );
      expect(rows).toHaveLength(0);
    });
  });

  describe('payments', () => {
    it('org A context sees only org A payments', async () => {
      const rows = await withTestRls(
        { orgId: scenario.orgA.id, userId: scenario.userA.id },
        (tx) => tx.select().from(payments),
      );
      expect(rows).toHaveLength(1);
      expect(rows[0].id).toBe(scenario.paymentA.id);
    });

    it('org B context sees only org B payments', async () => {
      const rows = await withTestRls(
        { orgId: scenario.orgB.id, userId: scenario.userB.id },
        (tx) => tx.select().from(payments),
      );
      expect(rows).toHaveLength(1);
      expect(rows[0].id).toBe(scenario.paymentB.id);
    });

    it('org A context cannot find org B payment by ID', async () => {
      const rows = await withTestRls(
        { orgId: scenario.orgA.id, userId: scenario.userA.id },
        (tx) =>
          tx
            .select()
            .from(payments)
            .where(eq(payments.id, scenario.paymentB.id)),
      );
      expect(rows).toHaveLength(0);
    });
  });

  describe('organization_members', () => {
    it('org A context sees only org A members', async () => {
      const rows = await withTestRls(
        { orgId: scenario.orgA.id, userId: scenario.userA.id },
        (tx) => tx.select().from(organizationMembers),
      );
      expect(rows).toHaveLength(1);
      expect(rows[0].id).toBe(scenario.memberA.id);
    });

    it('org B context sees only org B members', async () => {
      const rows = await withTestRls(
        { orgId: scenario.orgB.id, userId: scenario.userB.id },
        (tx) => tx.select().from(organizationMembers),
      );
      expect(rows).toHaveLength(1);
      expect(rows[0].id).toBe(scenario.memberB.id);
    });

    it('org A context cannot find org B member by ID', async () => {
      const rows = await withTestRls(
        { orgId: scenario.orgA.id, userId: scenario.userA.id },
        (tx) =>
          tx
            .select()
            .from(organizationMembers)
            .where(eq(organizationMembers.id, scenario.memberB.id)),
      );
      expect(rows).toHaveLength(0);
    });
  });
});
