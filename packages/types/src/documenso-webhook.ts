import { z } from "zod";

// ---------------------------------------------------------------------------
// Documenso webhook payload — Zod validation for inbound webhooks
// ---------------------------------------------------------------------------

export const documensoWebhookPayloadSchema = z.object({
  event: z.string(),
  data: z
    .object({
      id: z.string(),
      documentId: z.string(),
      status: z.string().optional(),
    })
    .passthrough(),
});

export type DocumensoWebhookPayload = z.infer<
  typeof documensoWebhookPayloadSchema
>;
