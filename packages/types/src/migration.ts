import { z } from "zod";
import { transferFileManifestEntrySchema } from "./transfer";

// ---------------------------------------------------------------------------
// Identity migration status enum
// ---------------------------------------------------------------------------

export const identityMigrationStatusSchema = z.enum([
  "PENDING",
  "PENDING_APPROVAL",
  "APPROVED",
  "BUNDLE_SENT",
  "PROCESSING",
  "COMPLETED",
  "REJECTED",
  "FAILED",
  "EXPIRED",
  "CANCELLED",
]);
export type IdentityMigrationStatus = z.infer<
  typeof identityMigrationStatusSchema
>;

// ---------------------------------------------------------------------------
// Migration bundle — submission history (closed submissions, metadata only)
// ---------------------------------------------------------------------------

export const migrationSubmissionHistorySchema = z.object({
  originSubmissionId: z.string().uuid(),
  title: z.string().nullable(),
  genre: z.string().nullable(),
  coverLetter: z.string().nullable(),
  status: z.string(),
  formData: z.record(z.string(), z.unknown()).nullable(),
  submittedAt: z.string().datetime().nullable(),
  decidedAt: z.string().datetime().nullable(),
  publicationName: z.string().nullable(),
  periodName: z.string().nullable(),
});
export type MigrationSubmissionHistory = z.infer<
  typeof migrationSubmissionHistorySchema
>;

// ---------------------------------------------------------------------------
// Migration bundle — active submissions (full data + file manifest)
// ---------------------------------------------------------------------------

export const migrationActiveSubmissionSchema = z.object({
  originSubmissionId: z.string().uuid(),
  title: z.string().nullable(),
  genre: z.string().nullable(),
  coverLetter: z.string().nullable(),
  status: z.string(),
  formData: z.record(z.string(), z.unknown()).nullable(),
  submittedAt: z.string().datetime().nullable(),
  decidedAt: z.string().datetime().nullable(),
  publicationName: z.string().nullable(),
  periodName: z.string().nullable(),
  content: z.string().nullable(),
  fileManifest: z.array(transferFileManifestEntrySchema),
  contentFingerprint: z.string().nullable(),
});
export type MigrationActiveSubmission = z.infer<
  typeof migrationActiveSubmissionSchema
>;

// ---------------------------------------------------------------------------
// Migration bundle — full bundle sent from origin to destination
// ---------------------------------------------------------------------------

export const migrationBundleSchema = z.object({
  protocolVersion: z.string().default("1.0"),
  originDomain: z.string(),
  userDid: z.string(),
  destinationDomain: z.string(),
  destinationUserDid: z.string().nullable(),
  identity: z.object({
    email: z.string().email(),
    alsoKnownAs: z.array(z.string()),
  }),
  submissionHistory: z.array(migrationSubmissionHistorySchema),
  activeSubmissions: z.array(migrationActiveSubmissionSchema),
  bundleToken: z.string(),
  createdAt: z.string().datetime(),
});
export type MigrationBundle = z.infer<typeof migrationBundleSchema>;

// ---------------------------------------------------------------------------
// S2S request/response schemas
// ---------------------------------------------------------------------------

/** Destination → origin: request migration. */
export const migrationInitiateRequestSchema = z.object({
  userEmail: z.string().email(),
  destinationDomain: z.string(),
  destinationUserDid: z.string().nullable(),
  callbackUrl: z.string().url(),
  protocolVersion: z.string().default("1.0"),
});
export type MigrationInitiateRequest = z.infer<
  typeof migrationInitiateRequestSchema
>;

/** Origin response to initiate request. */
export const migrationInitiateResponseSchema = z.object({
  migrationId: z.string().uuid(),
  status: z.literal("pending_approval"),
});
export type MigrationInitiateResponse = z.infer<
  typeof migrationInitiateResponseSchema
>;

/** Origin → destination: bundle delivery via callback URL. */
export const migrationBundleDeliverySchema = z.object({
  migrationId: z.string().uuid(),
  bundle: migrationBundleSchema,
});
export type MigrationBundleDelivery = z.infer<
  typeof migrationBundleDeliverySchema
>;

/** Destination ack after receiving bundle. */
export const migrationBundleAckSchema = z.object({
  migrationId: z.string().uuid(),
  status: z.enum(["accepted", "failed"]),
  message: z.string().optional(),
});
export type MigrationBundleAck = z.infer<typeof migrationBundleAckSchema>;

/** Destination → origin: migration completed. */
export const migrationCompleteNotifySchema = z.object({
  migrationId: z.string().uuid(),
  destinationUserDid: z.string(),
  status: z.literal("completed"),
});
export type MigrationCompleteNotify = z.infer<
  typeof migrationCompleteNotifySchema
>;

/** Origin → all peers: migration broadcast. */
export const migrationBroadcastSchema = z.object({
  userDid: z.string(),
  migratedToDomain: z.string(),
  migratedToUserDid: z.string(),
  originDomain: z.string(),
});
export type MigrationBroadcast = z.infer<typeof migrationBroadcastSchema>;

// ---------------------------------------------------------------------------
// Full migration record (admin/tRPC)
// ---------------------------------------------------------------------------

export const identityMigrationSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  organizationId: z.string().uuid().nullable(),
  direction: z.string(),
  peerDomain: z.string(),
  peerInstanceUrl: z.string().nullable(),
  userDid: z.string().nullable(),
  peerUserDid: z.string().nullable(),
  status: identityMigrationStatusSchema,
  migrationToken: z.string().nullable(),
  tokenExpiresAt: z.date().nullable(),
  callbackUrl: z.string().nullable(),
  bundleMetadata: z.unknown().nullable(),
  failureReason: z.string().nullable(),
  approvedAt: z.date().nullable(),
  completedAt: z.date().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
});
export type IdentityMigration = z.infer<typeof identityMigrationSchema>;

// ---------------------------------------------------------------------------
// Input schemas for tRPC / admin routes
// ---------------------------------------------------------------------------

/** Input: request a migration from destination side. */
export const requestMigrationInputSchema = z.object({
  originDomain: z.string().min(1),
  originEmail: z.string().email(),
  organizationId: z.string().uuid(),
});
export type RequestMigrationInput = z.infer<typeof requestMigrationInputSchema>;

/** Param schema for migration ID. */
export const migrationIdParamSchema = z.object({
  migrationId: z.string().uuid(),
});
export type MigrationIdParam = z.infer<typeof migrationIdParamSchema>;

/** Query schema for listing migrations. */
export const migrationListQuerySchema = z.object({
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
  direction: z.enum(["inbound", "outbound"]).optional(),
  status: identityMigrationStatusSchema.optional(),
});
export type MigrationListQuery = z.infer<typeof migrationListQuerySchema>;

/** Param schema for migration file serve endpoint. */
export const migrationFileParamsSchema = z.object({
  migrationId: z.string().uuid(),
  submissionId: z.string().uuid(),
  fileId: z.string().uuid(),
});
export type MigrationFileParams = z.infer<typeof migrationFileParamsSchema>;
