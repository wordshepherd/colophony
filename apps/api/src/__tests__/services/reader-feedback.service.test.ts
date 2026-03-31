import { describe, it, expect, beforeAll, afterEach, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import { drizzle } from 'drizzle-orm/node-postgres';
import { globalSetup, getAdminPool } from '../rls/helpers/db-setup.js';
import type { DrizzleDb } from '../rls/helpers/db-setup.js';
import { truncateAllTables } from '../rls/helpers/cleanup.js';
import { withTestRls } from '../rls/helpers/rls-context.js';
import {
  createUser,
  createOrganization,
  createOrgMember,
  createSubmission,
} from '../rls/helpers/factories.js';
import {
  readerFeedbackService,
  CrossOrgSubmissionError,
  ReaderFeedbackNotEnabledError,
} from '../../services/reader-feedback.service.js';
import { ForbiddenError } from '../../services/errors.js';
import { AuditActions, AuditResources } from '@colophony/types';
import type { ServiceContext } from '../../services/types.js';

async function withAdminTx<T>(fn: (tx: DrizzleDb) => Promise<T>): Promise<T> {
  const pool = getAdminPool();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const tx = drizzle(client) as DrizzleDb;
    const result = await fn(tx);
    await client.query('ROLLBACK');
    return result;
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

beforeAll(async () => {
  await globalSetup();
});

afterEach(async () => {
  await truncateAllTables();
});

describe('readerFeedbackService — integration', () => {
  async function setupOrgWithFeedback() {
    const org = await createOrganization({
      settings: {
        readerFeedbackEnabled: true,
        readerFeedbackTags: ['engaging', 'well-written', 'needs-work'],
      },
    });
    const editor = await createUser();
    const submitter = await createUser();
    await createOrgMember(org.id, editor.id, { roles: ['EDITOR'] });
    await createOrgMember(org.id, submitter.id);
    const submission = await createSubmission(org.id, submitter.id);
    return { org, editor, submitter, submission };
  }

  describe('CRUD with org context', () => {
    it('creates feedback on a submission', async () => {
      const { org, editor, submission } = await setupOrgWithFeedback();

      const fb = await withTestRls({ orgId: org.id }, async (tx) => {
        return readerFeedbackService.create(tx, org.id, {
          submissionId: submission.id,
          reviewerUserId: editor.id,
          tags: ['engaging'],
          comment: 'Great opening',
          isForwardable: true,
        });
      });

      expect(fb.organizationId).toBe(org.id);
      expect(fb.submissionId).toBe(submission.id);
      expect(fb.tags).toEqual(['engaging']);
      expect(fb.comment).toBe('Great opening');
      expect(fb.isForwardable).toBe(true);
      expect(fb.forwardedAt).toBeNull();
    });

    it('lists feedback for a submission', async () => {
      const { org, editor, submission } = await setupOrgWithFeedback();

      await withTestRls({ orgId: org.id }, async (tx) => {
        await readerFeedbackService.create(tx, org.id, {
          submissionId: submission.id,
          reviewerUserId: editor.id,
          tags: ['engaging'],
        });
        await readerFeedbackService.create(tx, org.id, {
          submissionId: submission.id,
          reviewerUserId: editor.id,
          tags: ['well-written'],
        });
      });

      const listed = await withTestRls({ orgId: org.id }, async (tx) => {
        return readerFeedbackService.list(tx, org.id, {
          submissionId: submission.id,
          page: 1,
          limit: 20,
        });
      });

      expect(listed.items).toHaveLength(2);
      expect(listed.total).toBe(2);
    });

    it('gets feedback by ID with org filter', async () => {
      const { org, editor, submission } = await setupOrgWithFeedback();

      const fb = await withTestRls({ orgId: org.id }, async (tx) => {
        return readerFeedbackService.create(tx, org.id, {
          submissionId: submission.id,
          reviewerUserId: editor.id,
          tags: [],
        });
      });

      const found = await withTestRls({ orgId: org.id }, async (tx) => {
        return readerFeedbackService.getById(tx, org.id, fb.id);
      });

      expect(found).not.toBeNull();
      expect(found.id).toBe(fb.id);
    });

    it('deletes feedback', async () => {
      const { org, editor, submission } = await setupOrgWithFeedback();

      const fb = await withTestRls({ orgId: org.id }, async (tx) => {
        return readerFeedbackService.create(tx, org.id, {
          submissionId: submission.id,
          reviewerUserId: editor.id,
          tags: [],
        });
      });

      const deleted = await withTestRls({ orgId: org.id }, async (tx) => {
        return readerFeedbackService.delete(tx, org.id, fb.id);
      });

      expect(deleted).not.toBeNull();
    });
  });

  describe('forward flow', () => {
    it('forwards forwardable feedback', async () => {
      const { org, editor, submission } = await setupOrgWithFeedback();

      const fb = await withTestRls({ orgId: org.id }, async (tx) => {
        return readerFeedbackService.create(tx, org.id, {
          submissionId: submission.id,
          reviewerUserId: editor.id,
          tags: ['engaging'],
          isForwardable: true,
        });
      });

      const forwarded = await withTestRls({ orgId: org.id }, async (tx) => {
        return readerFeedbackService.forward(tx, org.id, fb.id, editor.id);
      });

      expect(forwarded).not.toBeNull();
      expect(forwarded.forwardedAt).not.toBeNull();
      expect(forwarded.forwardedBy).toBe(editor.id);
    });
  });

  describe('RLS org isolation', () => {
    it('org B cannot see org A feedback', async () => {
      const { org: orgA, editor, submission } = await setupOrgWithFeedback();
      const orgB = await createOrganization({
        settings: { readerFeedbackEnabled: true, readerFeedbackTags: [] },
      });

      await withTestRls({ orgId: orgA.id }, async (tx) => {
        await readerFeedbackService.create(tx, orgA.id, {
          submissionId: submission.id,
          reviewerUserId: editor.id,
          tags: [],
        });
      });

      const orgBList = await withTestRls({ orgId: orgB.id }, async (tx) => {
        return readerFeedbackService.list(tx, orgB.id, {
          submissionId: submission.id,
          page: 1,
          limit: 20,
        });
      });

      expect(orgBList.items).toHaveLength(0);
    });
  });

  describe('writer view (forwarded only)', () => {
    it('returns only forwarded feedback for the submitter', async () => {
      const { org, editor, submitter, submission } =
        await setupOrgWithFeedback();

      // Create two feedback items: one forwarded, one not
      await withTestRls({ orgId: org.id }, async (tx) => {
        await readerFeedbackService.create(tx, org.id, {
          submissionId: submission.id,
          reviewerUserId: editor.id,
          tags: ['engaging'],
          isForwardable: true,
        });
        await readerFeedbackService.create(tx, org.id, {
          submissionId: submission.id,
          reviewerUserId: editor.id,
          tags: ['needs-work'],
          isForwardable: false,
        });
      });

      // Forward the first one
      const allFb = await withTestRls({ orgId: org.id }, async (tx) => {
        return readerFeedbackService.list(tx, org.id, {
          submissionId: submission.id,
          page: 1,
          limit: 20,
        });
      });
      const forwardable = allFb.items.find((f) => f.isForwardable);

      await withTestRls({ orgId: org.id }, async (tx) => {
        await readerFeedbackService.forward(
          tx,
          org.id,
          forwardable!.id,
          editor.id,
        );
      });

      // Writer should see only forwarded feedback
      const writerView = await withTestRls(
        { userId: submitter.id },
        async (tx) => {
          return readerFeedbackService.listForWriter(
            tx,
            submitter.id,
            submission.id,
            1,
            20,
          );
        },
      );

      expect(writerView.items).toHaveLength(1);
      expect(writerView.items[0].tags).toEqual(['engaging']);
      // Verify anonymization: no reviewerUserId field
      expect('reviewerUserId' in writerView.items[0]).toBe(false);
    });
  });

  describe('listForwardedForSubmission', () => {
    it('returns only forwarded items with anonymized shape', async () => {
      const { org, editor, submission } = await setupOrgWithFeedback();

      // Create 3 feedback items: 2 forwarded, 1 not
      await withTestRls({ orgId: org.id }, async (tx) => {
        const fb1 = await readerFeedbackService.create(tx, org.id, {
          submissionId: submission.id,
          reviewerUserId: editor.id,
          tags: ['engaging'],
          comment: 'Good pacing',
          isForwardable: true,
        });
        await readerFeedbackService.create(tx, org.id, {
          submissionId: submission.id,
          reviewerUserId: editor.id,
          tags: ['needs-work'],
          comment: 'Unclear ending',
          isForwardable: true,
        });
        await readerFeedbackService.create(tx, org.id, {
          submissionId: submission.id,
          reviewerUserId: editor.id,
          tags: ['well-written'],
          isForwardable: false,
        });

        // Forward fb1
        await readerFeedbackService.forward(tx, org.id, fb1.id, editor.id);
      });

      // Forward fb2
      const allFb = await withTestRls({ orgId: org.id }, async (tx) => {
        return readerFeedbackService.list(tx, org.id, {
          submissionId: submission.id,
          page: 1,
          limit: 20,
        });
      });
      const fb2 = allFb.items.find(
        (f) => f.tags.includes('needs-work') && f.isForwardable,
      );
      if (fb2) {
        await withTestRls({ orgId: org.id }, async (tx) => {
          await readerFeedbackService.forward(tx, org.id, fb2.id, editor.id);
        });
      }

      const forwarded = await withTestRls({ orgId: org.id }, async (tx) => {
        return readerFeedbackService.listForwardedForSubmission(
          tx,
          org.id,
          submission.id,
        );
      });

      expect(forwarded).toHaveLength(2);
      // Verify anonymized shape: only tags + comment
      for (const item of forwarded) {
        expect(item).toHaveProperty('tags');
        expect(item).toHaveProperty('comment');
        expect(item).not.toHaveProperty('reviewerUserId');
        expect(item).not.toHaveProperty('id');
        expect(item).not.toHaveProperty('forwardedBy');
      }
    });

    it('returns empty array when no feedback exists', async () => {
      const { org, submission } = await setupOrgWithFeedback();

      const result = await withTestRls({ orgId: org.id }, async (tx) => {
        return readerFeedbackService.listForwardedForSubmission(
          tx,
          org.id,
          submission.id,
        );
      });

      expect(result).toEqual([]);
    });

    it('filters by orgId (cross-org isolation)', async () => {
      const { org: orgA, editor, submission } = await setupOrgWithFeedback();
      const orgB = await createOrganization({
        settings: { readerFeedbackEnabled: true, readerFeedbackTags: [] },
      });

      // Create and forward feedback in orgA
      await withTestRls({ orgId: orgA.id }, async (tx) => {
        const fb = await readerFeedbackService.create(tx, orgA.id, {
          submissionId: submission.id,
          reviewerUserId: editor.id,
          tags: ['engaging'],
          isForwardable: true,
        });
        await readerFeedbackService.forward(tx, orgA.id, fb.id, editor.id);
      });

      // orgB should not see orgA's feedback
      const result = await withTestRls({ orgId: orgB.id }, async (tx) => {
        return readerFeedbackService.listForwardedForSubmission(
          tx,
          orgB.id,
          submission.id,
        );
      });

      expect(result).toEqual([]);
    });
  });

  describe('listIncludableForSubmission', () => {
    it('includes forwardable + already forwarded items', async () => {
      const { org, editor, submission } = await setupOrgWithFeedback();

      await withTestRls({ orgId: org.id }, async (tx) => {
        // Forwardable but not yet forwarded
        await readerFeedbackService.create(tx, org.id, {
          submissionId: submission.id,
          reviewerUserId: editor.id,
          tags: ['engaging'],
          isForwardable: true,
        });
        // Already forwarded
        const fb2 = await readerFeedbackService.create(tx, org.id, {
          submissionId: submission.id,
          reviewerUserId: editor.id,
          tags: ['well-written'],
          isForwardable: true,
        });
        await readerFeedbackService.forward(tx, org.id, fb2.id, editor.id);
        // Not forwardable, not forwarded — should be excluded
        await readerFeedbackService.create(tx, org.id, {
          submissionId: submission.id,
          reviewerUserId: editor.id,
          tags: ['needs-work'],
          isForwardable: false,
        });
      });

      const result = await withTestRls({ orgId: org.id }, async (tx) => {
        return readerFeedbackService.listIncludableForSubmission(
          tx,
          org.id,
          submission.id,
        );
      });

      expect(result).toHaveLength(2);
      const tags = result.map((r) => r.tags).flat();
      expect(tags).toContain('engaging');
      expect(tags).toContain('well-written');
      expect(tags).not.toContain('needs-work');
    });
  });

  describe('bulkForwardForSubmission', () => {
    it('forwards all forwardable unfowarded items', async () => {
      const { org, editor, submission } = await setupOrgWithFeedback();

      await withTestRls({ orgId: org.id }, async (tx) => {
        await readerFeedbackService.create(tx, org.id, {
          submissionId: submission.id,
          reviewerUserId: editor.id,
          tags: ['engaging'],
          isForwardable: true,
        });
        await readerFeedbackService.create(tx, org.id, {
          submissionId: submission.id,
          reviewerUserId: editor.id,
          tags: ['well-written'],
          isForwardable: true,
        });
        await readerFeedbackService.create(tx, org.id, {
          submissionId: submission.id,
          reviewerUserId: editor.id,
          tags: ['needs-work'],
          isForwardable: false,
        });
      });

      const forwarded = await withTestRls({ orgId: org.id }, async (tx) => {
        return readerFeedbackService.bulkForwardForSubmission(
          tx,
          org.id,
          submission.id,
          editor.id,
        );
      });

      expect(forwarded).toHaveLength(2);
      for (const row of forwarded) {
        expect(row.forwardedAt).not.toBeNull();
        expect(row.forwardedBy).toBe(editor.id);
      }
    });

    it('is idempotent — skips already forwarded items', async () => {
      const { org, editor, submission } = await setupOrgWithFeedback();

      await withTestRls({ orgId: org.id }, async (tx) => {
        const fb = await readerFeedbackService.create(tx, org.id, {
          submissionId: submission.id,
          reviewerUserId: editor.id,
          tags: ['engaging'],
          isForwardable: true,
        });
        await readerFeedbackService.forward(tx, org.id, fb.id, editor.id);
      });

      const result = await withTestRls({ orgId: org.id }, async (tx) => {
        return readerFeedbackService.bulkForwardForSubmission(
          tx,
          org.id,
          submission.id,
          editor.id,
        );
      });

      expect(result).toHaveLength(0);
    });
  });

  describe('bulkForwardWithAudit', () => {
    it('logs audit event with count', async () => {
      const { org, editor, submission } = await setupOrgWithFeedback();

      await withTestRls({ orgId: org.id }, async (tx) => {
        await readerFeedbackService.create(tx, org.id, {
          submissionId: submission.id,
          reviewerUserId: editor.id,
          tags: ['engaging'],
          isForwardable: true,
        });
      });

      await withAdminTx(async (tx) => {
        const auditFn = vi.fn().mockResolvedValue(undefined);
        const ctx: ServiceContext = {
          tx,
          actor: { userId: editor.id, orgId: org.id, roles: ['EDITOR'] },
          audit: auditFn,
        };

        const count = await readerFeedbackService.bulkForwardWithAudit(
          ctx,
          submission.id,
        );

        expect(count).toBe(1);
        expect(auditFn).toHaveBeenCalledOnce();
        expect(auditFn).toHaveBeenCalledWith(
          expect.objectContaining({
            action: AuditActions.READER_FEEDBACK_BULK_FORWARDED,
            resource: AuditResources.READER_FEEDBACK,
            resourceId: submission.id,
          }),
        );
      });
    });
  });

  describe('createWithAudit defense-in-depth', () => {
    it('rejects cross-org submission', async () => {
      const orgA = await createOrganization({
        settings: {
          readerFeedbackEnabled: true,
          readerFeedbackTags: ['engaging'],
        },
      });
      const orgB = await createOrganization();
      const editorA = await createUser();
      const submitterB = await createUser();
      await createOrgMember(orgA.id, editorA.id, { roles: ['EDITOR'] });
      await createOrgMember(orgB.id, submitterB.id);
      const submissionB = await createSubmission(orgB.id, submitterB.id);

      await withAdminTx(async (tx) => {
        const ctx: ServiceContext = {
          tx,
          actor: { userId: editorA.id, orgId: orgA.id, roles: ['EDITOR'] },
          audit: vi.fn().mockResolvedValue(undefined),
        };

        await expect(
          readerFeedbackService.createWithAudit(ctx, {
            submissionId: submissionB.id,
            tags: ['engaging'],
            isForwardable: false,
          }),
        ).rejects.toThrow(CrossOrgSubmissionError);
      });
    });

    it('rejects nonexistent submission', async () => {
      const orgA = await createOrganization({
        settings: {
          readerFeedbackEnabled: true,
          readerFeedbackTags: [],
        },
      });
      const editorA = await createUser();
      await createOrgMember(orgA.id, editorA.id, { roles: ['EDITOR'] });

      await withAdminTx(async (tx) => {
        const ctx: ServiceContext = {
          tx,
          actor: { userId: editorA.id, orgId: orgA.id, roles: ['EDITOR'] },
          audit: vi.fn().mockResolvedValue(undefined),
        };

        await expect(
          readerFeedbackService.createWithAudit(ctx, {
            submissionId: randomUUID(),
            tags: [],
            isForwardable: false,
          }),
        ).rejects.toThrow(ForbiddenError);
      });
    });

    it('rejects when feedback is disabled', async () => {
      const orgA = await createOrganization({
        settings: { readerFeedbackEnabled: false },
      });
      const editorA = await createUser();
      await createOrgMember(orgA.id, editorA.id, { roles: ['EDITOR'] });
      const submissionA = await createSubmission(orgA.id, editorA.id);

      await withAdminTx(async (tx) => {
        const ctx: ServiceContext = {
          tx,
          actor: { userId: editorA.id, orgId: orgA.id, roles: ['EDITOR'] },
          audit: vi.fn().mockResolvedValue(undefined),
        };

        await expect(
          readerFeedbackService.createWithAudit(ctx, {
            submissionId: submissionA.id,
            tags: [],
            isForwardable: false,
          }),
        ).rejects.toThrow(ReaderFeedbackNotEnabledError);
      });
    });

    it('succeeds for same-org submission and audits', async () => {
      const orgA = await createOrganization({
        settings: {
          readerFeedbackEnabled: true,
          readerFeedbackTags: ['engaging'],
        },
      });
      const editorA = await createUser();
      const submitterA = await createUser();
      await createOrgMember(orgA.id, editorA.id, { roles: ['EDITOR'] });
      await createOrgMember(orgA.id, submitterA.id);
      const submissionA = await createSubmission(orgA.id, submitterA.id);

      await withAdminTx(async (tx) => {
        const auditFn = vi.fn().mockResolvedValue(undefined);
        const ctx: ServiceContext = {
          tx,
          actor: { userId: editorA.id, orgId: orgA.id, roles: ['EDITOR'] },
          audit: auditFn,
        };

        const fb = await readerFeedbackService.createWithAudit(ctx, {
          submissionId: submissionA.id,
          tags: ['engaging'],
          isForwardable: true,
        });

        expect(fb.organizationId).toBe(orgA.id);
        expect(fb.submissionId).toBe(submissionA.id);
        expect(auditFn).toHaveBeenCalledOnce();
        expect(auditFn).toHaveBeenCalledWith(
          expect.objectContaining({
            action: AuditActions.READER_FEEDBACK_CREATED,
            resource: AuditResources.READER_FEEDBACK,
            resourceId: fb.id,
          }),
        );
      });
    });
  });
});
