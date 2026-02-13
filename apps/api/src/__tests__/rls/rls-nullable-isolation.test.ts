import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { globalSetup } from './helpers/db-setup';
import { truncateAllTables } from './helpers/cleanup';
import { withTestRls } from './helpers/rls-context';
import { createTwoOrgScenario, type TwoOrgScenario } from './helpers/factories';
import { auditEvents, retentionPolicies, userConsents } from '@colophony/db';

let scenario: TwoOrgScenario;

describe('RLS Nullable Isolation (IS NULL OR organization_id = current_org_id())', () => {
  beforeAll(async () => {
    await globalSetup();
    await truncateAllTables();
    scenario = await createTwoOrgScenario();
  });

  afterAll(async () => {
    await truncateAllTables();
  });

  describe('audit_events', () => {
    it('org A context sees org A + global events, not org B', async () => {
      const rows = await withTestRls(
        { orgId: scenario.orgA.id, userId: scenario.userA.id },
        (tx) => tx.select().from(auditEvents),
      );

      const ids = rows.map((r) => r.id);
      expect(ids).toContain(scenario.auditEventA.id);
      expect(ids).toContain(scenario.auditEventGlobal.id);
      expect(ids).not.toContain(scenario.auditEventB.id);
    });

    it('org B context sees org B + global events, not org A', async () => {
      const rows = await withTestRls(
        { orgId: scenario.orgB.id, userId: scenario.userB.id },
        (tx) => tx.select().from(auditEvents),
      );

      const ids = rows.map((r) => r.id);
      expect(ids).toContain(scenario.auditEventB.id);
      expect(ids).toContain(scenario.auditEventGlobal.id);
      expect(ids).not.toContain(scenario.auditEventA.id);
    });

    it('global audit event is visible to both orgs', async () => {
      const rowsA = await withTestRls(
        { orgId: scenario.orgA.id, userId: scenario.userA.id },
        (tx) => tx.select().from(auditEvents),
      );
      const rowsB = await withTestRls(
        { orgId: scenario.orgB.id, userId: scenario.userB.id },
        (tx) => tx.select().from(auditEvents),
      );

      expect(rowsA.map((r) => r.id)).toContain(scenario.auditEventGlobal.id);
      expect(rowsB.map((r) => r.id)).toContain(scenario.auditEventGlobal.id);
    });
  });

  describe('retention_policies', () => {
    it('org A context sees org A + global policies, not org B', async () => {
      const rows = await withTestRls(
        { orgId: scenario.orgA.id, userId: scenario.userA.id },
        (tx) => tx.select().from(retentionPolicies),
      );

      const ids = rows.map((r) => r.id);
      expect(ids).toContain(scenario.retentionPolicyA.id);
      expect(ids).toContain(scenario.retentionPolicyGlobal.id);
      expect(ids).not.toContain(scenario.retentionPolicyB.id);
    });

    it('org B context sees org B + global policies, not org A', async () => {
      const rows = await withTestRls(
        { orgId: scenario.orgB.id, userId: scenario.userB.id },
        (tx) => tx.select().from(retentionPolicies),
      );

      const ids = rows.map((r) => r.id);
      expect(ids).toContain(scenario.retentionPolicyB.id);
      expect(ids).toContain(scenario.retentionPolicyGlobal.id);
      expect(ids).not.toContain(scenario.retentionPolicyA.id);
    });

    it('global retention policy is visible to both orgs', async () => {
      const rowsA = await withTestRls(
        { orgId: scenario.orgA.id, userId: scenario.userA.id },
        (tx) => tx.select().from(retentionPolicies),
      );
      const rowsB = await withTestRls(
        { orgId: scenario.orgB.id, userId: scenario.userB.id },
        (tx) => tx.select().from(retentionPolicies),
      );

      expect(rowsA.map((r) => r.id)).toContain(
        scenario.retentionPolicyGlobal.id,
      );
      expect(rowsB.map((r) => r.id)).toContain(
        scenario.retentionPolicyGlobal.id,
      );
    });
  });

  describe('user_consents', () => {
    it('org A context sees org A + global consents, not org B', async () => {
      const rows = await withTestRls(
        { orgId: scenario.orgA.id, userId: scenario.userA.id },
        (tx) => tx.select().from(userConsents),
      );

      const ids = rows.map((r) => r.id);
      expect(ids).toContain(scenario.userConsentA.id);
      expect(ids).toContain(scenario.userConsentGlobal.id);
      expect(ids).not.toContain(scenario.userConsentB.id);
    });

    it('org B context sees org B + global consents, not org A', async () => {
      const rows = await withTestRls(
        { orgId: scenario.orgB.id, userId: scenario.userB.id },
        (tx) => tx.select().from(userConsents),
      );

      const ids = rows.map((r) => r.id);
      expect(ids).toContain(scenario.userConsentB.id);
      expect(ids).toContain(scenario.userConsentGlobal.id);
      expect(ids).not.toContain(scenario.userConsentA.id);
    });

    it('global user consent is visible to both orgs', async () => {
      const rowsA = await withTestRls(
        { orgId: scenario.orgA.id, userId: scenario.userA.id },
        (tx) => tx.select().from(userConsents),
      );
      const rowsB = await withTestRls(
        { orgId: scenario.orgB.id, userId: scenario.userB.id },
        (tx) => tx.select().from(userConsents),
      );

      expect(rowsA.map((r) => r.id)).toContain(scenario.userConsentGlobal.id);
      expect(rowsB.map((r) => r.id)).toContain(scenario.userConsentGlobal.id);
    });
  });
});
