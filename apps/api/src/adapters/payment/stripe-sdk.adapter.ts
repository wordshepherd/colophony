import Stripe from 'stripe';
import { z } from 'zod';
import type {
  PaymentAdapter,
  CheckoutSessionParams,
  CheckoutSessionResult,
  PaymentWebhookEvent,
  WebhookHandleResult,
  RefundResult,
  AdapterHealthResult,
} from '@colophony/plugin-sdk';

export class StripePaymentAdapter implements PaymentAdapter {
  readonly id = 'colophony-stripe';
  readonly name = 'Stripe Payment';
  readonly version = '1.0.0';
  readonly configSchema = z.object({
    secretKey: z.string().min(1),
    webhookSecret: z.string().min(1),
    timestampToleranceSeconds: z.coerce.number().int().positive().default(300),
  });

  private stripe: Stripe | null = null;
  private webhookSecret = '';
  private timestampTolerance = 300;

  async initialize(config: Record<string, unknown>): Promise<void> {
    const parsed = this.configSchema.parse(config);
    this.stripe = new Stripe(parsed.secretKey);
    this.webhookSecret = parsed.webhookSecret;
    this.timestampTolerance = parsed.timestampToleranceSeconds;
  }

  private getStripe(): Stripe {
    if (!this.stripe) {
      throw new Error('StripePaymentAdapter not initialized');
    }
    return this.stripe;
  }

  async createCheckoutSession(
    params: CheckoutSessionParams,
  ): Promise<CheckoutSessionResult> {
    const stripe = this.getStripe();
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: [
        {
          price_data: {
            currency: params.currency,
            product_data: {
              name: params.description ?? 'Payment',
            },
            unit_amount: params.amount,
          },
          quantity: 1,
        },
      ],
      metadata: params.metadata,
      customer: params.customerId,
      success_url: params.successUrl,
      cancel_url: params.cancelUrl,
    });

    return {
      sessionId: session.id,
      url: session.url ?? '',
    };
  }

  async verifyWebhook(
    headers: Record<string, string>,
    body: string,
  ): Promise<PaymentWebhookEvent> {
    const stripe = this.getStripe();
    const signature = headers['stripe-signature'];

    if (!signature) {
      throw new Error('Missing stripe-signature header');
    }

    const event = stripe.webhooks.constructEvent(
      body,
      signature,
      this.webhookSecret,
      this.timestampTolerance,
    );

    return {
      id: event.id,
      type: event.type,
      data: event.data.object as unknown as Record<string, unknown>,
    };
  }

  async handleWebhookEvent(
    _event: PaymentWebhookEvent,
  ): Promise<WebhookHandleResult> {
    // DB writes stay in the Fastify handler
    return { handled: false };
  }

  async refund(paymentId: string, amount?: number): Promise<RefundResult> {
    const stripe = this.getStripe();
    const refund = await stripe.refunds.create({
      payment_intent: paymentId,
      ...(amount != null ? { amount } : {}),
    });

    let status: 'succeeded' | 'pending' | 'failed';
    switch (refund.status) {
      case 'succeeded':
        status = 'succeeded';
        break;
      case 'pending':
        status = 'pending';
        break;
      default:
        status = 'failed';
    }

    return {
      refundId: refund.id,
      status,
      amount: refund.amount,
    };
  }

  async healthCheck(): Promise<AdapterHealthResult> {
    const stripe = this.getStripe();
    const start = Date.now();
    try {
      await stripe.balance.retrieve();
      return {
        healthy: true,
        message: 'Stripe API accessible',
        latencyMs: Date.now() - start,
      };
    } catch (err) {
      return {
        healthy: false,
        message: err instanceof Error ? err.message : 'Stripe API error',
        latencyMs: Date.now() - start,
      };
    }
  }

  async destroy(): Promise<void> {
    this.stripe = null;
  }
}
