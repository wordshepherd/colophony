import { z } from "zod";
import {
  simSubPolicySchema,
  siblingVersionConflictSchema,
  writerDisclosedConflictSchema,
} from "./sim-sub-policy";

// ---------------------------------------------------------------------------
// Sim-sub check result enum
// ---------------------------------------------------------------------------

export const simSubCheckResultSchema = z.enum([
  "CLEAR",
  "CONFLICT",
  "PARTIAL",
  "SKIPPED",
]);
export type SimSubCheckResult = z.infer<typeof simSubCheckResultSchema>;

// ---------------------------------------------------------------------------
// S2S request/response — Blind Submission Attestation Protocol (BSAP)
// ---------------------------------------------------------------------------

/** Inbound S2S sim-sub check request. */
export const simSubCheckRequestSchema = z.object({
  fingerprint: z
    .string()
    .length(64)
    .regex(/^[a-f0-9]+$/)
    .describe("SHA-256 hex fingerprint of the submission content"),
  submitterDid: z.string().min(1).describe("did:web URI of the submitter"),
  requestingDomain: z
    .string()
    .min(1)
    .describe("Domain of the requesting instance"),
  protocolVersion: z.string().default("1.0").describe("BSAP protocol version"),
});
export type SimSubCheckRequest = z.infer<typeof simSubCheckRequestSchema>;

/** A conflict found at a publication. */
export const simSubConflictSchema = z.object({
  publicationName: z.string().describe("Name of the publication"),
  submittedAt: z.string().describe("ISO-8601 submission timestamp"),
  periodName: z.string().optional().describe("Name of the submission period"),
});
export type SimSubConflict = z.infer<typeof simSubConflictSchema>;

/** S2S sim-sub check response. */
export const simSubCheckResponseSchema = z.object({
  found: z.boolean().describe("Whether conflicts were found"),
  conflicts: z
    .array(simSubConflictSchema)
    .describe("List of conflicting submissions"),
});
export type SimSubCheckResponse = z.infer<typeof simSubCheckResponseSchema>;

/** Result from checking a single remote instance. */
export const simSubRemoteResultSchema = z.object({
  domain: z.string().describe("Domain of the checked instance"),
  status: z
    .enum(["checked", "timeout", "error", "unreachable"])
    .describe("Outcome of the remote check"),
  found: z
    .boolean()
    .optional()
    .describe("Whether conflicts were found (only when status=checked)"),
  conflicts: z
    .array(simSubConflictSchema)
    .optional()
    .describe("Conflicts from this instance"),
  durationMs: z.number().optional().describe("Round-trip time in milliseconds"),
});
export type SimSubRemoteResult = z.infer<typeof simSubRemoteResultSchema>;

/** Full result of a sim-sub check (local + remote + version-aware). */
export const simSubFullCheckResultSchema = z.object({
  result: simSubCheckResultSchema.describe("Aggregated check result"),
  fingerprint: z.string().describe("The content fingerprint that was checked"),
  federationFingerprint: z
    .string()
    .describe("The federation fingerprint (filename:size based)"),
  localConflicts: z.array(simSubConflictSchema),
  remoteResults: z.array(simSubRemoteResultSchema),
  siblingVersionConflicts: z
    .array(siblingVersionConflictSchema)
    .optional()
    .describe("Active submissions on other versions of the same manuscript"),
  writerDisclosedConflicts: z
    .array(writerDisclosedConflictSchema)
    .optional()
    .describe("Active external submissions disclosed by the writer"),
  effectivePolicy: simSubPolicySchema
    .optional()
    .describe("The policy that was applied for this check"),
});
export type SimSubFullCheckResult = z.infer<typeof simSubFullCheckResultSchema>;
