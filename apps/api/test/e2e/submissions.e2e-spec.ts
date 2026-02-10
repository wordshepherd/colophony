import { INestApplication } from '@nestjs/common';
import {
  createTestApp,
  createTestEnvironment,
  trpcMutation,
  trpcQuery,
  authHeaders,
  extractData,
  extractError,
  cleanDatabase,
  getTestPrisma,
  createOrg,
  registerUser,
  createSubmission,
} from '../e2e-helpers';
import { getAppPrisma } from '../utils/test-context';
import { createContextHelpers } from '@prospector/db';

describe('Submissions E2E', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await cleanDatabase();
  });

  describe('submissions.create', () => {
    it('should create a draft submission', async () => {
      const env = await createTestEnvironment(app);

      const res = await trpcMutation(
        app,
        'submissions.create',
        { title: 'My First Submission', content: 'The body of the work.' },
        env.reader.headers,
      );

      expect(res.status).toBe(200);
      const data = extractData<{
        id: string;
        title: string;
        status: string;
        submitterId: string;
      }>(res);

      expect(data.title).toBe('My First Submission');
      expect(data.status).toBe('DRAFT');
      expect(data.submitterId).toBe(env.reader.user.id);
    });

    it('should reject creation without org context', async () => {
      const env = await createTestEnvironment(app);

      // Send request with auth but NO org header
      const res = await trpcMutation(
        app,
        'submissions.create',
        { title: 'No Org', content: 'Test' },
        authHeaders(env.reader.tokens.accessToken), // no orgId
      );

      expect(res.status).toBe(400);
      const error = extractError(res);
      expect(error.data.code).toBe('BAD_REQUEST');
    });

    it('should reject creation without authentication', async () => {
      const res = await trpcMutation(app, 'submissions.create', {
        title: 'Unauthed',
        content: 'Test',
      });

      expect(res.status).toBe(401);
    });
  });

  describe('submissions.list', () => {
    it('should list submissions for the org', async () => {
      const env = await createTestEnvironment(app);
      const prisma = getTestPrisma();

      // Create submissions via factory (admin prisma)
      await createSubmission({
        orgId: env.org.id,
        submitterId: env.reader.user.id,
        title: 'Sub A',
        status: 'SUBMITTED',
      });
      await createSubmission({
        orgId: env.org.id,
        submitterId: env.reader.user.id,
        title: 'Sub B',
        status: 'DRAFT',
      });

      const res = await trpcQuery(
        app,
        'submissions.list',
        { page: 1, limit: 20 },
        env.editor.headers,
      );

      expect(res.status).toBe(200);
      const data = extractData<{
        items: Array<{ title: string; status: string }>;
        total: number;
        page: number;
        totalPages: number;
      }>(res);

      expect(data.items).toHaveLength(2);
      expect(data.total).toBe(2);
    });

    it('should filter by status', async () => {
      const env = await createTestEnvironment(app);

      await createSubmission({
        orgId: env.org.id,
        submitterId: env.reader.user.id,
        status: 'SUBMITTED',
      });
      await createSubmission({
        orgId: env.org.id,
        submitterId: env.reader.user.id,
        status: 'DRAFT',
      });

      const res = await trpcQuery(
        app,
        'submissions.list',
        { status: 'SUBMITTED', page: 1, limit: 20 },
        env.editor.headers,
      );

      expect(res.status).toBe(200);
      const data = extractData<{
        items: Array<{ status: string }>;
        total: number;
      }>(res);

      expect(data.items).toHaveLength(1);
      expect(data.items[0].status).toBe('SUBMITTED');
    });

    it('should paginate results', async () => {
      const env = await createTestEnvironment(app);

      // Create 5 submissions
      for (let i = 0; i < 5; i++) {
        await createSubmission({
          orgId: env.org.id,
          submitterId: env.reader.user.id,
          title: `Sub ${i}`,
        });
      }

      const res = await trpcQuery(
        app,
        'submissions.list',
        { page: 1, limit: 2 },
        env.editor.headers,
      );

      expect(res.status).toBe(200);
      const data = extractData<{
        items: unknown[];
        total: number;
        page: number;
        totalPages: number;
      }>(res);

      expect(data.items).toHaveLength(2);
      expect(data.total).toBe(5);
      expect(data.totalPages).toBe(3);
    });
  });

  describe('submissions.getById', () => {
    it('should get a submission by ID', async () => {
      const env = await createTestEnvironment(app);

      const submission = await createSubmission({
        orgId: env.org.id,
        submitterId: env.reader.user.id,
        title: 'Find Me',
        content: 'Detailed content here',
      });

      const res = await trpcQuery(
        app,
        'submissions.getById',
        { id: submission.id },
        env.reader.headers,
      );

      expect(res.status).toBe(200);
      const data = extractData<{
        id: string;
        title: string;
        content: string;
      }>(res);

      expect(data.id).toBe(submission.id);
      expect(data.title).toBe('Find Me');
    });

    it('should return 404 for non-existent submission', async () => {
      const env = await createTestEnvironment(app);

      const res = await trpcQuery(
        app,
        'submissions.getById',
        { id: '00000000-0000-0000-0000-000000000000' },
        env.reader.headers,
      );

      expect(res.status).toBe(404);
    });
  });

  describe('submissions.update', () => {
    it('should update a draft submission', async () => {
      const env = await createTestEnvironment(app);

      const submission = await createSubmission({
        orgId: env.org.id,
        submitterId: env.reader.user.id,
        title: 'Original Title',
        status: 'DRAFT',
      });

      const res = await trpcMutation(
        app,
        'submissions.update',
        {
          id: submission.id,
          data: { title: 'Updated Title', content: 'New content' },
        },
        env.reader.headers,
      );

      expect(res.status).toBe(200);
      const data = extractData<{ title: string }>(res);
      expect(data.title).toBe('Updated Title');
    });

    it('should reject update of non-draft submission', async () => {
      const env = await createTestEnvironment(app);

      const submission = await createSubmission({
        orgId: env.org.id,
        submitterId: env.reader.user.id,
        status: 'SUBMITTED',
      });

      const res = await trpcMutation(
        app,
        'submissions.update',
        {
          id: submission.id,
          data: { title: 'Cannot Update' },
        },
        env.reader.headers,
      );

      expect(res.status).toBe(400);
      const error = extractError(res);
      expect(error.message).toMatch(/draft/i);
    });

    it('should reject update by non-submitter', async () => {
      const env = await createTestEnvironment(app);

      const submission = await createSubmission({
        orgId: env.org.id,
        submitterId: env.reader.user.id,
        status: 'DRAFT',
      });

      // Editor tries to update someone else's draft
      const res = await trpcMutation(
        app,
        'submissions.update',
        {
          id: submission.id,
          data: { title: 'Hacked' },
        },
        env.editor.headers,
      );

      expect(res.status).toBe(403);
    });
  });

  describe('submissions.submit', () => {
    it('should submit a draft for review', async () => {
      const env = await createTestEnvironment(app);

      const submission = await createSubmission({
        orgId: env.org.id,
        submitterId: env.reader.user.id,
        status: 'DRAFT',
      });

      const res = await trpcMutation(
        app,
        'submissions.submit',
        { id: submission.id },
        env.reader.headers,
      );

      expect(res.status).toBe(200);
      const data = extractData<{ status: string }>(res);
      expect(data.status).toBe('SUBMITTED');
    });

    it('should reject submit of non-draft', async () => {
      const env = await createTestEnvironment(app);

      const submission = await createSubmission({
        orgId: env.org.id,
        submitterId: env.reader.user.id,
        status: 'SUBMITTED',
      });

      const res = await trpcMutation(
        app,
        'submissions.submit',
        { id: submission.id },
        env.reader.headers,
      );

      expect(res.status).toBe(400);
    });
  });

  describe('submissions.updateStatus (editor transitions)', () => {
    it('should transition SUBMITTED → UNDER_REVIEW', async () => {
      const env = await createTestEnvironment(app);

      const submission = await createSubmission({
        orgId: env.org.id,
        submitterId: env.reader.user.id,
        status: 'SUBMITTED',
      });

      const res = await trpcMutation(
        app,
        'submissions.updateStatus',
        {
          id: submission.id,
          data: { status: 'UNDER_REVIEW' },
        },
        env.editor.headers,
      );

      expect(res.status).toBe(200);
      const data = extractData<{ status: string }>(res);
      expect(data.status).toBe('UNDER_REVIEW');
    });

    it('should transition UNDER_REVIEW → ACCEPTED', async () => {
      const env = await createTestEnvironment(app);

      const submission = await createSubmission({
        orgId: env.org.id,
        submitterId: env.reader.user.id,
        status: 'UNDER_REVIEW',
      });

      const res = await trpcMutation(
        app,
        'submissions.updateStatus',
        {
          id: submission.id,
          data: { status: 'ACCEPTED' },
        },
        env.editor.headers,
      );

      expect(res.status).toBe(200);
      const data = extractData<{ status: string }>(res);
      expect(data.status).toBe('ACCEPTED');
    });

    it('should transition UNDER_REVIEW → REJECTED with comment', async () => {
      const env = await createTestEnvironment(app);

      const submission = await createSubmission({
        orgId: env.org.id,
        submitterId: env.reader.user.id,
        status: 'UNDER_REVIEW',
      });

      const res = await trpcMutation(
        app,
        'submissions.updateStatus',
        {
          id: submission.id,
          data: { status: 'REJECTED', comment: 'Not a good fit.' },
        },
        env.editor.headers,
      );

      expect(res.status).toBe(200);
      const data = extractData<{ status: string }>(res);
      expect(data.status).toBe('REJECTED');
    });

    it('should reject invalid status transition', async () => {
      const env = await createTestEnvironment(app);

      const submission = await createSubmission({
        orgId: env.org.id,
        submitterId: env.reader.user.id,
        status: 'DRAFT',
      });

      // Editors cannot transition from DRAFT (must be submitted first)
      const res = await trpcMutation(
        app,
        'submissions.updateStatus',
        {
          id: submission.id,
          data: { status: 'ACCEPTED' },
        },
        env.editor.headers,
      );

      expect(res.status).toBe(400);
      const error = extractError(res);
      expect(error.message).toMatch(/cannot transition/i);
    });

    it('should reject DRAFT → ACCEPTED (must go through SUBMITTED)', async () => {
      const env = await createTestEnvironment(app);

      const submission = await createSubmission({
        orgId: env.org.id,
        submitterId: env.reader.user.id,
        status: 'DRAFT',
      });

      const res = await trpcMutation(
        app,
        'submissions.updateStatus',
        {
          id: submission.id,
          data: { status: 'ACCEPTED' },
        },
        env.editor.headers,
      );

      expect(res.status).toBe(400);
      const error = extractError(res);
      expect(error.message).toMatch(/cannot transition/i);
    });

    it('should reject REJECTED → UNDER_REVIEW (terminal state)', async () => {
      const env = await createTestEnvironment(app);

      const submission = await createSubmission({
        orgId: env.org.id,
        submitterId: env.reader.user.id,
        status: 'REJECTED',
      });

      const res = await trpcMutation(
        app,
        'submissions.updateStatus',
        {
          id: submission.id,
          data: { status: 'UNDER_REVIEW' },
        },
        env.editor.headers,
      );

      expect(res.status).toBe(400);
      const error = extractError(res);
      expect(error.message).toMatch(/cannot transition/i);
    });

    it('should reject ACCEPTED → DRAFT (terminal state)', async () => {
      const env = await createTestEnvironment(app);

      const submission = await createSubmission({
        orgId: env.org.id,
        submitterId: env.reader.user.id,
        status: 'ACCEPTED',
      });

      const res = await trpcMutation(
        app,
        'submissions.updateStatus',
        {
          id: submission.id,
          data: { status: 'DRAFT' },
        },
        env.editor.headers,
      );

      expect(res.status).toBe(400);
      const error = extractError(res);
      expect(error.message).toMatch(/cannot transition/i);
    });

    it('should reject status transition by reader', async () => {
      const env = await createTestEnvironment(app);

      const submission = await createSubmission({
        orgId: env.org.id,
        submitterId: env.reader.user.id,
        status: 'SUBMITTED',
      });

      const res = await trpcMutation(
        app,
        'submissions.updateStatus',
        {
          id: submission.id,
          data: { status: 'UNDER_REVIEW' },
        },
        env.reader.headers,
      );

      expect(res.status).toBe(403);
      const error = extractError(res);
      expect(error.data.code).toBe('FORBIDDEN');
    });
  });

  describe('cross-org isolation', () => {
    it('should reject requests with org the user is not a member of', async () => {
      const env = await createTestEnvironment(app);
      const prisma = getTestPrisma();

      // Create a second org (user is NOT a member)
      const org2 = await createOrg({ name: 'Other Org', slug: 'other-org' });

      // Try to access org2 with env.reader's token (not a member of org2)
      const res = await trpcQuery(
        app,
        'submissions.list',
        { page: 1, limit: 20 },
        authHeaders(env.reader.tokens.accessToken, org2.id),
      );

      // Should fail because user is not a member of org2
      expect(res.status).toBe(400);
      const error = extractError(res);
      expect(error.message).toMatch(/organization context/i);
    });

    it('should enforce RLS at the database level (app_user cannot see other org data)', async () => {
      const prisma = getTestPrisma();
      const appPrisma = getAppPrisma();
      const { withOrgContext } = createContextHelpers(appPrisma);

      // Create two orgs
      const org1 = await createOrg({ name: 'RLS Org 1', slug: 'rls-org-1' });
      const org2 = await createOrg({ name: 'RLS Org 2', slug: 'rls-org-2' });

      // Create a user in each org (via admin prisma)
      const user1 = await prisma.user.create({
        data: {
          email: `rls-user1-${Date.now()}@test.com`,
          passwordHash: 'not-used-for-rls-test',
        },
      });
      const user2 = await prisma.user.create({
        data: {
          email: `rls-user2-${Date.now()}@test.com`,
          passwordHash: 'not-used-for-rls-test',
        },
      });

      await prisma.organizationMember.createMany({
        data: [
          { userId: user1.id, organizationId: org1.id, role: 'READER' },
          { userId: user2.id, organizationId: org2.id, role: 'READER' },
        ],
      });

      // Create a submission in each org (via admin prisma, bypasses RLS)
      const sub1 = await createSubmission({
        orgId: org1.id,
        submitterId: user1.id,
        title: 'Org1 Submission',
      });
      const sub2 = await createSubmission({
        orgId: org2.id,
        submitterId: user2.id,
        title: 'Org2 Submission',
      });

      // Query via app_user (non-superuser) with org1 context — should only see org1
      const org1Results = await withOrgContext(
        org1.id,
        user1.id,
        async (tx) => {
          return tx.submission.findMany();
        },
      );

      expect(org1Results).toHaveLength(1);
      expect(org1Results[0].id).toBe(sub1.id);
      expect(org1Results[0].title).toBe('Org1 Submission');

      // Query via app_user with org2 context — should only see org2
      const org2Results = await withOrgContext(
        org2.id,
        user2.id,
        async (tx) => {
          return tx.submission.findMany();
        },
      );

      expect(org2Results).toHaveLength(1);
      expect(org2Results[0].id).toBe(sub2.id);
      expect(org2Results[0].title).toBe('Org2 Submission');
    });
  });

  describe('submissions.mySubmissions', () => {
    it("should list only the current user's submissions", async () => {
      const env = await createTestEnvironment(app);

      // Create submissions for reader and editor
      await createSubmission({
        orgId: env.org.id,
        submitterId: env.reader.user.id,
        title: 'Reader Sub',
      });
      await createSubmission({
        orgId: env.org.id,
        submitterId: env.editor.user.id,
        title: 'Editor Sub',
      });

      const res = await trpcQuery(
        app,
        'submissions.mySubmissions',
        { page: 1, limit: 20 },
        env.reader.headers,
      );

      expect(res.status).toBe(200);
      const data = extractData<{
        items: Array<{ title: string }>;
        total: number;
      }>(res);

      expect(data.items).toHaveLength(1);
      expect(data.items[0].title).toBe('Reader Sub');
    });
  });

  describe('submissions.withdraw', () => {
    it('should withdraw a submitted submission', async () => {
      const env = await createTestEnvironment(app);

      const submission = await createSubmission({
        orgId: env.org.id,
        submitterId: env.reader.user.id,
        status: 'SUBMITTED',
      });

      const res = await trpcMutation(
        app,
        'submissions.withdraw',
        { id: submission.id },
        env.reader.headers,
      );

      expect(res.status).toBe(200);
      const data = extractData<{ status: string }>(res);
      expect(data.status).toBe('WITHDRAWN');
    });

    it('should reject withdrawal by non-submitter', async () => {
      const env = await createTestEnvironment(app);

      const submission = await createSubmission({
        orgId: env.org.id,
        submitterId: env.reader.user.id,
        status: 'SUBMITTED',
      });

      const res = await trpcMutation(
        app,
        'submissions.withdraw',
        { id: submission.id },
        env.editor.headers,
      );

      expect(res.status).toBe(403);
    });
  });

  describe('submissions.delete', () => {
    it('should delete a draft submission', async () => {
      const env = await createTestEnvironment(app);

      const submission = await createSubmission({
        orgId: env.org.id,
        submitterId: env.reader.user.id,
        status: 'DRAFT',
      });

      const res = await trpcMutation(
        app,
        'submissions.delete',
        { id: submission.id },
        env.reader.headers,
      );

      expect(res.status).toBe(200);

      // Verify it's actually deleted
      const getRes = await trpcQuery(
        app,
        'submissions.getById',
        { id: submission.id },
        env.reader.headers,
      );
      expect(getRes.status).toBe(404);
    });

    it('should reject deletion of non-draft submission', async () => {
      const env = await createTestEnvironment(app);

      const submission = await createSubmission({
        orgId: env.org.id,
        submitterId: env.reader.user.id,
        status: 'SUBMITTED',
      });

      const res = await trpcMutation(
        app,
        'submissions.delete',
        { id: submission.id },
        env.reader.headers,
      );

      expect(res.status).toBe(400);
    });
  });
});
