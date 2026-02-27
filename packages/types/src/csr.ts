import { z } from "zod";

// --- Genre ---

export const primaryGenreSchema = z
  .enum([
    "poetry",
    "fiction",
    "creative_nonfiction",
    "nonfiction",
    "drama",
    "translation",
    "visual_art",
    "comics",
    "audio",
    "other",
  ])
  .describe("Primary genre classification");

export type PrimaryGenre = z.infer<typeof primaryGenreSchema>;

export const genreSchema = z
  .object({
    primary: primaryGenreSchema,
    sub: z
      .string()
      .nullable()
      .describe("Freetext subgenre (e.g., 'flash', 'lyric essay')"),
    hybrid: z
      .array(primaryGenreSchema)
      .describe("Additional primary genres for hybrid work"),
  })
  .describe("Structured genre classification with hybrid support");

export type Genre = z.infer<typeof genreSchema>;

// --- CSR Status ---

export const csrStatusSchema = z
  .enum([
    "draft",
    "sent",
    "in_review",
    "hold",
    "accepted",
    "rejected",
    "withdrawn",
    "no_response",
    "revise",
    "unknown",
  ])
  .describe("Harmonized submission status across systems");

export type CSRStatus = z.infer<typeof csrStatusSchema>;

// --- Journal Reference ---

export const journalRefSchema = z
  .object({
    id: z.string().uuid().optional(),
    name: z.string().min(1).max(500),
    colophonyDomain: z.string().max(512).nullable().optional(),
    colophonyOrgId: z.string().uuid().nullable().optional(),
    externalUrl: z.string().url().max(1000).nullable().optional(),
    directoryIds: z.record(z.string(), z.string()).nullable().optional(),
  })
  .describe(
    "Journal identity reference — may be freetext-only or fully linked",
  );

export type JournalRef = z.infer<typeof journalRefSchema>;

// --- Correspondence ---

export const correspondenceDirectionSchema = z.enum(["inbound", "outbound"]);
export const correspondenceChannelSchema = z.enum([
  "email",
  "portal",
  "in_app",
  "other",
]);

export const correspondenceSchema = z
  .object({
    id: z.string().uuid(),
    submissionId: z.string().uuid().nullable(),
    externalSubmissionId: z.string().uuid().nullable(),
    direction: correspondenceDirectionSchema,
    channel: correspondenceChannelSchema,
    sentAt: z.string().datetime(),
    subject: z.string().max(500).nullable(),
    body: z.string().min(1),
    senderName: z.string().max(255).nullable(),
    senderEmail: z.string().email().max(255).nullable(),
    isPersonalized: z.boolean(),
    source: z.enum(["colophony", "manual"]),
    capturedAt: z.string().datetime(),
  })
  .describe("Editor-writer correspondence record");

export type Correspondence = z.infer<typeof correspondenceSchema>;

// --- External Submission ---

export const externalSubmissionSchema = z
  .object({
    id: z.string().uuid(),
    manuscriptId: z.string().uuid().nullable(),
    journalDirectoryId: z.string().uuid().nullable(),
    journalName: z.string().min(1).max(500),
    status: csrStatusSchema,
    sentAt: z.string().datetime().nullable(),
    respondedAt: z.string().datetime().nullable(),
    method: z.string().max(100).nullable(),
    notes: z.string().nullable(),
    importedFrom: z.string().max(100).nullable(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  })
  .describe("Manually-tracked external submission record");

export type ExternalSubmission = z.infer<typeof externalSubmissionSchema>;

// --- Writer Profile ---

export const writerProfileSchema = z
  .object({
    id: z.string().uuid(),
    platform: z.string().min(1).max(100),
    externalId: z.string().max(500).nullable(),
    profileUrl: z.string().url().max(1000).nullable(),
  })
  .describe("External platform profile link");

export type WriterProfile = z.infer<typeof writerProfileSchema>;

// --- Create/Update schemas (for service layer) ---

export const createExternalSubmissionSchema = z.object({
  manuscriptId: z.string().uuid().optional(),
  journalName: z.string().min(1).max(500),
  journalDirectoryId: z.string().uuid().optional(),
  status: csrStatusSchema.default("sent"),
  sentAt: z.string().datetime().optional(),
  respondedAt: z.string().datetime().optional(),
  method: z.string().max(100).optional(),
  notes: z.string().optional(),
});

export const updateExternalSubmissionSchema =
  createExternalSubmissionSchema.partial();

export const createCorrespondenceSchema = z
  .object({
    submissionId: z.string().uuid().optional(),
    externalSubmissionId: z.string().uuid().optional(),
    direction: correspondenceDirectionSchema,
    channel: correspondenceChannelSchema.default("email"),
    sentAt: z.string().datetime(),
    subject: z.string().max(500).optional(),
    body: z.string().min(1),
    senderName: z.string().max(255).optional(),
    senderEmail: z.string().email().max(255).optional(),
    isPersonalized: z.boolean().default(false),
    source: z.enum(["colophony", "manual"]).default("manual"),
  })
  .refine(
    (data) =>
      (data.submissionId != null) !== (data.externalSubmissionId != null),
    {
      message:
        "Exactly one of submissionId or externalSubmissionId must be provided",
    },
  );

export const createWriterProfileSchema = z.object({
  platform: z.string().min(1).max(100),
  externalId: z.string().max(500).optional(),
  profileUrl: z.string().url().max(1000).optional(),
});
