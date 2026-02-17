import { z } from "zod";

export const paymentStatusSchema = z.enum([
  "PENDING",
  "PROCESSING",
  "SUCCEEDED",
  "FAILED",
  "REFUNDED",
]);

export type PaymentStatus = z.infer<typeof paymentStatusSchema>;

export const paymentSchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string().uuid(),
  submissionId: z.string().uuid().nullable(),
  stripePaymentId: z.string().nullable(),
  stripeSessionId: z.string().nullable(),
  amount: z.number(),
  currency: z.string(),
  status: paymentStatusSchema,
  metadata: z.record(z.string(), z.unknown()),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type Payment = z.infer<typeof paymentSchema>;

export const createCheckoutSessionSchema = z.object({
  submissionId: z.string().uuid(),
  successUrl: z.string().url(),
  cancelUrl: z.string().url(),
});

export type CreateCheckoutSessionInput = z.infer<
  typeof createCheckoutSessionSchema
>;

export const checkoutSessionResponseSchema = z.object({
  sessionId: z.string(),
  url: z.string().url(),
});

export type CheckoutSessionResponse = z.infer<
  typeof checkoutSessionResponseSchema
>;
