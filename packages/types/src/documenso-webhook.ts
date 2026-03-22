import { z } from "zod";

// ---------------------------------------------------------------------------
// Documenso webhook payload — Zod validation for inbound webhooks
// ---------------------------------------------------------------------------

export const documensoWebhookPayloadSchema = z.object({
  event: z.string(),
  data: z
    .object({
      id: z.string().optional(),
      documentId: z.string().optional(),
      status: z.string().optional(),
    })
    .passthrough()
    .refine((d) => d.id != null || d.documentId != null, {
      message: "At least one of 'id' or 'documentId' must be present",
    }),
});

export type DocumensoWebhookPayload = z.infer<
  typeof documensoWebhookPayloadSchema
>;
