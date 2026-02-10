import { createContextHelpers } from '@prospector/db';
import {
  cleanDatabase,
  getAppPrisma,
  getTestPrisma,
  disconnectTestPrisma,
} from '../utils/test-context';
import {
  createOrg,
  createUserWithOrg,
  createSubmission,
} from '../utils/factories';

/**
 * Row-Level Security Integration Tests
 *
 * These tests verify that RLS policies correctly isolate data between organizations.
 * CRITICAL: If these tests fail, there is a potential data leakage vulnerability.
 *
 * NOTE: We use createContextHelpers with the appPrisma client (non-superuser)
 * because superusers bypass RLS policies. The test data is created with the
 * admin client (superuser) but RLS-protected operations use the app client.
 */
describe('Row-Level Security', () => {
  // Create context helpers bound to the non-superuser app client
  const appPrisma = getAppPrisma();
  const { withOrgContext } = createContextHelpers(appPrisma);

  beforeEach(async () => {
    await cleanDatabase();
  });

  afterAll(async () => {
    await disconnectTestPrisma();
  });

  describe('Submission isolation', () => {
    it('should only return submissions for the current organization', async () => {
      // Arrange: Create two organizations with submissions
      const org1 = await createOrg({ name: 'Org 1' });
      const org2 = await createOrg({ name: 'Org 2' });

      const user1 = await createUserWithOrg(org1.id, 'ADMIN');
      const user2 = await createUserWithOrg(org2.id, 'ADMIN');

      const submission1 = await createSubmission({
        orgId: org1.id,
        submitterId: user1.id,
        title: 'Submission for Org 1',
      });

      await createSubmission({
        orgId: org2.id,
        submitterId: user2.id,
        title: 'Submission for Org 2',
      });

      // Act: Query submissions in org1 context using non-superuser client
      const org1Submissions = await withOrgContext(
        org1.id,
        user1.id,
        async (tx) => {
          return tx.submission.findMany();
        }
      );

      // Assert: Should only see org1's submission
      expect(org1Submissions).toHaveLength(1);
      expect(org1Submissions[0].id).toBe(submission1.id);
      expect(org1Submissions[0].title).toBe('Submission for Org 1');
    });

    it('should prevent access to submissions from other organizations', async () => {
      // Arrange
      const org1 = await createOrg({ name: 'Org 1' });
      const org2 = await createOrg({ name: 'Org 2' });

      const user1 = await createUserWithOrg(org1.id, 'ADMIN');
      const user2 = await createUserWithOrg(org2.id, 'ADMIN');

      const submission2 = await createSubmission({
        orgId: org2.id,
        submitterId: user2.id,
        title: 'Secret Submission',
      });

      // Act: Try to access org2's submission from org1 context
      const result = await withOrgContext(org1.id, user1.id, async (tx) => {
        return tx.submission.findUnique({
          where: { id: submission2.id },
        });
      });

      // Assert: Should not find the submission (RLS should filter it)
      expect(result).toBeNull();
    });

    it('should prevent creating submissions in wrong organization', async () => {
      // Arrange
      const org1 = await createOrg({ name: 'Org 1' });
      const org2 = await createOrg({ name: 'Org 2' });

      const user1 = await createUserWithOrg(org1.id, 'ADMIN');

      // Act & Assert: Try to create submission for org2 while in org1 context
      // This should fail due to RLS WITH CHECK clause
      await expect(
        withOrgContext(org1.id, user1.id, async (tx) => {
          return tx.submission.create({
            data: {
              organizationId: org2.id, // Wrong org!
              submitterId: user1.id,
              title: 'Malicious submission',
              status: 'DRAFT',
            },
          });
        })
      ).rejects.toThrow();
    });
  });

  describe('RLS configuration verification', () => {
    it('should verify app_user role is NOT a superuser', async () => {
      // This test verifies that the app_user role used for RLS testing
      // is correctly configured as a non-superuser
      const result = await appPrisma.$queryRaw<Array<{ usesuper: boolean }>>`
        SELECT usesuper FROM pg_user WHERE usename = current_user
      `;

      expect(result[0].usesuper).toBe(false);
    });

    it('should verify FORCE ROW LEVEL SECURITY is enabled on submissions table', async () => {
      // This test verifies that FORCE RLS is set, which is required
      // to prevent table owners from bypassing RLS
      const adminPrisma = getTestPrisma();
      const result = await adminPrisma.$queryRaw<Array<{ relforcerowsecurity: boolean }>>`
        SELECT relforcerowsecurity FROM pg_class WHERE relname = 'submissions'
      `;

      expect(result[0].relforcerowsecurity).toBe(true);
    });
  });

  describe('Cross-org data verification', () => {
    it('should maintain complete isolation between 3+ organizations', async () => {
      // Arrange: Create multiple organizations
      const orgs = await Promise.all([
        createOrg({ name: 'Org A' }),
        createOrg({ name: 'Org B' }),
        createOrg({ name: 'Org C' }),
      ]);

      const users = await Promise.all(
        orgs.map((org) => createUserWithOrg(org.id, 'ADMIN'))
      );

      const submissions = await Promise.all(
        orgs.map((org, i) =>
          createSubmission({
            orgId: org.id,
            submitterId: users[i].id,
            title: `Submission for ${org.name}`,
          })
        )
      );

      // Act & Assert: Each org should only see their own submissions
      for (let i = 0; i < orgs.length; i++) {
        const results = await withOrgContext(
          orgs[i].id,
          users[i].id,
          async (tx) => {
            return tx.submission.findMany();
          }
        );

        expect(results).toHaveLength(1);
        expect(results[0].id).toBe(submissions[i].id);
      }
    });
  });
});
