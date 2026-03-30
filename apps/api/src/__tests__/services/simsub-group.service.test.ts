import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import { globalSetup } from '../rls/helpers/db-setup.js';
import { truncateAllTables } from '../rls/helpers/cleanup.js';
import { withTestRls } from '../rls/helpers/rls-context.js';
import {
  createUser,
  createOrganization,
  createOrgMember,
  createSubmission,
  createExternalSubmission,
} from '../rls/helpers/factories.js';
import { simsubGroupService } from '../../services/simsub-group.service.js';

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
});
