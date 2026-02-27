import { z } from "zod";

// ---------------------------------------------------------------------------
// Editor-to-writer correspondence — shared schemas
// ---------------------------------------------------------------------------

export const sendEditorMessageSchema = z.object({
  submissionId: z.string().uuid(),
  subject: z.string().min(1).max(500),
  body: z.string().min(1).max(50_000), // HTML from Tiptap
});

export type SendEditorMessageInput = z.infer<typeof sendEditorMessageSchema>;

export const correspondenceListItemSchema = z.object({
  id: z.string().uuid(),
  direction: z.enum(["inbound", "outbound"]),
  channel: z.enum(["email", "portal", "in_app", "other"]),
  sentAt: z.string().datetime(),
  subject: z.string().max(500).nullable(),
  bodyPreview: z.string().max(200),
  senderName: z.string().max(255).nullable(),
  senderEmail: z.string().email().max(255).nullable(),
  isPersonalized: z.boolean(),
  source: z.enum(["colophony", "manual"]),
});

export type CorrespondenceListItem = z.infer<
  typeof correspondenceListItemSchema
>;
