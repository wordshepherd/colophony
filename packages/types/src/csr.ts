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

export const updateWriterProfileSchema = createWriterProfileSchema.partial();

// --- List/Search schemas ---

export const listExternalSubmissionsSchema = z.object({
  search: z.string().optional(),
  status: csrStatusSchema.optional(),
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(100).default(20),
});

export type ListExternalSubmissionsInput = z.infer<
  typeof listExternalSubmissionsSchema
>;

export const listCorrespondenceByUserSchema = z.object({
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(100).default(20),
});

export type ListCorrespondenceByUserInput = z.infer<
  typeof listCorrespondenceByUserSchema
>;

export const journalDirectorySearchSchema = z.object({
  query: z.string().min(1).max(500),
  limit: z.number().int().min(1).max(50).default(10),
});

export type JournalDirectorySearchInput = z.infer<
  typeof journalDirectorySearchSchema
>;

export const journalDirectoryEntrySchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  externalUrl: z.string().nullable(),
  colophonyDomain: z.string().nullable(),
});

export type JournalDirectoryEntry = z.infer<typeof journalDirectoryEntrySchema>;

export const correspondenceUserListItemSchema = z.object({
  id: z.string().uuid(),
  submissionId: z.string().uuid().nullable(),
  externalSubmissionId: z.string().uuid().nullable(),
  direction: correspondenceDirectionSchema,
  channel: correspondenceChannelSchema,
  sentAt: z.string().datetime(),
  subject: z.string().nullable(),
  bodyPreview: z.string(),
  senderName: z.string().nullable(),
  isPersonalized: z.boolean(),
  source: z.enum(["colophony", "manual"]),
  journalName: z.string().nullable(),
});

export type CorrespondenceUserListItem = z.infer<
  typeof correspondenceUserListItemSchema
>;

export const workspaceStatsSchema = z.object({
  manuscriptCount: z.number().int(),
  pendingSubmissions: z.number().int(),
  acceptedSubmissions: z.number().int(),
  rejectedSubmissions: z.number().int(),
  acceptanceRate: z.number().nullable(),
  recentActivity: z.array(
    z.object({
      type: z.enum(["external_submission", "correspondence"]),
      id: z.string().uuid(),
      label: z.string(),
      timestamp: z.string().datetime(),
    }),
  ),
});

export type WorkspaceStats = z.infer<typeof workspaceStatsSchema>;

// ---------------------------------------------------------------------------
// CSR Export/Import — personal data portability
// ---------------------------------------------------------------------------

// --- Native submission (Colophony-origin, mirrors migration history fields) ---

export const csrNativeSubmissionSchema = z
  .object({
    originSubmissionId: z.string().uuid(),
    title: z.string().nullable(),
    genre: genreSchema.nullable(),
    coverLetter: z.string().nullable(),
    status: csrStatusSchema,
    formData: z.record(z.string(), z.unknown()).nullable(),
    submittedAt: z.string().datetime().nullable(),
    decidedAt: z.string().datetime().nullable(),
    publicationName: z.string().nullable(),
    periodName: z.string().nullable(),
    statusHistory: z.array(
      z.object({
        from: csrStatusSchema.nullable(),
        to: csrStatusSchema,
        changedAt: z.string().datetime(),
        comment: z.string().nullable(),
      }),
    ),
  })
  .describe("Colophony-native submission record for CSR export");

export type CSRNativeSubmission = z.infer<typeof csrNativeSubmissionSchema>;

// --- Manuscript summary (lightweight reference for export) ---

export const csrManuscriptSummarySchema = z.object({
  id: z.string().uuid(),
  title: z.string().nullable(),
  genre: genreSchema.nullable(),
  createdAt: z.string().datetime(),
});

export type CSRManuscriptSummary = z.infer<typeof csrManuscriptSummarySchema>;

// --- Export envelope ---

export const csrExportEnvelopeSchema = z
  .object({
    version: z.literal("1.0"),
    exportedAt: z.string().datetime(),
    identity: z.object({
      userId: z.string().uuid(),
      email: z.string().email(),
      displayName: z.string().nullable(),
    }),
    nativeSubmissions: z.array(csrNativeSubmissionSchema),
    externalSubmissions: z.array(externalSubmissionSchema),
    correspondence: z.array(correspondenceSchema),
    writerProfiles: z.array(writerProfileSchema),
    manuscripts: z.array(csrManuscriptSummarySchema),
  })
  .describe("Full CSR export envelope — personal data portability");

export type CSRExportEnvelope = z.infer<typeof csrExportEnvelopeSchema>;

// --- Import schemas ---

export const csrImportExternalSubmissionSchema = z.object({
  journalName: z.string().min(1).max(500),
  journalDirectoryId: z.string().uuid().optional(),
  status: csrStatusSchema.default("sent"),
  sentAt: z.string().datetime().optional(),
  respondedAt: z.string().datetime().optional(),
  method: z.string().max(100).optional(),
  notes: z.string().optional(),
  importedFrom: z.string().max(100).optional(),
});

export type CSRImportExternalSubmission = z.infer<
  typeof csrImportExternalSubmissionSchema
>;

export const csrImportCorrespondenceSchema = z.object({
  externalSubmissionIndex: z.number().int().min(0),
  direction: correspondenceDirectionSchema,
  channel: correspondenceChannelSchema.default("email"),
  sentAt: z.string().datetime(),
  subject: z.string().max(500).optional(),
  body: z.string().min(1),
  senderName: z.string().max(255).optional(),
  senderEmail: z.string().email().max(255).optional(),
  isPersonalized: z.boolean().default(false),
});

export type CSRImportCorrespondence = z.infer<
  typeof csrImportCorrespondenceSchema
>;

export const csrImportInputSchema = z.object({
  submissions: z.array(csrImportExternalSubmissionSchema).min(1).max(5000),
  correspondence: z.array(csrImportCorrespondenceSchema).default([]),
  importedFrom: z.string().max(100).default("csr_import"),
});

export type CSRImportInput = z.infer<typeof csrImportInputSchema>;

export const csrImportResultSchema = z.object({
  submissionsCreated: z.number().int(),
  correspondenceCreated: z.number().int(),
});

export type CSRImportResult = z.infer<typeof csrImportResultSchema>;
