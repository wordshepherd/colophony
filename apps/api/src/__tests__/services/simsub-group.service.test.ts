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
  createExternalSubmission,
  createManuscript,
} from '../rls/helpers/factories.js';
import {
  simsubGroupService,
  SimsubGroupNotFoundError,
  SimsubGroupSubmissionNotFoundError,
} from '../../services/simsub-group.service.js';
import { ForbiddenError } from '../../services/errors.js';
import { AuditActions, AuditResources } from '@colophony/types';
import type { UserServiceContext } from '../../services/types.js';

function adminDb() {
  return drizzle(getAdminPool()) as DrizzleDb;
}

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

describe('simsubGroupService — integration', () => {
  describe('CRUD lifecycle', () => {
    it('creates, lists, and deletes a sim-sub group', async () => {
      const user = await createUser();

      const group = await withTestRls({ userId: user.id }, async (tx) => {
        return simsubGroupService.create(tx, user.id, {
          name: 'My Sim-Sub Group',
          notes: 'Test notes',
        });
      });

      expect(group.name).toBe('My Sim-Sub Group');
      expect(group.userId).toBe(user.id);
      expect(group.status).toBe('ACTIVE');

      const listed = await withTestRls({ userId: user.id }, async (tx) => {
        return simsubGroupService.list(tx, user.id, { page: 1, limit: 20 });
      });

      expect(listed.items).toHaveLength(1);
      expect(listed.total).toBe(1);

      const deleted = await withTestRls({ userId: user.id }, async (tx) => {
        return simsubGroupService.delete(tx, group.id);
      });

      expect(deleted).not.toBeNull();
      expect(deleted.id).toBe(group.id);
    });

    it('filters by status', async () => {
      const user = await createUser();

      await withTestRls({ userId: user.id }, async (tx) => {
        await simsubGroupService.create(tx, user.id, { name: 'Active' });
        const group2 = await simsubGroupService.create(tx, user.id, {
          name: 'Resolved',
        });
        await simsubGroupService.update(tx, group2.id, {
          status: 'RESOLVED',
        });
      });

      const active = await withTestRls({ userId: user.id }, async (tx) => {
        return simsubGroupService.list(tx, user.id, {
          status: 'ACTIVE',
          page: 1,
          limit: 20,
        });
      });

      expect(active.items).toHaveLength(1);
      expect(active.items[0].name).toBe('Active');
    });
  });

  describe('RLS isolation', () => {
    it('user A cannot see user B groups', async () => {
      const userA = await createUser();
      const userB = await createUser();

      await withTestRls({ userId: userA.id }, async (tx) => {
        await simsubGroupService.create(tx, userA.id, { name: 'A Group' });
      });
      await withTestRls({ userId: userB.id }, async (tx) => {
        await simsubGroupService.create(tx, userB.id, { name: 'B Group' });
      });

      const aGroups = await withTestRls({ userId: userA.id }, async (tx) => {
        return simsubGroupService.list(tx, userA.id, { page: 1, limit: 20 });
      });

      expect(aGroups.items).toHaveLength(1);
      expect(aGroups.items[0].name).toBe('A Group');
    });
  });

  describe('junction add/remove', () => {
    it('adds and removes a native submission from a group', async () => {
      const user = await createUser();
      const org = await createOrganization();
      await createOrgMember(org.id, user.id);
      const submission = await createSubmission(org.id, user.id);

      const group = await withTestRls({ userId: user.id }, async (tx) => {
        return simsubGroupService.create(tx, user.id, {
          name: 'Sub Group',
        });
      });

      // Add submission
      const junction = await withTestRls({ userId: user.id }, async (tx) => {
        return simsubGroupService.addSubmission(tx, user.id, {
          groupId: group.id,
          submissionId: submission.id,
        });
      });

      expect(junction.submissionId).toBe(submission.id);
      expect(junction.externalSubmissionId).toBeNull();

      // getDetail includes submissions
      const detail = await withTestRls({ userId: user.id }, async (tx) => {
        return simsubGroupService.getDetail(tx, group.id);
      });
      expect(detail).not.toBeNull();
      expect(detail!.submissions).toHaveLength(1);

      // Remove
      const removed = await withTestRls({ userId: user.id }, async (tx) => {
        return simsubGroupService.removeSubmission(tx, {
          groupId: group.id,
          submissionId: submission.id,
        });
      });
      expect(removed).not.toBeNull();
    });

    it('adds an external submission to a group', async () => {
      const user = await createUser();
      const extSub = await createExternalSubmission(user.id);

      const group = await withTestRls({ userId: user.id }, async (tx) => {
        return simsubGroupService.create(tx, user.id, { name: 'Ext Group' });
      });

      const junction = await withTestRls({ userId: user.id }, async (tx) => {
        return simsubGroupService.addSubmission(tx, user.id, {
          groupId: group.id,
          externalSubmissionId: extSub.id,
        });
      });

      expect(junction.externalSubmissionId).toBe(extSub.id);
      expect(junction.submissionId).toBeNull();
    });
  });

  describe('status transitions', () => {
    it('allows ACTIVE → RESOLVED', async () => {
      const user = await createUser();

      const group = await withTestRls({ userId: user.id }, async (tx) => {
        return simsubGroupService.create(tx, user.id, { name: 'Active' });
      });

      const updated = await withTestRls({ userId: user.id }, async (tx) => {
        return simsubGroupService.update(tx, group.id, {
          status: 'RESOLVED',
        });
      });

      expect(updated.status).toBe('RESOLVED');
    });

    it('allows ACTIVE → WITHDRAWN', async () => {
      const user = await createUser();

      const group = await withTestRls({ userId: user.id }, async (tx) => {
        return simsubGroupService.create(tx, user.id, { name: 'Active' });
      });

      const updated = await withTestRls({ userId: user.id }, async (tx) => {
        return simsubGroupService.update(tx, group.id, {
          status: 'WITHDRAWN',
        });
      });

      expect(updated.status).toBe('WITHDRAWN');
    });
  });

  describe('createWithAudit defense-in-depth', () => {
    it("rejects other user's manuscript", async () => {
      const userA = await createUser();
      const userB = await createUser();
      const manuscriptB = await createManuscript(userB.id);

      await withAdminTx(async (tx) => {
        const ctx: UserServiceContext = {
          tx,
          userId: userA.id,
          audit: vi.fn().mockResolvedValue(undefined),
        };

        await expect(
          simsubGroupService.createWithAudit(ctx, {
            name: 'Test Group',
            manuscriptId: manuscriptB.id,
          }),
        ).rejects.toThrow(ForbiddenError);
      });
    });

    it('succeeds with own manuscript and audits', async () => {
      const userA = await createUser();
      const manuscriptA = await createManuscript(userA.id);

      await withAdminTx(async (tx) => {
        const auditFn = vi.fn().mockResolvedValue(undefined);
        const ctx: UserServiceContext = {
          tx,
          userId: userA.id,
          audit: auditFn,
        };

        const group = await simsubGroupService.createWithAudit(ctx, {
          name: 'My Group',
          manuscriptId: manuscriptA.id,
        });

        expect(group.name).toBe('My Group');
        expect(group.userId).toBe(userA.id);
        expect(auditFn).toHaveBeenCalledOnce();
        expect(auditFn).toHaveBeenCalledWith(
          expect.objectContaining({
            action: AuditActions.SIMSUB_GROUP_CREATED,
            resource: AuditResources.SIMSUB_GROUP,
            resourceId: group.id,
          }),
        );
      });
    });
  });

  describe('addSubmissionWithAudit defense-in-depth', () => {
    it("rejects other user's group", async () => {
      const userA = await createUser();
      const userB = await createUser();
      const org = await createOrganization();
      await createOrgMember(org.id, userA.id);
      await createOrgMember(org.id, userB.id);
      const submissionA = await createSubmission(org.id, userA.id);

      // Create groupB owned by userB via committed admin connection
      const groupB = await simsubGroupService.create(adminDb(), userB.id, {
        name: 'B Group',
      });

      await withAdminTx(async (tx) => {
        const ctx: UserServiceContext = {
          tx,
          userId: userA.id,
          audit: vi.fn().mockResolvedValue(undefined),
        };

        await expect(
          simsubGroupService.addSubmissionWithAudit(ctx, {
            groupId: groupB.id,
            submissionId: submissionA.id,
          }),
        ).rejects.toThrow(ForbiddenError);
      });
    });

    it("rejects other user's submission", async () => {
      const userA = await createUser();
      const userB = await createUser();
      const org = await createOrganization();
      await createOrgMember(org.id, userA.id);
      await createOrgMember(org.id, userB.id);
      const submissionB = await createSubmission(org.id, userB.id);

      const groupA = await simsubGroupService.create(adminDb(), userA.id, {
        name: 'A Group',
      });

      await withAdminTx(async (tx) => {
        const ctx: UserServiceContext = {
          tx,
          userId: userA.id,
          audit: vi.fn().mockResolvedValue(undefined),
        };

        await expect(
          simsubGroupService.addSubmissionWithAudit(ctx, {
            groupId: groupA.id,
            submissionId: submissionB.id,
          }),
        ).rejects.toThrow(ForbiddenError);
      });
    });

    it("rejects other user's external submission", async () => {
      const userA = await createUser();
      const userB = await createUser();
      const extSubB = await createExternalSubmission(userB.id);

      const groupA = await simsubGroupService.create(adminDb(), userA.id, {
        name: 'A Group',
      });

      await withAdminTx(async (tx) => {
        const ctx: UserServiceContext = {
          tx,
          userId: userA.id,
          audit: vi.fn().mockResolvedValue(undefined),
        };

        await expect(
          simsubGroupService.addSubmissionWithAudit(ctx, {
            groupId: groupA.id,
            externalSubmissionId: extSubB.id,
          }),
        ).rejects.toThrow(ForbiddenError);
      });
    });

    it('rejects nonexistent group', async () => {
      const userA = await createUser();

      await withAdminTx(async (tx) => {
        const ctx: UserServiceContext = {
          tx,
          userId: userA.id,
          audit: vi.fn().mockResolvedValue(undefined),
        };

        await expect(
          simsubGroupService.addSubmissionWithAudit(ctx, {
            groupId: randomUUID(),
            submissionId: randomUUID(),
          }),
        ).rejects.toThrow(SimsubGroupNotFoundError);
      });
    });

    it('rejects nonexistent submission', async () => {
      const userA = await createUser();
      const groupA = await simsubGroupService.create(adminDb(), userA.id, {
        name: 'A Group',
      });

      await withAdminTx(async (tx) => {
        const ctx: UserServiceContext = {
          tx,
          userId: userA.id,
          audit: vi.fn().mockResolvedValue(undefined),
        };

        await expect(
          simsubGroupService.addSubmissionWithAudit(ctx, {
            groupId: groupA.id,
            submissionId: randomUUID(),
          }),
        ).rejects.toThrow(SimsubGroupSubmissionNotFoundError);
      });
    });

    it('rejects nonexistent external submission', async () => {
      const userA = await createUser();
      const groupA = await simsubGroupService.create(adminDb(), userA.id, {
        name: 'A Group',
      });

      await withAdminTx(async (tx) => {
        const ctx: UserServiceContext = {
          tx,
          userId: userA.id,
          audit: vi.fn().mockResolvedValue(undefined),
        };

        await expect(
          simsubGroupService.addSubmissionWithAudit(ctx, {
            groupId: groupA.id,
            externalSubmissionId: randomUUID(),
          }),
        ).rejects.toThrow(SimsubGroupSubmissionNotFoundError);
      });
    });

    it('succeeds with own resources and audits', async () => {
      const userA = await createUser();
      const org = await createOrganization();
      await createOrgMember(org.id, userA.id);
      const submissionA = await createSubmission(org.id, userA.id);
      const groupA = await simsubGroupService.create(adminDb(), userA.id, {
        name: 'A Group',
      });

      await withAdminTx(async (tx) => {
        const auditFn = vi.fn().mockResolvedValue(undefined);
        const ctx: UserServiceContext = {
          tx,
          userId: userA.id,
          audit: auditFn,
        };

        const junction = await simsubGroupService.addSubmissionWithAudit(ctx, {
          groupId: groupA.id,
          submissionId: submissionA.id,
        });

        expect(junction.submissionId).toBe(submissionA.id);
        expect(junction.simsubGroupId).toBe(groupA.id);
        expect(auditFn).toHaveBeenCalledOnce();
        expect(auditFn).toHaveBeenCalledWith(
          expect.objectContaining({
            action: AuditActions.SIMSUB_GROUP_SUBMISSION_ADDED,
            resource: AuditResources.SIMSUB_GROUP,
            resourceId: groupA.id,
          }),
        );
      });
    });
  });
});
