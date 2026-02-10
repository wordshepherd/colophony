import {
  Controller,
  Post,
  Headers,
  Req,
  HttpCode,
  HttpStatus,
  BadRequestException,
  Logger,
  RawBodyRequest,
} from '@nestjs/common';
import { Request } from 'express';
import { prisma } from '@prospector/db';
import { StripeService } from './stripe.service';
import { PaymentsService } from './payments.service';
import { SkipRateLimit } from '../security/rate-limit.guard';
import type Stripe from 'stripe';

/**
 * Controller for handling Stripe webhook events.
 *
 * Implements idempotent event processing using the stripe_webhook_events table
 * to prevent duplicate processing of the same event.
 *
 * Required setup:
 * 1. Configure STRIPE_WEBHOOK_SECRET in environment
 * 2. Set up webhook endpoint in Stripe Dashboard: /webhooks/stripe
 * 3. Subscribe to events: checkout.session.completed, payment_intent.succeeded, etc.
 */
@Controller('webhooks/stripe')
export class StripeWebhookController {
  private readonly logger = new Logger(StripeWebhookController.name);

  constructor(
    private readonly stripeService: StripeService,
    private readonly paymentsService: PaymentsService,
  ) {}

  /**
   * Handle incoming Stripe webhook events
   *
   * Uses raw body for signature verification.
   * Implements idempotency by checking if event was already processed.
   */
  @Post()
  @HttpCode(HttpStatus.OK)
  @SkipRateLimit()
  async handleWebhook(
    @Req() request: RawBodyRequest<Request>,
    @Headers('stripe-signature') signature: string,
  ): Promise<{ received: boolean }> {
    if (!request.rawBody) {
      throw new BadRequestException('Missing raw body');
    }

    if (!signature) {
      throw new BadRequestException('Missing stripe-signature header');
    }

    // Verify and construct the event
    let event: Stripe.Event;
    try {
      event = this.stripeService.constructWebhookEvent(
        request.rawBody,
        signature,
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      this.logger.error(`Webhook signature verification failed: ${message}`);
      throw new BadRequestException(`Webhook Error: ${message}`);
    }

    // Check for idempotency - skip if already processed
    const existingEvent = await prisma.stripeWebhookEvent.findUnique({
      where: { stripeId: event.id },
    });

    if (existingEvent?.processed) {
      this.logger.log(`Event ${event.id} already processed, skipping`);
      return { received: true };
    }

    // Store event for tracking (if not exists)
    if (!existingEvent) {
      await prisma.stripeWebhookEvent.create({
        data: {
          stripeId: event.id,
          type: event.type,
          payload: event.data as object,
          processed: false,
        },
      });
    }

    // Process the event
    try {
      await this.processEvent(event);

      // Mark as processed
      await prisma.stripeWebhookEvent.update({
        where: { stripeId: event.id },
        data: {
          processed: true,
          processedAt: new Date(),
        },
      });

      this.logger.log(
        `Successfully processed event: ${event.type} (${event.id})`,
      );
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      this.logger.error(`Failed to process event ${event.id}: ${errorMessage}`);

      // Store error but don't mark as processed (will retry)
      await prisma.stripeWebhookEvent.update({
        where: { stripeId: event.id },
        data: { error: errorMessage },
      });

      // Re-throw to signal Stripe to retry
      throw err;
    }

    return { received: true };
  }

  /**
   * Route event to appropriate handler
   */
  private async processEvent(event: Stripe.Event): Promise<void> {
    switch (event.type) {
      case 'checkout.session.completed':
        await this.paymentsService.handleCheckoutCompleted(event.data.object);
        break;

      case 'checkout.session.expired':
        await this.paymentsService.handleCheckoutExpired(event.data.object);
        break;

      case 'payment_intent.succeeded':
        await this.paymentsService.handlePaymentIntentSucceeded(
          event.data.object,
        );
        break;

      case 'payment_intent.payment_failed':
        await this.paymentsService.handlePaymentIntentFailed(event.data.object);
        break;

      case 'charge.refunded':
        await this.paymentsService.handleRefund(event.data.object);
        break;

      default:
        this.logger.debug(`Unhandled event type: ${event.type}`);
    }
  }
}
