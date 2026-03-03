import {
  describe,
  it,
  expect,
  vi,
  beforeAll,
  afterAll,
  beforeEach,
} from 'vitest';
import type { FastifyInstance } from 'fastify';
import { drizzle } from 'drizzle-orm/node-postgres';
import { eq, and } from '@colophony/db';
import { payments, stripeWebhookEvents, auditEvents } from '@colophony/db';
import {
  globalSetup,
  globalTeardown,
  getAdminPool,
} from '../rls/helpers/db-setup';
import { truncateAllTables } from '../rls/helpers/cleanup';
import {
  createOrganization,
  createUser,
  createOrgMember,
  createSubmissionPeriod,
  createSubmission,
} from '../rls/helpers/factories';
import { buildWebhookApp } from './helpers/webhook-app';
import {
  createCheckoutCompletedEvent,
  createCheckoutExpiredEvent,
  createInvalidMetadataEvent,
} from './helpers/stripe-fixtures';

// Mock the payment adapter via the registry accessor.
// The Stripe webhook handler calls getGlobalRegistry().tryResolve('payment')
// which returns a StripePaymentAdapter whose verifyWebhook() is called.
const { mockVerifyWebhook } = vi.hoisted(() => ({
  mockVerifyWebhook: vi.fn(),
}));

vi.mock('../../adapters/registry-accessor.js', () => ({
  getGlobalRegistry: () => ({
    tryResolve: (type: string) => {
      if (type === 'payment') {
        return { verifyWebhook: mockVerifyWebhook };
      }
      return null;
    },
    resolve: (type: string) => {
      if (type === 'payment') {
        return { verifyWebhook: mockVerifyWebhook };
      }
      throw new Error(`No adapter for ${type}`);
    },
  }),
}));

function adminDb() {
  return drizzle(getAdminPool());
}

/**
 * Convert a Stripe.Event fixture into the PaymentWebhookEvent format
 * that verifyWebhook() returns.
 */
function toWebhookEvent(event: {
  id: string;
  type: string;
  data: { object: unknown };
}) {
  return {
    id: event.id,
    type: event.type,
    data: event.data.object as Record<string, unknown>,
  };
}

