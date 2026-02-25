import { z } from "zod";

// ---------------------------------------------------------------------------
// Piece transfer status enum
// ---------------------------------------------------------------------------

export const pieceTransferStatusSchema = z.enum([
  "PENDING",
  "FILES_REQUESTED",
  "COMPLETED",
  "REJECTED",
  "FAILED",
  "CANCELLED",
  "EXPIRED",
]);
export type PieceTransferStatus = z.infer<typeof pieceTransferStatusSchema>;

// ---------------------------------------------------------------------------
// File manifest entry
// ---------------------------------------------------------------------------

export const transferFileManifestEntrySchema = z.object({
  fileId: z.string().uuid().describe("ID of the file record"),
  filename: z.string().min(1).describe("Original filename"),
  mimeType: z.string().min(1).describe("MIME type of the file"),
  size: z.number().int().positive().describe("File size in bytes"),
});
export type TransferFileManifestEntry = z.infer<
  typeof transferFileManifestEntrySchema
>;

// ---------------------------------------------------------------------------
// Piece metadata (sent with transfer initiation)
// ---------------------------------------------------------------------------

export const transferPieceMetadataSchema = z.object({
  title: z.string().optional().describe("Title of the piece"),
  coverLetter: z.string().optional().describe("Cover letter text"),
  genre: z.string().optional().describe("Genre or category"),
  contentFingerprint: z
    .string()
    .optional()
    .describe("SHA-256 fingerprint of the content"),
});
export type TransferPieceMetadata = z.infer<typeof transferPieceMetadataSchema>;

// ---------------------------------------------------------------------------
// S2S request/response — piece transfer initiation
// ---------------------------------------------------------------------------

/** Inbound S2S transfer initiation request. */
export const transferInitiateRequestSchema = z.object({
  transferToken: z.string().min(1).describe("Signed JWT transfer token"),
  submitterDid: z.string().min(1).describe("did:web URI of the submitter"),
  pieceMetadata: transferPieceMetadataSchema.describe(
    "Metadata about the piece being transferred",
  ),
  fileManifest: z
    .array(transferFileManifestEntrySchema)
    .min(1)
    .describe("Files included in the transfer"),
  protocolVersion: z
    .string()
    .default("1.0")
    .describe("Transfer protocol version"),
});
export type TransferInitiateRequest = z.infer<
  typeof transferInitiateRequestSchema
>;

/** S2S transfer initiation response. */
export const transferInitiateResponseSchema = z.object({
  transferId: z.string().uuid().describe("ID assigned by destination"),
  status: z.literal("accepted").describe("Transfer was accepted"),
});
export type TransferInitiateResponse = z.infer<
  typeof transferInitiateResponseSchema
>;

// ---------------------------------------------------------------------------
// Full transfer record (admin/tRPC)
// ---------------------------------------------------------------------------

export const pieceTransferSchema = z.object({
  id: z.string().uuid(),
  submissionId: z.string().uuid(),
  manuscriptVersionId: z.string().uuid(),
  initiatedByUserId: z.string().uuid(),
  targetDomain: z.string(),
  status: pieceTransferStatusSchema,
  transferToken: z.string(),
  tokenExpiresAt: z.date(),
  fileManifest: z.array(transferFileManifestEntrySchema),
  contentFingerprint: z.string().nullable(),
  submitterDid: z.string(),
  remoteTransferId: z.string().nullable(),
  remoteResponse: z.unknown().nullable(),
  failureReason: z.string().nullable(),
  completedAt: z.date().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
});
export type PieceTransfer = z.infer<typeof pieceTransferSchema>;

// ---------------------------------------------------------------------------
// Input schemas for tRPC / admin routes
// ---------------------------------------------------------------------------

/** tRPC input: initiate a transfer. */
export const initiateTransferInputSchema = z.object({
  submissionId: z
    .string()
    .uuid()
    .describe("ID of the rejected submission to transfer"),
  targetDomain: z
    .string()
    .min(1)
    .describe("Domain of the destination instance"),
});
export type InitiateTransferInput = z.infer<typeof initiateTransferInputSchema>;

/** Param schema for transfer ID. */
export const transferIdParamSchema = z.object({
  transferId: z.string().uuid().describe("ID of the transfer"),
});
export type TransferIdParam = z.infer<typeof transferIdParamSchema>;

/** Query schema for listing transfers. */
export const transferListQuerySchema = z.object({
  page: z.coerce
    .number()
    .int()
    .min(1)
    .default(1)
    .describe("Page number (1-based)"),
  limit: z.coerce
    .number()
    .int()
    .min(1)
    .max(100)
    .default(20)
    .describe("Items per page"),
});
export type TransferListQuery = z.infer<typeof transferListQuerySchema>;

/** Param schema for file serve endpoint. */
export const transferFileParamsSchema = z.object({
  transferId: z.string().uuid().describe("ID of the transfer"),
  fileId: z.string().uuid().describe("ID of the file to fetch"),
});
export type TransferFileParams = z.infer<typeof transferFileParamsSchema>;
