import { INestApplication } from '@nestjs/common';
import {
  createTestApp,
  createTestEnvironment,
  registerUser,
  trpcMutation,
  trpcQuery,
  authHeaders,
  extractData,
  extractError,
  cleanDatabase,
  getTestPrisma,
} from '../e2e-helpers';

describe('GDPR E2E', () => {
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

  describe('consent.grant', () => {
    it('should grant consent and create audit trail', async () => {
      const tokens = await registerUser(app, {
        email: 'consent@test.com',
        password: 'SecurePass123!',
      });

      const res = await trpcMutation(
        app,
        'consent.grant',
        { consentType: 'marketing_emails' },
        authHeaders(tokens.accessToken),
      );

      expect(res.status).toBe(200);
      const data = extractData<{
        id: string;
        consentType: string;
        granted: boolean;
      }>(res);

      expect(data.consentType).toBe('marketing_emails');
      expect(data.granted).toBe(true);

      // Verify audit trail entry was created
      const prisma = getTestPrisma();
      const auditEvents = await prisma.auditEvent.findMany({
        where: { action: 'consent.granted' },
      });
      expect(auditEvents.length).toBeGreaterThanOrEqual(1);
      const auditEntry = auditEvents.find(
        (e: { resourceId: string | null }) => e.resourceId === data.id,
      );
      expect(auditEntry).toBeDefined();
    });

    it('should re-grant previously revoked consent', async () => {
      const tokens = await registerUser(app, {
        email: 'regrant@test.com',
        password: 'SecurePass123!',
      });

      const headers = authHeaders(tokens.accessToken);

      // Grant
      await trpcMutation(
        app,
        'consent.grant',
        { consentType: 'analytics' },
        headers,
      ).expect(200);

      // Revoke
      await trpcMutation(
        app,
        'consent.revoke',
        { consentType: 'analytics' },
        headers,
      ).expect(200);

      // Re-grant
      const res = await trpcMutation(
        app,
        'consent.grant',
        { consentType: 'analytics' },
        headers,
      );

      expect(res.status).toBe(200);
      const data = extractData<{ granted: boolean }>(res);
      expect(data.granted).toBe(true);
    });
  });

  describe('consent.revoke', () => {
    it('should revoke granted consent', async () => {
      const tokens = await registerUser(app, {
        email: 'revoke@test.com',
        password: 'SecurePass123!',
      });
      const headers = authHeaders(tokens.accessToken);

      await trpcMutation(
        app,
        'consent.grant',
        { consentType: 'marketing_emails' },
        headers,
      ).expect(200);

      const res = await trpcMutation(
        app,
        'consent.revoke',
        { consentType: 'marketing_emails' },
        headers,
      );

      expect(res.status).toBe(200);
      const data = extractData<{ success: boolean }>(res);
      expect(data.success).toBe(true);
    });

    it('should handle revoking non-existent consent gracefully', async () => {
      const tokens = await registerUser(app, {
        email: 'no-consent@test.com',
        password: 'SecurePass123!',
      });

      const res = await trpcMutation(
        app,
        'consent.revoke',
        { consentType: 'nonexistent_type' },
        authHeaders(tokens.accessToken),
      );

      expect(res.status).toBe(200);
      const data = extractData<{ success: boolean; message: string }>(res);
      expect(data.success).toBe(true);
    });
  });

  describe('consent.check', () => {
    it('should return granted status for granted consent', async () => {
      const tokens = await registerUser(app, {
        email: 'check-yes@test.com',
        password: 'SecurePass123!',
      });
      const headers = authHeaders(tokens.accessToken);

      await trpcMutation(
        app,
        'consent.grant',
        { consentType: 'terms_of_service' },
        headers,
      ).expect(200);

      const res = await trpcQuery(
        app,
        'consent.check',
        { consentType: 'terms_of_service' },
        headers,
      );

      expect(res.status).toBe(200);
      const data = extractData<{ granted: boolean; consentType: string }>(res);
      expect(data.granted).toBe(true);
      expect(data.consentType).toBe('terms_of_service');
    });

    it('should return not-granted for missing consent', async () => {
      const tokens = await registerUser(app, {
        email: 'check-no@test.com',
        password: 'SecurePass123!',
      });

      const res = await trpcQuery(
        app,
        'consent.check',
        { consentType: 'marketing_emails' },
        authHeaders(tokens.accessToken),
      );

      expect(res.status).toBe(200);
      const data = extractData<{ granted: boolean }>(res);
      expect(data.granted).toBe(false);
    });
  });

  describe('consent.list', () => {
    it('should list all consents for a user', async () => {
      const tokens = await registerUser(app, {
        email: 'list-consent@test.com',
        password: 'SecurePass123!',
      });
      const headers = authHeaders(tokens.accessToken);

      await trpcMutation(
        app,
        'consent.grant',
        { consentType: 'terms_of_service' },
        headers,
      ).expect(200);

      await trpcMutation(
        app,
        'consent.grant',
        { consentType: 'marketing_emails' },
        headers,
      ).expect(200);

      const res = await trpcQuery(app, 'consent.list', undefined, headers);

      expect(res.status).toBe(200);
      const data =
        extractData<Array<{ consentType: string; granted: boolean }>>(res);

      expect(data).toHaveLength(2);
      expect(data.map((c) => c.consentType).sort()).toEqual([
        'marketing_emails',
        'terms_of_service',
      ]);
    });
  });

  describe('gdpr.createDsarRequest', () => {
    it('should create an ACCESS DSAR request', async () => {
      const tokens = await registerUser(app, {
        email: 'dsar@test.com',
        password: 'SecurePass123!',
      });

      const res = await trpcMutation(
        app,
        'gdpr.createDsarRequest',
        { type: 'ACCESS', notes: 'I want my data' },
        authHeaders(tokens.accessToken),
      );

      expect(res.status).toBe(200);
      const data = extractData<{
        id: string;
        dueAt: string;
        message: string;
      }>(res);

      expect(data.id).toBeDefined();
      expect(data.dueAt).toBeDefined();
      // GDPR requires 30-day deadline — verify dueAt is 29-31 days from now
      const dueDate = new Date(data.dueAt);
      const now = new Date();
      const daysUntilDue =
        (dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
      expect(daysUntilDue).toBeGreaterThanOrEqual(29);
      expect(daysUntilDue).toBeLessThanOrEqual(31);
      expect(data.message).toMatch(/access/i);
    });

    it('should create an ERASURE DSAR request', async () => {
      const tokens = await registerUser(app, {
        email: 'erase@test.com',
        password: 'SecurePass123!',
      });

      const res = await trpcMutation(
        app,
        'gdpr.createDsarRequest',
        { type: 'ERASURE' },
        authHeaders(tokens.accessToken),
      );

      expect(res.status).toBe(200);
      const data = extractData<{ id: string; message: string }>(res);
      expect(data.message).toMatch(/erasure/i);
    });

    it('should reject DSAR without authentication', async () => {
      const res = await trpcMutation(app, 'gdpr.createDsarRequest', {
        type: 'ACCESS',
      });

      expect(res.status).toBe(401);
    });
  });

  describe('gdpr.listDsarRequests', () => {
    it('should list user DSAR requests', async () => {
      const tokens = await registerUser(app, {
        email: 'list-dsar@test.com',
        password: 'SecurePass123!',
      });
      const headers = authHeaders(tokens.accessToken);

      await trpcMutation(
        app,
        'gdpr.createDsarRequest',
        { type: 'ACCESS' },
        headers,
      ).expect(200);

      const res = await trpcQuery(
        app,
        'gdpr.listDsarRequests',
        undefined,
        headers,
      );

      expect(res.status).toBe(200);
      const data = extractData<Array<{ id: string; type: string }>>(res);
      expect(data).toHaveLength(1);
      expect(data[0].type).toBe('ACCESS');
    });
  });

  describe('gdpr.exportData', () => {
    it('should export user data', async () => {
      const tokens = await registerUser(app, {
        email: 'export@test.com',
        password: 'SecurePass123!',
      });

      const res = await trpcQuery(
        app,
        'gdpr.exportData',
        undefined,
        authHeaders(tokens.accessToken),
      );

      expect(res.status).toBe(200);
      const data = extractData<Record<string, unknown>>(res);

      // Should contain profile data at minimum
      expect(data).toBeDefined();
      expect(typeof data).toBe('object');
    });

    it('should reject export without authentication', async () => {
      const res = await trpcQuery(app, 'gdpr.exportData');
      expect(res.status).toBe(401);
    });
  });

  describe('gdpr.requestDeletion', () => {
    it('should create a deletion request with confirmation', async () => {
      const tokens = await registerUser(app, {
        email: 'delete-me@test.com',
        password: 'SecurePass123!',
      });

      const res = await trpcMutation(
        app,
        'gdpr.requestDeletion',
        {
          confirmation: 'DELETE_MY_ACCOUNT',
          reason: 'Testing deletion',
        },
        authHeaders(tokens.accessToken),
      );

      expect(res.status).toBe(200);
      const data = extractData<{ id: string; message: string }>(res);
      expect(data.id).toBeDefined();
      expect(data.message).toMatch(/deletion/i);
    });

    it('should reject deletion without proper confirmation', async () => {
      const tokens = await registerUser(app, {
        email: 'bad-delete@test.com',
        password: 'SecurePass123!',
      });

      const res = await trpcMutation(
        app,
        'gdpr.requestDeletion',
        { confirmation: 'WRONG_CONFIRMATION' },
        authHeaders(tokens.accessToken),
      );

      // tRPC returns Zod validation errors as BAD_REQUEST (400)
      // The confirmation field requires literal 'DELETE_MY_ACCOUNT' — Zod rejects mismatches
      expect(res.status).toBe(400);
      const error = extractError(res);
      expect(error.data.code).toBe('BAD_REQUEST');
    });
  });
});
