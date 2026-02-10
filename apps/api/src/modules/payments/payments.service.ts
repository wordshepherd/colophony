import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { prisma } from '@prospector/db';
import { StripeService, CreateCheckoutSessionParams } from './stripe.service';
import type { PaymentStatus, CheckoutSessionResponse } from '@prospector/types';
import type Stripe from 'stripe';

export interface CreatePaymentParams {
  organizationId: string;
  submissionId: string;
  userId: string;
  amount: number; // in cents
  currency?: string;
  successUrl: string;
  cancelUrl: string;
}

export interface PaymentRecord {
  id: string;
  organizationId: string;
  submissionId: string | null;
  stripePaymentId: string | null;
  stripeSessionId: string | null;
  amount: number;
  currency: string;
  status: PaymentStatus;
  createdAt: Date;
}

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(private readonly stripeService: StripeService) {}

  /**
   * Create a checkout session for a submission payment
   */
  async createCheckoutSession(
    params: CreatePaymentParams,
  ): Promise<CheckoutSessionResponse> {
    // Validate submission exists and is in draft status
    const submission = await prisma.submission.findUnique({
      where: { id: params.submissionId },
      include: { payments: true },
    });

    if (!submission) {
      throw new BadRequestException('Submission not found');
    }

    if (submission.organizationId !== params.organizationId) {
      throw new BadRequestException(
        'Submission does not belong to this organization',
      );
    }

    if (submission.submitterId !== params.userId) {
      throw new BadRequestException('You do not own this submission');
    }

    if (submission.status !== 'DRAFT') {
      throw new BadRequestException(
        'Submission must be in draft status to pay',
      );
    }

    // Check if there's already a pending/processing payment
    const existingPayment = submission.payments.find(
      (p: { status: string }) =>
        p.status === 'PENDING' || p.status === 'PROCESSING',
    );

    if (existingPayment) {
      throw new BadRequestException(
        'A payment is already in progress for this submission',
      );
    }

    // Create Stripe checkout session
    const checkoutParams: CreateCheckoutSessionParams = {
      organizationId: params.organizationId,
      submissionId: params.submissionId,
      userId: params.userId,
      amount: params.amount,
      currency: params.currency || 'usd',
      successUrl: params.successUrl,
      cancelUrl: params.cancelUrl,
    };

    const session =
      await this.stripeService.createCheckoutSession(checkoutParams);

    // Create payment record in database
    await prisma.payment.create({
      data: {
        organizationId: params.organizationId,
        submissionId: params.submissionId,
        stripeSessionId: session.id,
        amount: params.amount / 100, // Convert cents to dollars for storage
        currency: params.currency || 'usd',
        status: 'PENDING',
        metadata: {
          userId: params.userId,
        },
      },
    });

    this.logger.log(
      `Created checkout session ${session.id} for submission ${params.submissionId}`,
    );

    return {
      sessionId: session.id,
      url: session.url!,
    };
  }

  /**
   * Get payment by ID
   */
  async getPaymentById(paymentId: string): Promise<PaymentRecord | null> {
    const payment = await prisma.payment.findUnique({
      where: { id: paymentId },
    });

    if (!payment) return null;

    return {
      id: payment.id,
      organizationId: payment.organizationId,
      submissionId: payment.submissionId,
      stripePaymentId: payment.stripePaymentId,
      stripeSessionId: payment.stripeSessionId,
      amount: Number(payment.amount),
      currency: payment.currency,
      status: payment.status as PaymentStatus,
      createdAt: payment.createdAt,
    };
  }

  /**
   * Get payments for a submission
   */
  async getPaymentsForSubmission(
    submissionId: string,
  ): Promise<PaymentRecord[]> {
    const payments = await prisma.payment.findMany({
      where: { submissionId },
      orderBy: { createdAt: 'desc' },
    });

    return payments.map((p: (typeof payments)[number]) => ({
      id: p.id,
      organizationId: p.organizationId,
      submissionId: p.submissionId,
      stripePaymentId: p.stripePaymentId,
      stripeSessionId: p.stripeSessionId,
      amount: Number(p.amount),
      currency: p.currency,
      status: p.status as PaymentStatus,
      createdAt: p.createdAt,
    }));
  }

  /**
   * Process a successful checkout session
   * Called from webhook handler
   */
  async handleCheckoutCompleted(
    session: Stripe.Checkout.Session,
  ): Promise<void> {
    const { id: sessionId, payment_intent, metadata } = session;
    const paymentIntentId =
      typeof payment_intent === 'string' ? payment_intent : payment_intent?.id;

    this.logger.log(`Processing completed checkout: ${sessionId}`);

    // Find the payment by session ID
    const payment = await prisma.payment.findUnique({
      where: { stripeSessionId: sessionId },
    });

    if (!payment) {
      this.logger.warn(`No payment found for session ${sessionId}`);
      return;
    }

    // Update payment status
    await prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: 'SUCCEEDED',
        stripePaymentId: paymentIntentId,
      },
    });

    // Update submission status to SUBMITTED
    if (payment.submissionId) {
      await prisma.submission.update({
        where: { id: payment.submissionId },
        data: {
          status: 'SUBMITTED',
          submittedAt: new Date(),
        },
      });

      // Create history entry
      await prisma.submissionHistory.create({
        data: {
          submissionId: payment.submissionId,
          previousStatus: 'DRAFT',
          newStatus: 'SUBMITTED',
          changedBy: metadata?.userId || 'system',
          comment: 'Payment completed, submission submitted',
        },
      });

      this.logger.log(
        `Submission ${payment.submissionId} status updated to SUBMITTED after payment`,
      );
    }
  }

  /**
   * Handle payment intent succeeded (for direct payments)
   */
  async handlePaymentIntentSucceeded(
    paymentIntent: Stripe.PaymentIntent,
  ): Promise<void> {
    this.logger.log(`Processing payment intent succeeded: ${paymentIntent.id}`);

    // Find the payment by payment intent ID
    const payment = await prisma.payment.findUnique({
      where: { stripePaymentId: paymentIntent.id },
    });

    if (!payment) {
      // This might be a checkout session payment, which is handled separately
      this.logger.debug(
        `No direct payment found for intent ${paymentIntent.id} (may be checkout session)`,
      );
      return;
    }

    // Update payment status
    await prisma.payment.update({
      where: { id: payment.id },
      data: { status: 'SUCCEEDED' },
    });
  }

  /**
   * Handle payment intent failed
   */
  async handlePaymentIntentFailed(
    paymentIntent: Stripe.PaymentIntent,
  ): Promise<void> {
    this.logger.log(`Processing payment intent failed: ${paymentIntent.id}`);

    // Find the payment by payment intent ID or session
    const payment = await prisma.payment.findFirst({
      where: {
        OR: [
          { stripePaymentId: paymentIntent.id },
          // Also check session-based payments
        ],
      },
    });

    if (!payment) {
      this.logger.warn(`No payment found for intent ${paymentIntent.id}`);
      return;
    }

    // Update payment status
    await prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: 'FAILED',
        stripePaymentId: paymentIntent.id,
      },
    });
  }

  /**
   * Handle checkout session expired
   */
  async handleCheckoutExpired(session: Stripe.Checkout.Session): Promise<void> {
    this.logger.log(`Processing expired checkout: ${session.id}`);

    // Find the payment by session ID
    const payment = await prisma.payment.findUnique({
      where: { stripeSessionId: session.id },
    });

    if (!payment) {
      this.logger.warn(`No payment found for expired session ${session.id}`);
      return;
    }

    // Update payment status to failed
    await prisma.payment.update({
      where: { id: payment.id },
      data: { status: 'FAILED' },
    });
  }

  /**
   * Handle refund (charge.refunded event)
   */
  async handleRefund(charge: Stripe.Charge): Promise<void> {
    const paymentIntentId =
      typeof charge.payment_intent === 'string'
        ? charge.payment_intent
        : charge.payment_intent?.id;

    if (!paymentIntentId) {
      this.logger.warn('Refund charge has no payment intent');
      return;
    }

    this.logger.log(`Processing refund for payment intent: ${paymentIntentId}`);

    const payment = await prisma.payment.findUnique({
      where: { stripePaymentId: paymentIntentId },
    });

    if (!payment) {
      this.logger.warn(`No payment found for refund: ${paymentIntentId}`);
      return;
    }

    // Update payment status
    await prisma.payment.update({
      where: { id: payment.id },
      data: { status: 'REFUNDED' },
    });

    // Note: We don't revert submission status on refund
    // That's a business decision to handle manually
  }
}
