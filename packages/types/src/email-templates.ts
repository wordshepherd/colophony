import { z } from "zod";

// ---------------------------------------------------------------------------
// Template names — source of truth for all email template identifiers
// ---------------------------------------------------------------------------

export const templateNameValues = [
  "submission-received",
  "submission-accepted",
  "submission-rejected",
  "submission-withdrawn",
  "contract-ready",
  "copyeditor-assigned",
  "editor-message",
] as const;

export const templateNameSchema = z.enum(templateNameValues);
export type EmailTemplateName = z.infer<typeof templateNameSchema>;

// ---------------------------------------------------------------------------
// Merge fields — allowed {{field}} placeholders per template
// ---------------------------------------------------------------------------

export const TEMPLATE_MERGE_FIELDS: Record<
  EmailTemplateName,
  readonly string[]
> = {
  "submission-received": [
    "submissionTitle",
    "submitterName",
    "submitterEmail",
    "orgName",
    "submissionUrl",
  ],
  "submission-accepted": [
    "submissionTitle",
    "submitterName",
    "submitterEmail",
    "orgName",
    "editorComment",
  ],
  "submission-rejected": [
    "submissionTitle",
    "submitterName",
    "submitterEmail",
    "orgName",
    "editorComment",
  ],
  "submission-withdrawn": [
    "submissionTitle",
    "submitterName",
    "submitterEmail",
    "orgName",
  ],
  "contract-ready": ["submissionTitle", "signerName", "orgName", "contractUrl"],
  "copyeditor-assigned": [
    "submissionTitle",
    "copyeditorName",
    "orgName",
    "pipelineUrl",
  ],
  "editor-message": [
    "submissionTitle",
    "orgName",
    "editorName",
    "messageSubject",
    "messageBody",
  ],
};

// ---------------------------------------------------------------------------
// Sample data — used for live preview rendering
// ---------------------------------------------------------------------------

export const TEMPLATE_SAMPLE_DATA: Record<
  EmailTemplateName,
  Record<string, string>
> = {
  "submission-received": {
    submissionTitle: "The Garden of Forking Paths",
    submitterName: "Jorge Luis Borges",
    submitterEmail: "borges@example.com",
    orgName: "The Paris Review",
    submissionUrl: "https://example.com/submissions/123",
  },
  "submission-accepted": {
    submissionTitle: "The Garden of Forking Paths",
    submitterName: "Jorge Luis Borges",
    submitterEmail: "borges@example.com",
    orgName: "The Paris Review",
    editorComment:
      "We loved your piece and would like to feature it in our spring issue.",
  },
  "submission-rejected": {
    submissionTitle: "The Garden of Forking Paths",
    submitterName: "Jorge Luis Borges",
    submitterEmail: "borges@example.com",
    orgName: "The Paris Review",
    editorComment:
      "While we admired the craft, it wasn't the right fit for our current issue.",
  },
  "submission-withdrawn": {
    submissionTitle: "The Garden of Forking Paths",
    submitterName: "Jorge Luis Borges",
    submitterEmail: "borges@example.com",
    orgName: "The Paris Review",
  },
  "contract-ready": {
    submissionTitle: "The Garden of Forking Paths",
    signerName: "Jorge Luis Borges",
    orgName: "The Paris Review",
    contractUrl: "https://example.com/contracts/456",
  },
  "copyeditor-assigned": {
    submissionTitle: "The Garden of Forking Paths",
    copyeditorName: "Maxwell Perkins",
    orgName: "The Paris Review",
    pipelineUrl: "https://example.com/pipeline/789",
  },
  "editor-message": {
    submissionTitle: "The Garden of Forking Paths",
    orgName: "The Paris Review",
    editorName: "George Plimpton",
    messageSubject: "A note about your submission",
    messageBody: "<p>We have a few questions about your piece.</p>",
  },
};

// ---------------------------------------------------------------------------
// Labels — human-readable names and descriptions for each template
// ---------------------------------------------------------------------------

export const TEMPLATE_LABELS: Record<
  EmailTemplateName,
  { label: string; description: string }
> = {
  "submission-received": {
    label: "Submission Received",
    description:
      "Sent to editors when a new submission is received by the magazine.",
  },
  "submission-accepted": {
    label: "Submission Accepted",
    description: "Sent to the writer when their submission is accepted.",
  },
  "submission-rejected": {
    label: "Submission Rejected",
    description: "Sent to the writer when their submission is declined.",
  },
  "submission-withdrawn": {
    label: "Submission Withdrawn",
    description: "Sent to editors when a writer withdraws their submission.",
  },
  "contract-ready": {
    label: "Contract Ready",
    description: "Sent to the writer when a contract is ready to sign.",
  },
  "copyeditor-assigned": {
    label: "Copyeditor Assigned",
    description: "Sent to the copyeditor when they are assigned a submission.",
  },
  "editor-message": {
    label: "Editor Message",
    description: "Wrapper for personalized messages from editors to writers.",
  },
};

// ---------------------------------------------------------------------------
// Input schemas
// ---------------------------------------------------------------------------

export const upsertEmailTemplateSchema = z.object({
  templateName: templateNameSchema,
  subjectTemplate: z.string().trim().min(1).max(512),
  bodyHtml: z.string().trim().min(1).max(65535),
});

export type UpsertEmailTemplateInput = z.infer<
  typeof upsertEmailTemplateSchema
>;

export const getEmailTemplateSchema = z.object({
  templateName: templateNameSchema,
});

export const previewEmailTemplateSchema = z.object({
  templateName: templateNameSchema,
  subjectTemplate: z.string().trim().min(1).max(512),
  bodyHtml: z.string().trim().min(1).max(65535),
});

// ---------------------------------------------------------------------------
// Response schemas
// ---------------------------------------------------------------------------

export const emailTemplateSchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string().uuid(),
  templateName: templateNameSchema,
  subjectTemplate: z.string(),
  bodyHtml: z.string(),
  isActive: z.boolean(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type EmailTemplateResponse = z.infer<typeof emailTemplateSchema>;

export const emailTemplatePreviewSchema = z.object({
  html: z.string(),
  text: z.string(),
  subject: z.string(),
});

export const emailTemplateListItemSchema = z.object({
  templateName: templateNameSchema,
  label: z.string(),
  description: z.string(),
  isCustomized: z.boolean(),
  mergeFields: z.array(z.string()),
});
