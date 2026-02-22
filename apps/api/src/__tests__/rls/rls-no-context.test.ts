import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { globalSetup } from './helpers/db-setup';
import { truncateAllTables } from './helpers/cleanup';
import { withTestRls } from './helpers/rls-context';
import { createTwoOrgScenario, type TwoOrgScenario } from './helpers/factories';
import {
  submissions,
  submissionPeriods,
  payments,
  organizationMembers,
  files,
  submissionHistory,
  auditEvents,
  retentionPolicies,
  userConsents,
} from '@colophony/db';
import { sql } from 'drizzle-orm';

let scenario: TwoOrgScenario;

describe('RLS No Context (empty context)', () => {
  beforeAll(async () => {
    await globalSetup();
    await truncateAllTables();
    scenario = await createTwoOrgScenario();
  });

  afterAll(async () => {
    await truncateAllTables();
  });

  describe('strict tables return 0 rows without context', () => {
    it('submissions: no context returns 0 rows', async () => {
      const rows = await withTestRls({}, (tx) => tx.select().from(submissions));
      expect(rows).toHaveLength(0);
    });

    it('submission_periods: no context returns 0 rows', async () => {
      const rows = await withTestRls({}, (tx) =>
        tx.select().from(submissionPeriods),
      );
      expect(rows).toHaveLength(0);
    });

    it('payments: no context returns 0 rows', async () => {
      const rows = await withTestRls({}, (tx) => tx.select().from(payments));
      expect(rows).toHaveLength(0);
    });

    it('organization_members: no context returns 0 rows', async () => {
      const rows = await withTestRls({}, (tx) =>
        tx.select().from(organizationMembers),
      );
      expect(rows).toHaveLength(0);
    });
  });

  describe('indirect tables return 0 rows without context', () => {
    it('files: no context returns 0 rows', async () => {
      const rows = await withTestRls({}, (tx) => tx.select().from(files));
      expect(rows).toHaveLength(0);
    });

    it('submission_history: no context returns 0 rows', async () => {
      const rows = await withTestRls({}, (tx) =>
        tx.select().from(submissionHistory),
      );
      expect(rows).toHaveLength(0);
    });
  });

  describe('nullable tables return only global rows without context', () => {
    it('audit_events: no context returns 0 rows (global events not exposed)', async () => {
      const rows = await withTestRls({}, (tx) => tx.select().from(auditEvents));
      expect(rows).toHaveLength(0);
    });

    it('retention_policies: no context returns only global (null org) policies', async () => {
      const rows = await withTestRls({}, (tx) =>
        tx.select().from(retentionPolicies),
      );
      expect(rows).toHaveLength(1);
      expect(rows[0].id).toBe(scenario.retentionPolicyGlobal.id);
      expect(rows[0].organizationId).toBeNull();
    });

    it('user_consents: no context returns only global (null org) consents', async () => {
      const rows = await withTestRls({}, (tx) =>
        tx.select().from(userConsents),
      );
      expect(rows).toHaveLength(1);
      expect(rows[0].id).toBe(scenario.userConsentGlobal.id);
      expect(rows[0].organizationId).toBeNull();
    });
  });

  describe('INSERT without context on strict tables blocked', () => {
    it('INSERT submission with org_id, no context throws 42501', async () => {
      await expect(
        withTestRls({}, (tx) =>
          tx.insert(submissions).values({
            organizationId: scenario.orgA.id,
            submitterId: scenario.userA.id,
            title: 'No context submission',
            status: 'DRAFT',
          }),
        ),
      ).rejects.toMatchObject({ cause: { code: '42501' } });
    });
  });

  describe('INSERT without context on nullable tables', () => {
    it('INSERT audit_event with NULL org_id via insert_audit_event() succeeds', async () => {
      // app_user cannot INSERT directly (revoked in migration 0010),
      // but can call insert_audit_event() SECURITY DEFINER function.
      await withTestRls({}, (tx) =>
        tx.execute(
          sql`SELECT insert_audit_event(
            ${'SYSTEM_EVENT'}::varchar,
            ${`no_ctx_audit_${Date.now()}`}::varchar
          )`,
        ),
      );
    });

    it('INSERT retention_policy with NULL org_id, no context succeeds', async () => {
      const rows = await withTestRls({}, (tx) =>
        tx
          .insert(retentionPolicies)
          .values({
            organizationId: null,
            resource: `no_ctx_retention_${Date.now()}`,
            retentionDays: 90,
          })
          .returning(),
      );
      expect(rows).toHaveLength(1);
      expect(rows[0].organizationId).toBeNull();
    });

    it('INSERT user_consent with NULL org_id, no context succeeds', async () => {
      const rows = await withTestRls({}, (tx) =>
        tx
          .insert(userConsents)
          .values({
            userId: scenario.userA.id,
            organizationId: null,
            consentType: `no_ctx_consent_${Date.now()}`,
            granted: true,
          })
          .returning(),
      );
      expect(rows).toHaveLength(1);
      expect(rows[0].organizationId).toBeNull();
    });

    it('INSERT audit_event with non-null org_id, no context throws 42501 (direct INSERT denied)', async () => {
      // Direct INSERT is denied at table-permission level (INSERT revoked from app_user)
      await expect(
        withTestRls({}, (tx) =>
          tx.insert(auditEvents).values({
            organizationId: scenario.orgA.id,
            action: 'UNAUTHORIZED',
            resource: `no_ctx_bad_audit_${Date.now()}`,
          }),
        ),
      ).rejects.toMatchObject({ cause: { code: '42501' } });
    });

    it('INSERT retention_policy with non-null org_id, no context throws 42501', async () => {
      await expect(
        withTestRls({}, (tx) =>
          tx.insert(retentionPolicies).values({
            organizationId: scenario.orgA.id,
            resource: `no_ctx_bad_retention_${Date.now()}`,
            retentionDays: 90,
          }),
        ),
      ).rejects.toMatchObject({ cause: { code: '42501' } });
    });
  });
});
