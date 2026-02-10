import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';

export interface CreateCheckoutSessionParams {
  organizationId: string;
  submissionId: string;
  userId: string;
  amount: number; // in cents
  currency: string;
  successUrl: string;
  cancelUrl: string;
  metadata?: Record<string, string>;
}

export interface StripeConfig {
  secretKey: string;
  webhookSecret: string;
  publishableKey: string;
}

@Injectable()
export class StripeService implements OnModuleInit {
  private stripe!: Stripe;
  private config!: StripeConfig;
  private readonly logger = new Logger(StripeService.name);

  constructor(private readonly configService: ConfigService) {}

  onModuleInit() {
    this.config = {
      secretKey: this.configService.get<string>('STRIPE_SECRET_KEY', ''),
      webhookSecret: this.configService.get<string>(
        'STRIPE_WEBHOOK_SECRET',
        '',
      ),
      publishableKey: this.configService.get<string>(
        'STRIPE_PUBLISHABLE_KEY',
        '',
      ),
    };

    if (!this.config.secretKey) {
      this.logger.warn('STRIPE_SECRET_KEY not configured - payments disabled');
      return;
    }

    this.stripe = new Stripe(this.config.secretKey);

    this.logger.log('Stripe initialized');
  }

  /**
   * Check if Stripe is configured and enabled
   */
  isEnabled(): boolean {
    return !!this.config?.secretKey;
  }

  /**
   * Get the Stripe publishable key for frontend
   */
  getPublishableKey(): string {
    return this.config.publishableKey;
  }

  /**
   * Create a Stripe Checkout session
   */
  async createCheckoutSession(
    params: CreateCheckoutSessionParams,
  ): Promise<Stripe.Checkout.Session> {
    if (!this.isEnabled()) {
      throw new Error('Stripe is not configured');
    }

    const session = await this.stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: params.currency,
            unit_amount: params.amount,
            product_data: {
              name: 'Submission Fee',
              description: `Submission fee for submission ${params.submissionId}`,
            },
          },
          quantity: 1,
        },
      ],
      success_url: params.successUrl,
      cancel_url: params.cancelUrl,
      metadata: {
        organizationId: params.organizationId,
        submissionId: params.submissionId,
        userId: params.userId,
        ...params.metadata,
      },
      client_reference_id: params.submissionId,
    });

    return session;
  }

  /**
   * Retrieve a checkout session by ID
   */
  async getCheckoutSession(
    sessionId: string,
  ): Promise<Stripe.Checkout.Session> {
    if (!this.isEnabled()) {
      throw new Error('Stripe is not configured');
    }

    return this.stripe.checkout.sessions.retrieve(sessionId, {
      expand: ['payment_intent'],
    });
  }

  /**
   * Construct and verify a webhook event
   */
  constructWebhookEvent(payload: Buffer, signature: string): Stripe.Event {
    if (!this.config.webhookSecret) {
      throw new Error('Stripe webhook secret not configured');
    }

    return this.stripe.webhooks.constructEvent(
      payload,
      signature,
      this.config.webhookSecret,
    );
  }

  /**
   * Create a refund for a payment
   */
  async createRefund(
    paymentIntentId: string,
    amount?: number,
  ): Promise<Stripe.Refund> {
    if (!this.isEnabled()) {
      throw new Error('Stripe is not configured');
    }

    return this.stripe.refunds.create({
      payment_intent: paymentIntentId,
      amount, // If not specified, refunds the entire amount
    });
  }

  /**
   * Get a payment intent by ID
   */
  async getPaymentIntent(
    paymentIntentId: string,
  ): Promise<Stripe.PaymentIntent> {
    if (!this.isEnabled()) {
      throw new Error('Stripe is not configured');
    }

    return this.stripe.paymentIntents.retrieve(paymentIntentId);
  }
}
