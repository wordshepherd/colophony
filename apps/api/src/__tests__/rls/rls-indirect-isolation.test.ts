import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { eq } from 'drizzle-orm';
import { globalSetup } from './helpers/db-setup';
import { truncateAllTables } from './helpers/cleanup';
import { withTestRls } from './helpers/rls-context';
import { createTwoOrgScenario, type TwoOrgScenario } from './helpers/factories';
import { submissionFiles, submissionHistory } from '@colophony/db';

let scenario: TwoOrgScenario;

describe('RLS Indirect Isolation (subquery-based)', () => {
  beforeAll(async () => {
    await globalSetup();
    await truncateAllTables();
    scenario = await createTwoOrgScenario();
  });

  afterAll(async () => {
    await truncateAllTables();
  });

  describe('submission_files', () => {
    it('org A context sees only org A files', async () => {
      const rows = await withTestRls(
        { orgId: scenario.orgA.id, userId: scenario.userA.id },
        (tx) => tx.select().from(submissionFiles),
      );
      expect(rows).toHaveLength(1);
      expect(rows[0].id).toBe(scenario.fileA.id);
    });

    it('org B context sees only org B files', async () => {
      const rows = await withTestRls(
        { orgId: scenario.orgB.id, userId: scenario.userB.id },
        (tx) => tx.select().from(submissionFiles),
      );
      expect(rows).toHaveLength(1);
      expect(rows[0].id).toBe(scenario.fileB.id);
    });

    it('org A context cannot find org B file by ID', async () => {
      const rows = await withTestRls(
        { orgId: scenario.orgA.id, userId: scenario.userA.id },
        (tx) =>
          tx
            .select()
            .from(submissionFiles)
            .where(eq(submissionFiles.id, scenario.fileB.id)),
      );
      expect(rows).toHaveLength(0);
    });

    it('org A context cannot find files by org B submission_id', async () => {
      const rows = await withTestRls(
        { orgId: scenario.orgA.id, userId: scenario.userA.id },
        (tx) =>
          tx
            .select()
            .from(submissionFiles)
            .where(eq(submissionFiles.submissionId, scenario.submissionB.id)),
      );
      expect(rows).toHaveLength(0);
    });
  });

  describe('submission_history', () => {
    it('org A context sees only org A history', async () => {
      const rows = await withTestRls(
        { orgId: scenario.orgA.id, userId: scenario.userA.id },
        (tx) => tx.select().from(submissionHistory),
      );
      expect(rows).toHaveLength(1);
      expect(rows[0].id).toBe(scenario.historyA.id);
    });

    it('org B context sees only org B history', async () => {
      const rows = await withTestRls(
        { orgId: scenario.orgB.id, userId: scenario.userB.id },
        (tx) => tx.select().from(submissionHistory),
      );
      expect(rows).toHaveLength(1);
      expect(rows[0].id).toBe(scenario.historyB.id);
    });

    it('org A context cannot find org B history by ID', async () => {
      const rows = await withTestRls(
        { orgId: scenario.orgA.id, userId: scenario.userA.id },
        (tx) =>
          tx
            .select()
            .from(submissionHistory)
            .where(eq(submissionHistory.id, scenario.historyB.id)),
      );
      expect(rows).toHaveLength(0);
    });

    it('org A context cannot find history by org B submission_id', async () => {
      const rows = await withTestRls(
        { orgId: scenario.orgA.id, userId: scenario.userA.id },
        (tx) =>
          tx
            .select()
            .from(submissionHistory)
            .where(eq(submissionHistory.submissionId, scenario.submissionB.id)),
      );
      expect(rows).toHaveLength(0);
    });
  });
});
