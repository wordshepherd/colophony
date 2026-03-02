import { z } from "zod";
import { primaryGenreSchema } from "./csr";

// ---------------------------------------------------------------------------
// Sim-sub policy types
// ---------------------------------------------------------------------------

export const simSubPolicyTypeSchema = z.enum([
  "prohibited",
  "allowed",
  "allowed_notify",
  "allowed_withdraw",
]);
export type SimSubPolicyType = z.infer<typeof simSubPolicyTypeSchema>;

export const simSubGenreOverrideSchema = z.object({
  genre: primaryGenreSchema,
  type: simSubPolicyTypeSchema,
});
export type SimSubGenreOverride = z.infer<typeof simSubGenreOverrideSchema>;

export const simSubPolicySchema = z.object({
  type: simSubPolicyTypeSchema,
  notifyWindowHours: z.number().int().min(1).optional(),
  genreOverrides: z.array(simSubGenreOverrideSchema).optional(),
  notes: z.string().max(1000).optional(),
});
export type SimSubPolicy = z.infer<typeof simSubPolicySchema>;

export const simSubPolicyRequirementSchema = z.object({
  type: z.enum(["notify", "withdraw"]),
  windowHours: z.number().int().optional(),
  acknowledgedAt: z.string().datetime().optional(),
  dueAt: z.string().datetime().optional(),
});
export type SimSubPolicyRequirement = z.infer<
  typeof simSubPolicyRequirementSchema
>;

// ---------------------------------------------------------------------------
// Version-aware conflict types
// ---------------------------------------------------------------------------

export const siblingVersionConflictSchema = z.object({
  versionId: z.string().uuid(),
  versionNumber: z.number().int(),
  submissionId: z.string().uuid(),
  publicationName: z.string(),
  status: z.string(),
  submittedAt: z.string().datetime().nullable(),
});
export type SiblingVersionConflict = z.infer<
  typeof siblingVersionConflictSchema
>;

export const writerDisclosedConflictSchema = z.object({
  externalSubmissionId: z.string().uuid(),
  journalName: z.string(),
  status: z.string(),
  sentAt: z.string().datetime().nullable(),
});
export type WriterDisclosedConflict = z.infer<
  typeof writerDisclosedConflictSchema
>;
