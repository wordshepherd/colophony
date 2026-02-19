import { faker } from '@faker-js/faker';
import type Stripe from 'stripe';

interface CheckoutEventOptions {
  organizationId?: string;
  submissionId?: string;
  amount?: number;
  currency?: string;
  sessionId?: string;
  eventId?: string;
  paymentIntent?: string;
}

export function createCheckoutCompletedEvent(
  opts: CheckoutEventOptions = {},
): Stripe.Event {
  // Use UUIDs for sessionId so it passes the audit_events resourceId::uuid cast.
  // Real Stripe session IDs (cs_...) would cause a Postgres type error.
  const sessionId = opts.sessionId ?? faker.string.uuid();
  const eventId = opts.eventId ?? `evt_${faker.string.alphanumeric(24)}`;
  const organizationId = opts.organizationId ?? faker.string.uuid();

  return {
    id: eventId,
    object: 'event',
    type: 'checkout.session.completed',
    api_version: '2024-12-18',
    created: Math.floor(Date.now() / 1000),
    livemode: false,
    pending_webhooks: 0,
    request: { id: null, idempotency_key: null },
    data: {
      object: {
        id: sessionId,
        object: 'checkout.session',
        amount_total: opts.amount ?? 2500,
        currency: opts.currency ?? 'usd',
        payment_intent:
          opts.paymentIntent ?? `pi_${faker.string.alphanumeric(24)}`,
        metadata: {
          organizationId,
          ...(opts.submissionId ? { submissionId: opts.submissionId } : {}),
        },
      } as unknown as Stripe.Checkout.Session,
    },
  } as Stripe.Event;
}

export function createCheckoutExpiredEvent(
  opts: CheckoutEventOptions = {},
): Stripe.Event {
  const sessionId = opts.sessionId ?? faker.string.uuid();
  const eventId = opts.eventId ?? `evt_${faker.string.alphanumeric(24)}`;
  const organizationId = opts.organizationId ?? faker.string.uuid();

  return {
    id: eventId,
    object: 'event',
    type: 'checkout.session.expired',
    api_version: '2024-12-18',
    created: Math.floor(Date.now() / 1000),
    livemode: false,
    pending_webhooks: 0,
    request: { id: null, idempotency_key: null },
    data: {
      object: {
        id: sessionId,
        object: 'checkout.session',
        amount_total: opts.amount ?? 2500,
        currency: opts.currency ?? 'usd',
        payment_intent:
          opts.paymentIntent ?? `pi_${faker.string.alphanumeric(24)}`,
        metadata: {
          organizationId,
          ...(opts.submissionId ? { submissionId: opts.submissionId } : {}),
        },
      } as unknown as Stripe.Checkout.Session,
    },
  } as Stripe.Event;
}

export function createInvalidMetadataEvent(
  opts: { eventId?: string; sessionId?: string } = {},
): Stripe.Event {
  const sessionId = opts.sessionId ?? faker.string.uuid();
  const eventId = opts.eventId ?? `evt_${faker.string.alphanumeric(24)}`;

  return {
    id: eventId,
    object: 'event',
    type: 'checkout.session.completed',
    api_version: '2024-12-18',
    created: Math.floor(Date.now() / 1000),
    livemode: false,
    pending_webhooks: 0,
    request: { id: null, idempotency_key: null },
    data: {
      object: {
        id: sessionId,
        object: 'checkout.session',
        amount_total: 1000,
        currency: 'usd',
        payment_intent: null,
        metadata: {
          organizationId: 'not-a-uuid',
        },
      } as unknown as Stripe.Checkout.Session,
    },
  } as Stripe.Event;
}
