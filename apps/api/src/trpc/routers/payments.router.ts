import { TRPCError } from '@trpc/server';
import { z } from 'zod';

import { router, orgProcedure, publicProcedure } from '../trpc.service';
import { trpcRegistry } from '../trpc.registry';
import { createCheckoutSessionSchema } from '@prospector/types';
import { PaymentsService } from '../../modules/payments/payments.service';
import { StripeService } from '../../modules/payments/stripe.service';
import { AuditActions, AuditResources } from '../../modules/audit';

// These services will be injected via context
// For now, we'll create them inline (will refactor to proper DI later)
let paymentsService: PaymentsService;
let stripeService: StripeService;

export const initializePaymentsRouter = (
  payments: PaymentsService,
  stripe: StripeService,
) => {
  paymentsService = payments;
  stripeService = stripe;
};

/**
 * Extract IP address from request
 */
function getIpAddress(req: Express.Request): string | undefined {
  const forwarded = (
    req as unknown as { headers: Record<string, string | string[]> }
  ).headers['x-forwarded-for'];
  if (typeof forwarded === 'string') {
    return forwarded.split(',')[0].trim();
  }
  if (Array.isArray(forwarded) && forwarded.length > 0) {
    return forwarded[0].trim();
  }
  return (req as unknown as { ip?: string }).ip ?? undefined;
}

/**
 * Extract user agent from request
 */
function getUserAgent(req: Express.Request): string | undefined {
  return (req as unknown as { headers: Record<string, string | string[]> })
    .headers['user-agent'] as string | undefined;
}

/**
 * Payments router handles all payment-related operations.
 */
export const paymentsRouter = router({
  /**
   * Get Stripe publishable key for client-side initialization
   */
  getPublishableKey: publicProcedure.query(() => {
    if (!stripeService?.isEnabled()) {
      throw new TRPCError({
        code: 'PRECONDITION_FAILED',
        message: 'Payments are not configured',
      });
    }

    return {
      publishableKey: stripeService.getPublishableKey(),
    };
  }),

  /**
   * Create a checkout session for a submission payment
   */
  createCheckoutSession: orgProcedure
    .input(createCheckoutSessionSchema)
    .mutation(async ({ input, ctx }) => {
      if (!paymentsService) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Payments service not initialized',
        });
      }

      if (!stripeService?.isEnabled()) {
        throw new TRPCError({
          code: 'PRECONDITION_FAILED',
          message: 'Payments are not configured',
        });
      }

      try {
        // Get submission fee from organization settings (default $25)
        // In a real implementation, this would come from organization.settings
        const submissionFee = 2500; // $25.00 in cents

        const result = await paymentsService.createCheckoutSession({
          organizationId: ctx.org.id,
          submissionId: input.submissionId,
          userId: ctx.user.userId,
          amount: submissionFee,
          currency: 'usd',
          successUrl: input.successUrl,
          cancelUrl: input.cancelUrl,
        });

        // Audit log - payment initiated
        await trpcRegistry.auditService.logSafe({
          organizationId: ctx.org.id,
          actorId: ctx.user.userId,
          action: AuditActions.PAYMENT_INITIATED,
          resource: AuditResources.PAYMENT,
          resourceId: result.sessionId,
          newValue: {
            submissionId: input.submissionId,
            amount: submissionFee,
            currency: 'usd',
            sessionId: result.sessionId,
          },
          ipAddress: getIpAddress(ctx.req),
          userAgent: getUserAgent(ctx.req),
        });

        return result;
      } catch (error) {
        if (error instanceof Error) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: error.message,
          });
        }
        throw error;
      }
    }),

  /**
   * Get payments for a specific submission
   */
  getForSubmission: orgProcedure
    .input(z.object({ submissionId: z.string().uuid() }))
    .query(async ({ input, ctx }) => {
      if (!paymentsService) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Payments service not initialized',
        });
      }

      // Verify user owns the submission or is an editor
      const submission = await ctx.prisma.submission.findUnique({
        where: { id: input.submissionId },
      });

      if (!submission) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Submission not found',
        });
      }

      // Check if user is the submitter or an editor
      const isSubmitter = submission.submitterId === ctx.user.userId;
      const member = await ctx.prisma.organizationMember.findUnique({
        where: {
          organizationId_userId: {
            organizationId: ctx.org.id,
            userId: ctx.user.userId,
          },
        },
      });

      const isEditor = member?.role === 'ADMIN' || member?.role === 'EDITOR';

      if (!isSubmitter && !isEditor) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Not authorized to view payments for this submission',
        });
      }

      return paymentsService.getPaymentsForSubmission(input.submissionId);
    }),

  /**
   * Get a specific payment by ID
   */
  getById: orgProcedure
    .input(z.object({ paymentId: z.string().uuid() }))
    .query(async ({ input, ctx }) => {
      if (!paymentsService) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Payments service not initialized',
        });
      }

      const payment = await paymentsService.getPaymentById(input.paymentId);

      if (!payment) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Payment not found',
        });
      }

      // Verify organization matches
      if (payment.organizationId !== ctx.org.id) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Payment not found',
        });
      }

      return payment;
    }),
});
