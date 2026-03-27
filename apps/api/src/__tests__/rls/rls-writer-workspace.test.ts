import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { eq } from 'drizzle-orm';
import { globalSetup, getAdminPool, getAppPool } from './helpers/db-setup';
import { truncateAllTables } from './helpers/cleanup';
import { withTestRls } from './helpers/rls-context';
import {
  createUser,
  createOrganization,
  createOrgMember,
  createSubmission,
  createSubmissionPeriod,
  createJournalDirectoryEntry,
  createExternalSubmission,
  createCorrespondence,
  createWriterProfile,
} from './helpers/factories';
import {
  externalSubmissions,
  correspondence,
  journalDirectory,
  writerProfiles,
} from '@colophony/db';
import type {
  User,
  Organization,
  Submission,
  ExternalSubmission,
} from '@colophony/db';

let userA: User;
let userB: User;
let orgX: Organization;
let orgY: Organization;
let submissionInOrgX: Submission;
let extSubA: ExternalSubmission;

describe('RLS Writer Workspace', () => {
  beforeAll(async () => {
    await globalSetup();
    await truncateAllTables();

    // Create users and orgs
    [userA, userB] = await Promise.all([createUser(), createUser()]);
    [orgX, orgY] = await Promise.all([
      createOrganization(),
      createOrganization(),
    ]);

    // userA is member of orgX, userB is member of orgY
    await Promise.all([
      createOrgMember(orgX.id, userA.id),
      createOrgMember(orgY.id, userB.id),
    ]);

    // Create a submission period + submission in orgX for correspondence tests
    const periodX = await createSubmissionPeriod(orgX.id);
    submissionInOrgX = await createSubmission(orgX.id, userA.id, {
      submissionPeriodId: periodX.id,
    });

    // Create external submissions for each user
    extSubA = await createExternalSubmission(userA.id);
    await createExternalSubmission(userB.id);

    // Seed journal directory entries (via admin — app_user can't INSERT)
    await createJournalDirectoryEntry({ name: 'The Paris Review' });
    await createJournalDirectoryEntry({ name: 'Ploughshares' });
  });

  afterAll(async () => {
    await truncateAllTables();
  });

  // =========================================================================
  // external_submissions
  // =========================================================================

  describe('external_submissions', () => {
    it('user can CRUD their own external submissions', async () => {
      // INSERT
      const [inserted] = await withTestRls({ userId: userA.id }, (tx) =>
        tx
          .insert(externalSubmissions)
          .values({
            userId: userA.id,
            journalName: 'Test Journal',
            status: 'draft',
          })
          .returning(),
      );
      expect(inserted).toBeDefined();

      // SELECT
      const rows = await withTestRls({ userId: userA.id }, (tx) =>
        tx
          .select()
          .from(externalSubmissions)
          .where(eq(externalSubmissions.id, inserted.id)),
      );
      expect(rows).toHaveLength(1);

      // UPDATE
      const [updated] = await withTestRls({ userId: userA.id }, (tx) =>
        tx
          .update(externalSubmissions)
          .set({ status: 'sent' })
          .where(eq(externalSubmissions.id, inserted.id))
          .returning(),
      );
      expect(updated.status).toBe('sent');

      // DELETE
      const [deleted] = await withTestRls({ userId: userA.id }, (tx) =>
        tx
          .delete(externalSubmissions)
          .where(eq(externalSubmissions.id, inserted.id))
          .returning(),
      );
      expect(deleted).toBeDefined();
    });

    it("user cannot see another user's external submissions", async () => {
      const rows = await withTestRls({ userId: userB.id }, (tx) =>
        tx
          .select()
          .from(externalSubmissions)
          .where(eq(externalSubmissions.id, extSubA.id)),
      );
      expect(rows).toHaveLength(0);
    });

    it("user cannot update another user's external submissions", async () => {
      const rows = await withTestRls({ userId: userB.id }, (tx) =>
        tx
          .update(externalSubmissions)
          .set({ status: 'accepted' })
          .where(eq(externalSubmissions.id, extSubA.id))
          .returning(),
      );
      expect(rows).toHaveLength(0);
    });

    it('cascade deletes on user deletion', async () => {
      const tempUser = await createUser();
      const extSub = await createExternalSubmission(tempUser.id);
      const admin = getAdminPool();

      // Delete the user — should cascade to external submissions
      await admin.query('DELETE FROM users WHERE id = $1', [tempUser.id]);

      const { rows } = await admin.query(
        'SELECT id FROM external_submissions WHERE id = $1',
        [extSub.id],
      );
      expect(rows).toHaveLength(0);
    });
  });

  // =========================================================================
  // correspondence
  // =========================================================================

  describe('correspondence', () => {
    it('writer can CRUD their own correspondence', async () => {
      // INSERT linked to external submission
      const [inserted] = await withTestRls({ userId: userA.id }, (tx) =>
        tx
          .insert(correspondence)
          .values({
            userId: userA.id,
            externalSubmissionId: extSubA.id,
            direction: 'inbound',
            channel: 'email',
            sentAt: new Date(),
            body: 'Thank you for your submission.',
            source: 'manual',
          })
          .returning(),
      );
      expect(inserted).toBeDefined();

      // SELECT
      const rows = await withTestRls({ userId: userA.id }, (tx) =>
        tx
          .select()
          .from(correspondence)
          .where(eq(correspondence.id, inserted.id)),
      );
      expect(rows).toHaveLength(1);

      // UPDATE
      const [updated] = await withTestRls({ userId: userA.id }, (tx) =>
        tx
          .update(correspondence)
          .set({ body: 'Updated body' })
          .where(eq(correspondence.id, inserted.id))
          .returning(),
      );
      expect(updated.body).toBe('Updated body');

      // DELETE
      const [deleted] = await withTestRls({ userId: userA.id }, (tx) =>
        tx
          .delete(correspondence)
          .where(eq(correspondence.id, inserted.id))
          .returning(),
      );
      expect(deleted).toBeDefined();
    });

    it("writer cannot see another writer's correspondence", async () => {
      const corrA = await createCorrespondence(userA.id, {
        externalSubmissionId: extSubA.id,
      });

      const rows = await withTestRls({ userId: userB.id }, (tx) =>
        tx.select().from(correspondence).where(eq(correspondence.id, corrA.id)),
      );
      expect(rows).toHaveLength(0);
    });

    it("org editor can READ correspondence on their org's submissions", async () => {
      // userA creates correspondence on a submission in orgX
      const corrOnOrgSub = await createCorrespondence(userA.id, {
        submissionId: submissionInOrgX.id,
      });

      // userB (editor in orgY) cannot see it, but let's create a member in orgX
      // to test positive case — use a third user who is member of orgX
      const editorUser = await createUser();
      await createOrgMember(orgX.id, editorUser.id, { roles: ['EDITOR'] });

      const rows = await withTestRls(
        { userId: editorUser.id, orgId: orgX.id },
        (tx) =>
          tx
            .select()
            .from(correspondence)
            .where(eq(correspondence.id, corrOnOrgSub.id)),
      );
      expect(rows).toHaveLength(1);
    });

    it('org editor cannot READ correspondence on external submissions', async () => {
      // Correspondence linked to external_submission_id (not submission_id)
      const corrOnExtSub = await createCorrespondence(userA.id, {
        externalSubmissionId: extSubA.id,
      });

      const editorUser = await createUser();
      await createOrgMember(orgX.id, editorUser.id, { roles: ['EDITOR'] });

      // Editor in orgX should NOT see this — it's linked to external submission, not org submission
      const rows = await withTestRls(
        { userId: editorUser.id, orgId: orgX.id },
        (tx) =>
          tx
            .select()
            .from(correspondence)
            .where(eq(correspondence.id, corrOnExtSub.id)),
      );
      expect(rows).toHaveLength(0);
    });

    it('org editor from different org cannot READ correspondence', async () => {
      const corrOnOrgSub = await createCorrespondence(userA.id, {
        submissionId: submissionInOrgX.id,
      });

      // userB is in orgY — should not see orgX correspondence
      const rows = await withTestRls(
        { userId: userB.id, orgId: orgY.id },
        (tx) =>
          tx
            .select()
            .from(correspondence)
            .where(eq(correspondence.id, corrOnOrgSub.id)),
      );
      expect(rows).toHaveLength(0);
    });

    it('XOR constraint: rejects both FKs null', async () => {
      const admin = getAdminPool();
      await expect(
        admin.query(
          `INSERT INTO correspondence (
            user_id, direction, channel, sent_at, body, source
          ) VALUES ($1, 'inbound', 'email', now(), 'test body', 'manual')`,
          [userA.id],
        ),
      ).rejects.toThrow(/correspondence_submission_xor/);
    });

    it('XOR constraint: rejects both FKs non-null', async () => {
      const admin = getAdminPool();
      await expect(
        admin.query(
          `INSERT INTO correspondence (
            user_id, submission_id, external_submission_id,
            direction, channel, sent_at, body, source
          ) VALUES ($1, $2, $3, 'inbound', 'email', now(), 'test body', 'manual')`,
          [userA.id, submissionInOrgX.id, extSubA.id],
        ),
      ).rejects.toThrow(/correspondence_submission_xor/);
    });
  });

  // =========================================================================
  // journal_directory
  // =========================================================================

  describe('journal_directory', () => {
    it('authenticated user can read journal directory', async () => {
      const rows = await withTestRls({ userId: userA.id }, (tx) =>
        tx.select().from(journalDirectory),
      );
      expect(rows.length).toBeGreaterThanOrEqual(2);
    });

    it('app_user cannot insert into journal directory', async () => {
      const app = getAppPool();
      const client = await app.connect();
      try {
        await client.query('BEGIN');
        await client.query("SELECT set_config('app.user_id', $1, true)", [
          userA.id,
        ]);
        await expect(
          client.query(
            `INSERT INTO journal_directory (name, normalized_name)
             VALUES ('Test Journal', 'test_journal')`,
          ),
        ).rejects.toThrow();
        await client.query('ROLLBACK');
      } finally {
        client.release();
      }
    });

    it('superuser can insert into journal directory', async () => {
      const admin = getAdminPool();
      const { rows } = await admin.query(
        `INSERT INTO journal_directory (name, normalized_name)
         VALUES ('Admin-Created Journal', 'admin_created_journal')
         RETURNING id`,
      );
      expect(rows).toHaveLength(1);
      // Clean up
      await admin.query('DELETE FROM journal_directory WHERE id = $1', [
        rows[0].id,
      ]);
    });
  });

  // =========================================================================
  // writer_profiles
  // =========================================================================

  describe('writer_profiles', () => {
    it('user can CRUD their own profiles', async () => {
      // INSERT
      const [inserted] = await withTestRls({ userId: userA.id }, (tx) =>
        tx
          .insert(writerProfiles)
          .values({
            userId: userA.id,
            platform: 'submittable',
            externalId: 'user123',
          })
          .returning(),
      );
      expect(inserted).toBeDefined();

      // SELECT
      const rows = await withTestRls({ userId: userA.id }, (tx) =>
        tx
          .select()
          .from(writerProfiles)
          .where(eq(writerProfiles.id, inserted.id)),
      );
      expect(rows).toHaveLength(1);

      // UPDATE
      const [updated] = await withTestRls({ userId: userA.id }, (tx) =>
        tx
          .update(writerProfiles)
          .set({ externalId: 'user456' })
          .where(eq(writerProfiles.id, inserted.id))
          .returning(),
      );
      expect(updated.externalId).toBe('user456');

      // DELETE
      const [deleted] = await withTestRls({ userId: userA.id }, (tx) =>
        tx
          .delete(writerProfiles)
          .where(eq(writerProfiles.id, inserted.id))
          .returning(),
      );
      expect(deleted).toBeDefined();
    });

    it("user cannot see another user's profiles", async () => {
      const profileA = await createWriterProfile(userA.id, {
        platform: 'duotrope',
      });

      const rows = await withTestRls({ userId: userB.id }, (tx) =>
        tx
          .select()
          .from(writerProfiles)
          .where(eq(writerProfiles.id, profileA.id)),
      );
      expect(rows).toHaveLength(0);
    });

    it('unique constraint on (user_id, platform)', async () => {
      const admin = getAdminPool();
      // First insert should succeed
      await admin.query(
        `INSERT INTO writer_profiles (user_id, platform)
         VALUES ($1, 'chillsubs')`,
        [userA.id],
      );
      // Second insert with same user + platform should fail
      await expect(
        admin.query(
          `INSERT INTO writer_profiles (user_id, platform)
           VALUES ($1, 'chillsubs')`,
          [userA.id],
        ),
      ).rejects.toThrow(/writer_profiles_user_platform_unique/);
    });
  });
});