describe('Stripe webhook integration', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    await globalSetup();
    app = await buildWebhookApp();
  });

  afterAll(async () => {
    await app.close();
    await globalTeardown();
  });

  beforeEach(async () => {
    await truncateAllTables();
    vi.clearAllMocks();
  });

  async function postStripe(body: string, signature = 'sig_test') {
    return app.inject({
      method: 'POST',
      url: '/webhooks/stripe',
      payload: body,
      headers: {
        'content-type': 'application/json',
        'stripe-signature': signature,
      },
    });
  }

  it('checkout.session.completed → payment SUCCEEDED + audit', async () => {
    const org = await createOrganization();
    const event = createCheckoutCompletedEvent({ organizationId: org.id });
    mockVerifyWebhook.mockResolvedValue(toWebhookEvent(event));

    const res = await postStripe(JSON.stringify(event));
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: 'processed' });

    const db = adminDb();
    const session = event.data.object as { id: string };
    const [payment] = await db
      .select()
      .from(payments)
      .where(eq(payments.stripeSessionId, session.id));
    expect(payment).toBeDefined();
    expect(payment.status).toBe('SUCCEEDED');
    expect(payment.organizationId).toBe(org.id);
    expect(payment.amount).toBe(2500);

    const [audit] = await db
      .select()
      .from(auditEvents)
      .where(
        and(
          eq(auditEvents.action, 'PAYMENT_SUCCEEDED'),
          eq(auditEvents.organizationId, org.id),
        ),
      );
    expect(audit).toBeDefined();
    expect(audit.resourceId).toBeNull();

    // Webhook event marked processed
    const [webhookEvent] = await db
      .select()
      .from(stripeWebhookEvents)
      .where(eq(stripeWebhookEvents.stripeId, event.id));
    expect(webhookEvent.processed).toBe(true);
  });

  it('checkout.session.completed with submissionId → payment links to submission', async () => {
    const org = await createOrganization();
    const user = await createUser();
    await createOrgMember(org.id, user.id);
    const period = await createSubmissionPeriod(org.id);
    const submission = await createSubmission(org.id, user.id, {
      submissionPeriodId: period.id,
    });

    const event = createCheckoutCompletedEvent({
      organizationId: org.id,
      submissionId: submission.id,
    });
    mockVerifyWebhook.mockResolvedValue(toWebhookEvent(event));

    const res = await postStripe(JSON.stringify(event));
    expect(res.statusCode).toBe(200);

    const db = adminDb();
    const session = event.data.object as { id: string };
    const [payment] = await db
      .select()
      .from(payments)
      .where(eq(payments.stripeSessionId, session.id));
    expect(payment.submissionId).toBe(submission.id);
  });

  it('checkout.session.expired → payment FAILED + PAYMENT_EXPIRED audit', async () => {
    const org = await createOrganization();
    const event = createCheckoutExpiredEvent({ organizationId: org.id });
    mockVerifyWebhook.mockResolvedValue(toWebhookEvent(event));

    const res = await postStripe(JSON.stringify(event));
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: 'processed' });

    const db = adminDb();
    const session = event.data.object as { id: string };
    const [payment] = await db
      .select()
      .from(payments)
      .where(eq(payments.stripeSessionId, session.id));
    expect(payment.status).toBe('FAILED');

    const [audit] = await db
      .select()
      .from(auditEvents)
      .where(
        and(
          eq(auditEvents.action, 'PAYMENT_EXPIRED'),
          eq(auditEvents.organizationId, org.id),
        ),
      );
    expect(audit).toBeDefined();
    expect(audit.resourceId).toBeNull();
  });

  it('idempotency: same event twice → second returns already_processed, 1 payment row', async () => {
    const org = await createOrganization();
    const event = createCheckoutCompletedEvent({ organizationId: org.id });
    mockVerifyWebhook.mockResolvedValue(toWebhookEvent(event));

    const res1 = await postStripe(JSON.stringify(event));
    expect(res1.statusCode).toBe(200);
    expect(res1.json()).toEqual({ status: 'processed' });

    const res2 = await postStripe(JSON.stringify(event));
    expect(res2.statusCode).toBe(200);
    expect(res2.json()).toEqual({ status: 'already_processed' });

    const db = adminDb();
    const session = event.data.object as { id: string };
    const paymentRows = await db
      .select()
      .from(payments)
      .where(eq(payments.stripeSessionId, session.id));
    expect(paymentRows).toHaveLength(1);
  });

  it('crash recovery: unprocessed event row → reprocesses', async () => {
    const org = await createOrganization();
    const event = createCheckoutCompletedEvent({ organizationId: org.id });
    mockVerifyWebhook.mockResolvedValue(toWebhookEvent(event));

    // Pre-insert webhook event with processed=false (simulates crash recovery)
    const admin = getAdminPool();
    await admin.query(
      `INSERT INTO stripe_webhook_events (id, stripe_id, type, payload, processed, received_at)
       VALUES (gen_random_uuid(), $1, $2, $3, false, now())`,
      [event.id, event.type, JSON.stringify(event)],
    );

    const res = await postStripe(JSON.stringify(event));
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: 'processed' });

    const db = adminDb();
    const session = event.data.object as { id: string };
    const [payment] = await db
      .select()
      .from(payments)
      .where(eq(payments.stripeSessionId, session.id));
    expect(payment).toBeDefined();
    expect(payment.status).toBe('SUCCEEDED');

    const [webhookEvent] = await db
      .select()
      .from(stripeWebhookEvents)
      .where(eq(stripeWebhookEvents.stripeId, event.id));
    expect(webhookEvent.processed).toBe(true);
  });

  it('invalid metadata → error recorded, event marked processed', async () => {
    const event = createInvalidMetadataEvent();
    mockVerifyWebhook.mockResolvedValue(toWebhookEvent(event));

    const res = await postStripe(JSON.stringify(event));
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: 'processed' });

    const db = adminDb();
    const [webhookEvent] = await db
      .select()
      .from(stripeWebhookEvents)
      .where(eq(stripeWebhookEvents.stripeId, event.id));
    expect(webhookEvent.processed).toBe(true);
    expect(webhookEvent.error).toBeTruthy();
  });

  it('invalid signature → 401', async () => {
    mockVerifyWebhook.mockRejectedValue(
      new Error('Webhook signature verification failed'),
    );

    const res = await postStripe('{}', 'bad_signature');
    expect(res.statusCode).toBe(401);
    expect(res.json()).toEqual({ error: 'invalid_signature' });
  });

  it('missing stripe-signature header → 401', async () => {
    mockVerifyWebhook.mockRejectedValue(
      new Error('Missing stripe-signature header'),
    );

    const res = await app.inject({
      method: 'POST',
      url: '/webhooks/stripe',
      payload: '{}',
      headers: { 'content-type': 'application/json' },
    });
    expect(res.statusCode).toBe(401);
    expect(res.json()).toEqual({ error: 'invalid_signature' });
  });
});
