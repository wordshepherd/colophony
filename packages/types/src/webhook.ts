import { z } from "zod";

// ---------------------------------------------------------------------------
// Webhook event types — all events that can trigger webhook deliveries
// ---------------------------------------------------------------------------

export const WEBHOOK_EVENT_TYPES = [
  "hopper/submission.submitted",
  "hopper/submission.accepted",
  "hopper/submission.rejected",
  "hopper/submission.withdrawn",
  "slate/pipeline.copyeditor-assigned",
  "slate/pipeline.copyedit-completed",
  "slate/pipeline.author-review-completed",
  "slate/pipeline.proofread-completed",
  "slate/contract.generated",
  "slate/issue.published",
  "webhook.test",
] as const;

export type WebhookEventType = (typeof WEBHOOK_EVENT_TYPES)[number];

export const webhookEventTypeSchema = z.enum(WEBHOOK_EVENT_TYPES);

// ---------------------------------------------------------------------------
// Input schemas
// ---------------------------------------------------------------------------

export const createWebhookEndpointSchema = z.object({
  url: z.string().url("Must be a valid URL").max(2048),
  description: z.string().max(512).optional(),
  eventTypes: z
    .array(webhookEventTypeSchema)
    .min(1, "At least one event type is required"),
});

export type CreateWebhookEndpointInput = z.infer<
  typeof createWebhookEndpointSchema
>;

export const updateWebhookEndpointSchema = z.object({
  url: z.string().url("Must be a valid URL").max(2048).optional(),
  description: z.string().max(512).optional(),
  eventTypes: z
    .array(webhookEventTypeSchema)
    .min(1, "At least one event type is required")
    .optional(),
  status: z.enum(["ACTIVE", "DISABLED"]).optional(),
});

export type UpdateWebhookEndpointInput = z.infer<
  typeof updateWebhookEndpointSchema
>;

// ---------------------------------------------------------------------------
// Response schemas
// ---------------------------------------------------------------------------

export const webhookEndpointResponseSchema = z.object({
  id: z.string().uuid(),
  url: z.string(),
  description: z.string().nullable(),
  eventTypes: z.array(z.string()),
  status: z.enum(["ACTIVE", "DISABLED"]),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type WebhookEndpointResponse = z.infer<
  typeof webhookEndpointResponseSchema
>;

export const webhookEndpointCreatedResponseSchema =
  webhookEndpointResponseSchema.extend({
    secret: z.string(),
  });

export type WebhookEndpointCreatedResponse = z.infer<
  typeof webhookEndpointCreatedResponseSchema
>;

export const webhookDeliveryResponseSchema = z.object({
  id: z.string().uuid(),
  webhookEndpointId: z.string().uuid(),
  eventType: z.string(),
  eventId: z.string(),
  payload: z.unknown(),
  status: z.enum(["QUEUED", "DELIVERING", "DELIVERED", "FAILED"]),
  httpStatusCode: z.number().nullable(),
  responseBody: z.string().nullable(),
  errorMessage: z.string().nullable(),
  attempts: z.number(),
  nextRetryAt: z.date().nullable(),
  deliveredAt: z.date().nullable(),
  createdAt: z.date(),
});

export type WebhookDeliveryResponse = z.infer<
  typeof webhookDeliveryResponseSchema
>;

// ---------------------------------------------------------------------------
// Query schemas
// ---------------------------------------------------------------------------

export const listWebhookDeliveriesSchema = z.object({
  endpointId: z.string().uuid().optional(),
  eventType: z.string().optional(),
  status: z.enum(["QUEUED", "DELIVERING", "DELIVERED", "FAILED"]).optional(),
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(100).default(20),
});

export type ListWebhookDeliveriesInput = z.infer<
  typeof listWebhookDeliveriesSchema
>;
