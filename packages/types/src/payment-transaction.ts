import { z } from "zod";

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

export const paymentTransactionTypeSchema = z
  .enum(["submission_fee", "contest_fee", "contributor_payment"])
  .describe("Type of payment transaction");

export type PaymentTransactionType = z.infer<
  typeof paymentTransactionTypeSchema
>;

export const paymentTransactionDirectionSchema = z
  .enum(["inbound", "outbound"])
  .describe("Direction: inbound (received) or outbound (paid)");

export type PaymentTransactionDirection = z.infer<
  typeof paymentTransactionDirectionSchema
>;

export const paymentTransactionStatusSchema = z
  .enum(["PENDING", "PROCESSING", "SUCCEEDED", "FAILED", "REFUNDED"])
  .describe("Payment status");

export type PaymentTransactionStatus = z.infer<
  typeof paymentTransactionStatusSchema
>;

// ---------------------------------------------------------------------------
// Response
// ---------------------------------------------------------------------------

export const paymentTransactionSchema = z.object({
  id: z.string().uuid().describe("Transaction ID"),
  organizationId: z.string().uuid().describe("Organization ID"),
  contributorId: z.string().uuid().nullable().describe("Contributor ID"),
  submissionId: z.string().uuid().nullable().describe("Submission ID"),
  paymentId: z.string().uuid().nullable().describe("Linked Stripe payment ID"),
  type: paymentTransactionTypeSchema,
  direction: paymentTransactionDirectionSchema,
  amount: z.number().int().describe("Amount in cents"),
  currency: z.string().max(3).describe("ISO 4217 currency code"),
  status: paymentTransactionStatusSchema,
  description: z.string().nullable().describe("Human-readable description"),
  metadata: z
    .record(z.string(), z.unknown())
    .nullable()
    .describe("Additional metadata"),
  processedAt: z
    .date()
    .nullable()
    .describe("When the transaction was processed"),
  createdAt: z.date().describe("Record creation timestamp"),
  updatedAt: z.date().describe("Record update timestamp"),
});

export type PaymentTransaction = z.infer<typeof paymentTransactionSchema>;

// ---------------------------------------------------------------------------
// Create
// ---------------------------------------------------------------------------

export const createPaymentTransactionSchema = z.object({
  contributorId: z.string().uuid().optional().describe("Contributor ID"),
  submissionId: z.string().uuid().optional().describe("Submission ID"),
  paymentId: z.string().uuid().optional().describe("Linked Stripe payment ID"),
  type: paymentTransactionTypeSchema,
  direction: paymentTransactionDirectionSchema,
  amount: z.number().int().min(0).describe("Amount in cents"),
  currency: z
    .string()
    .length(3, "Currency code must be 3 characters")
    .default("usd")
    .describe("ISO 4217 currency code"),
  description: z.string().max(1000).optional().describe("Description"),
  metadata: z
    .record(z.string(), z.unknown())
    .optional()
    .describe("Additional metadata"),
});

export type CreatePaymentTransactionInput = z.infer<
  typeof createPaymentTransactionSchema
>;

// ---------------------------------------------------------------------------
// List
// ---------------------------------------------------------------------------

export const listPaymentTransactionsSchema = z.object({
  type: paymentTransactionTypeSchema.optional().describe("Filter by type"),
  direction: paymentTransactionDirectionSchema
    .optional()
    .describe("Filter by direction"),
  contributorId: z.string().uuid().optional().describe("Filter by contributor"),
  status: paymentTransactionStatusSchema.optional(),
  page: z.number().int().min(1).default(1).describe("Page number"),
  limit: z
    .number()
    .int()
    .min(1)
    .max(100)
    .default(20)
    .describe("Items per page"),
});

export type ListPaymentTransactionsInput = z.infer<
  typeof listPaymentTransactionsSchema
>;

// ---------------------------------------------------------------------------
// Status transitions
// ---------------------------------------------------------------------------

export const VALID_PAYMENT_STATUS_TRANSITIONS: Record<
  PaymentTransactionStatus,
  PaymentTransactionStatus[]
> = {
  PENDING: ["PROCESSING", "SUCCEEDED", "FAILED"],
  PROCESSING: ["SUCCEEDED", "FAILED"],
  SUCCEEDED: ["REFUNDED"],
  FAILED: ["PENDING"], // retry
  REFUNDED: [], // terminal
};

// ---------------------------------------------------------------------------
// Update & transition schemas
// ---------------------------------------------------------------------------

export const updatePaymentTransactionSchema = z
  .object({
    id: z.string().uuid(),
    description: z.string().max(1000).nullable().optional(),
    metadata: z.record(z.string(), z.unknown()).nullable().optional(),
  })
  .refine(
    (data) => data.description !== undefined || data.metadata !== undefined,
    { message: "At least one field to update is required" },
  );

export type UpdatePaymentTransactionInput = z.infer<
  typeof updatePaymentTransactionSchema
>;

export const transitionPaymentTransactionStatusSchema = z.object({
  id: z.string().uuid(),
  status: paymentTransactionStatusSchema,
});

export type TransitionPaymentTransactionStatusInput = z.infer<
  typeof transitionPaymentTransactionStatusSchema
>;

// ---------------------------------------------------------------------------
// Response schemas
// ---------------------------------------------------------------------------

export const paymentTransactionListItemSchema = paymentTransactionSchema.extend(
  {
    contributorName: z.string().nullable(),
  },
);

export const revenueSummarySchema = z.object({
  totalInbound: z.number().int(),
  totalOutbound: z.number().int(),
  net: z.number().int(),
  countByType: z.record(z.string(), z.number().int()),
  countByStatus: z.record(z.string(), z.number().int()),
});

export type RevenueSummary = z.infer<typeof revenueSummarySchema>;
