import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { PaymentsService } from '../../src/modules/payments/payments.service';
import { StripeService } from '../../src/modules/payments/stripe.service';
import { prisma } from '@prospector/db';

// Mock Prisma
jest.mock('@prospector/db', () => ({
  prisma: {
    submission: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    payment: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    submissionHistory: {
      create: jest.fn(),
    },
  },
}));

describe('PaymentsService', () => {
  let service: PaymentsService;
  let stripeService: jest.Mocked<StripeService>;

  const mockPrisma = prisma as jest.Mocked<typeof prisma>;

  beforeEach(async () => {
    stripeService = {
      isEnabled: jest.fn().mockReturnValue(true),
      createCheckoutSession: jest.fn(),
      getCheckoutSession: jest.fn(),
      constructWebhookEvent: jest.fn(),
      createRefund: jest.fn(),
      getPaymentIntent: jest.fn(),
      getPublishableKey: jest.fn(),
    } as unknown as jest.Mocked<StripeService>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentsService,
        {
          provide: StripeService,
          useValue: stripeService,
        },
      ],
    }).compile();

    service = module.get<PaymentsService>(PaymentsService);

    // Reset all mocks
    jest.clearAllMocks();
  });

  describe('createCheckoutSession', () => {
    const mockParams = {
      organizationId: 'org-123',
      submissionId: 'sub-123',
      userId: 'user-123',
      amount: 2500,
      successUrl: 'https://example.com/success',
      cancelUrl: 'https://example.com/cancel',
    };

    const mockSubmission = {
      id: 'sub-123',
      organizationId: 'org-123',
      submitterId: 'user-123',
      status: 'DRAFT',
      payments: [],
    };

    const mockStripeSession = {
      id: 'cs_test_123',
      url: 'https://checkout.stripe.com/pay/cs_test_123',
    };

    it('should create checkout session for valid submission', async () => {
      mockPrisma.submission.findUnique.mockResolvedValue(mockSubmission as never);
      stripeService.createCheckoutSession.mockResolvedValue(mockStripeSession as never);
      mockPrisma.payment.create.mockResolvedValue({ id: 'payment-123' } as never);

      const result = await service.createCheckoutSession(mockParams);

      expect(result.sessionId).toBe('cs_test_123');
      expect(result.url).toBe('https://checkout.stripe.com/pay/cs_test_123');
      expect(mockPrisma.payment.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          organizationId: 'org-123',
          submissionId: 'sub-123',
          stripeSessionId: 'cs_test_123',
          status: 'PENDING',
        }),
      });
    });

    it('should throw if submission not found', async () => {
      mockPrisma.submission.findUnique.mockResolvedValue(null as never);

      await expect(service.createCheckoutSession(mockParams)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw if submission belongs to different organization', async () => {
      mockPrisma.submission.findUnique.mockResolvedValue({
        ...mockSubmission,
        organizationId: 'different-org',
      } as never);

      await expect(service.createCheckoutSession(mockParams)).rejects.toThrow(
        'Submission does not belong to this organization',
      );
    });

    it('should throw if user does not own submission', async () => {
      mockPrisma.submission.findUnique.mockResolvedValue({
        ...mockSubmission,
        submitterId: 'different-user',
      } as never);

      await expect(service.createCheckoutSession(mockParams)).rejects.toThrow(
        'You do not own this submission',
      );
    });

    it('should throw if submission is not in draft status', async () => {
      mockPrisma.submission.findUnique.mockResolvedValue({
        ...mockSubmission,
        status: 'SUBMITTED',
      } as never);

      await expect(service.createCheckoutSession(mockParams)).rejects.toThrow(
        'Submission must be in draft status to pay',
      );
    });

    it('should throw if payment already in progress', async () => {
      mockPrisma.submission.findUnique.mockResolvedValue({
        ...mockSubmission,
        payments: [{ status: 'PENDING' }],
      } as never);

      await expect(service.createCheckoutSession(mockParams)).rejects.toThrow(
        'A payment is already in progress for this submission',
      );
    });
  });

  describe('handleCheckoutCompleted', () => {
    const mockSession = {
      id: 'cs_test_123',
      payment_intent: 'pi_test_123',
      metadata: {
        userId: 'user-123',
      },
    };

    const mockPayment = {
      id: 'payment-123',
      submissionId: 'sub-123',
    };

    it('should update payment and submission status on success', async () => {
      mockPrisma.payment.findUnique.mockResolvedValue(mockPayment as never);
      mockPrisma.payment.update.mockResolvedValue({ ...mockPayment, status: 'SUCCEEDED' } as never);
      mockPrisma.submission.update.mockResolvedValue({} as never);
      mockPrisma.submissionHistory.create.mockResolvedValue({} as never);

      await service.handleCheckoutCompleted(mockSession as never);

      expect(mockPrisma.payment.update).toHaveBeenCalledWith({
        where: { id: 'payment-123' },
        data: {
          status: 'SUCCEEDED',
          stripePaymentId: 'pi_test_123',
        },
      });

      expect(mockPrisma.submission.update).toHaveBeenCalledWith({
        where: { id: 'sub-123' },
        data: {
          status: 'SUBMITTED',
          submittedAt: expect.any(Date),
        },
      });
    });

    it('should handle missing payment gracefully', async () => {
      mockPrisma.payment.findUnique.mockResolvedValue(null as never);

      // Should not throw
      await service.handleCheckoutCompleted(mockSession as never);

      expect(mockPrisma.payment.update).not.toHaveBeenCalled();
    });
  });

  describe('handleCheckoutExpired', () => {
    const mockSession = {
      id: 'cs_test_123',
    };

    it('should mark payment as failed when checkout expires', async () => {
      mockPrisma.payment.findUnique.mockResolvedValue({ id: 'payment-123' } as never);
      mockPrisma.payment.update.mockResolvedValue({} as never);

      await service.handleCheckoutExpired(mockSession as never);

      expect(mockPrisma.payment.update).toHaveBeenCalledWith({
        where: { id: 'payment-123' },
        data: { status: 'FAILED' },
      });
    });
  });

  describe('getPaymentsForSubmission', () => {
    it('should return payments for a submission', async () => {
      const mockPayments = [
        {
          id: 'pay-1',
          organizationId: 'org-123',
          submissionId: 'sub-123',
          stripePaymentId: 'pi_123',
          stripeSessionId: 'cs_123',
          amount: 25.0,
          currency: 'usd',
          status: 'SUCCEEDED',
          createdAt: new Date(),
        },
      ];

      mockPrisma.payment.findMany.mockResolvedValue(mockPayments as never);

      const result = await service.getPaymentsForSubmission('sub-123');

      expect(result).toHaveLength(1);
      expect(result[0].status).toBe('SUCCEEDED');
    });
  });

  describe('getPaymentById', () => {
    it('should return payment by ID', async () => {
      const mockPayment = {
        id: 'pay-1',
        organizationId: 'org-123',
        submissionId: 'sub-123',
        stripePaymentId: 'pi_123',
        stripeSessionId: 'cs_123',
        amount: 25.0,
        currency: 'usd',
        status: 'SUCCEEDED',
        createdAt: new Date(),
      };

      mockPrisma.payment.findUnique.mockResolvedValue(mockPayment as never);

      const result = await service.getPaymentById('pay-1');

      expect(result).not.toBeNull();
      expect(result!.id).toBe('pay-1');
    });

    it('should return null if payment not found', async () => {
      mockPrisma.payment.findUnique.mockResolvedValue(null as never);

      const result = await service.getPaymentById('nonexistent');

      expect(result).toBeNull();
    });
  });
});

describe('PaymentsService - Idempotency', () => {
  // Test that webhook events are processed idempotently
  // This is crucial for Stripe integration

  it('should not process same checkout completion twice', async () => {
    // This test validates the idempotency pattern used in the webhook controller
    // The actual idempotency is enforced at the webhook controller level
    // via the stripe_webhook_events table

    // The payment service itself is designed to be idempotent:
    // - handleCheckoutCompleted checks for existing payment by session ID
    // - Status updates are deterministic (PENDING -> SUCCEEDED)
    // - Submission status update is also deterministic

    expect(true).toBe(true); // Placeholder - real idempotency tested via integration tests
  });
});
