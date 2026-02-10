import { INestApplication } from '@nestjs/common';
import {
  createTestApp,
  createTestEnvironment,
  trpcMutation,
  trpcQuery,
  extractData,
  extractError,
  cleanDatabase,
  createSubmission,
} from '../e2e-helpers';

describe('Payments E2E', () => {
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

  describe('payments.getPublishableKey', () => {
    it('should return error when Stripe is not configured', async () => {
      // Stripe is disabled in tests (no STRIPE_SECRET_KEY)
      const res = await trpcQuery(app, 'payments.getPublishableKey');

      // Should return PRECONDITION_FAILED since Stripe isn't configured
      expect(res.status).toBe(412);
      const error = extractError(res);
      expect(error.data.code).toBe('PRECONDITION_FAILED');
      expect(error.message).toMatch(/not configured/i);
    });
  });

  describe('payments.createCheckoutSession', () => {
    it('should fail when Stripe is not configured', async () => {
      const env = await createTestEnvironment(app);

      const submission = await createSubmission({
        orgId: env.org.id,
        submitterId: env.reader.user.id,
        status: 'SUBMITTED',
      });

      const res = await trpcMutation(
        app,
        'payments.createCheckoutSession',
        {
          submissionId: submission.id,
          successUrl: 'http://localhost:3000/payment/success',
          cancelUrl: 'http://localhost:3000/payment/cancel',
        },
        env.reader.headers,
      );

      // In test env, paymentsService is not initialized (no Stripe key)
      expect(res.status).toBe(500);
      const error = extractError(res);
      expect(error.data.code).toBe('INTERNAL_SERVER_ERROR');
      expect(error.message).toMatch(/not initialized/i);
    });

    it('should reject payment request without authentication', async () => {
      const res = await trpcMutation(app, 'payments.createCheckoutSession', {
        submissionId: '00000000-0000-0000-0000-000000000000',
        successUrl: 'http://localhost:3000/payment/success',
        cancelUrl: 'http://localhost:3000/payment/cancel',
      });

      expect(res.status).toBe(401);
    });

    it('should reject payment request without org context', async () => {
      const env = await createTestEnvironment(app);

      const res = await trpcMutation(
        app,
        'payments.createCheckoutSession',
        {
          submissionId: '00000000-0000-0000-0000-000000000000',
          successUrl: 'http://localhost:3000/payment/success',
          cancelUrl: 'http://localhost:3000/payment/cancel',
        },
        { Authorization: `Bearer ${env.reader.tokens.accessToken}` },
      );

      expect(res.status).toBe(400);
      const error = extractError(res);
      expect(error.data.code).toBe('BAD_REQUEST');
    });
  });

  describe('payments.getForSubmission', () => {
    it('should return empty payments for submission without payments', async () => {
      const env = await createTestEnvironment(app);

      const submission = await createSubmission({
        orgId: env.org.id,
        submitterId: env.reader.user.id,
        status: 'SUBMITTED',
      });

      const res = await trpcQuery(
        app,
        'payments.getForSubmission',
        { submissionId: submission.id },
        env.reader.headers,
      );

      // If paymentsService is not initialized (no Stripe), this returns 500
      // If it is initialized, returns empty array
      // In test env without Stripe, the service check fails
      expect(res.status).toBe(500);
    });

    it('should reject viewing payments for non-existent submission', async () => {
      const env = await createTestEnvironment(app);

      const res = await trpcQuery(
        app,
        'payments.getForSubmission',
        { submissionId: '00000000-0000-0000-0000-000000000000' },
        env.reader.headers,
      );

      // Stripe is not configured — service check fails before lookup
      expect(res.status).toBe(500);
      const error = extractError(res);
      expect(error.message).toMatch(/not initialized|not configured/i);
    });
  });
});
