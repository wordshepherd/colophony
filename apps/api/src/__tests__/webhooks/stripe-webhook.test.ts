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

// Mock Stripe — constructEvent returns the fixture event we pass in the mock setup.
// vi.hoisted runs before vi.mock's hoist, so the ref is available inside the factory.
const { mockConstructEvent } = vi.hoisted(() => ({
  mockConstructEvent: vi.fn(),
}));

vi.mock('stripe', () => ({
  default: class StripeMock {
    webhooks = { constructEvent: mockConstructEvent };
  },
}));

function adminDb() {
  return drizzle(getAdminPool());
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
    mockConstructEvent.mockReturnValue(event);

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
          eq(auditEvents.resourceId, session.id),
        ),
      );
    expect(audit).toBeDefined();

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
    mockConstructEvent.mockReturnValue(event);

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
    mockConstructEvent.mockReturnValue(event);

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
          eq(auditEvents.resourceId, session.id),
        ),
      );
    expect(audit).toBeDefined();
  });

  it('idempotency: same event twice → second returns already_processed, 1 payment row', async () => {
    const org = await createOrganization();
    const event = createCheckoutCompletedEvent({ organizationId: org.id });
    mockConstructEvent.mockReturnValue(event);

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
    mockConstructEvent.mockReturnValue(event);

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
    mockConstructEvent.mockReturnValue(event);

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
    mockConstructEvent.mockImplementation(() => {
      throw new Error('Webhook signature verification failed');
    });

    const res = await postStripe('{}', 'bad_signature');
    expect(res.statusCode).toBe(401);
    expect(res.json()).toEqual({ error: 'invalid_signature' });
  });

  it('missing stripe-signature header → 401', async () => {
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
