import { z } from "zod";
import { federationCapabilitiesSchema } from "./federation";

// ---------------------------------------------------------------------------
// Hub Registration
// ---------------------------------------------------------------------------

export const hubRegistrationRequestSchema = z.object({
  domain: z.string().min(1),
  instanceUrl: z.string().url(),
  publicKey: z.string().min(1),
  keyId: z.string().min(1),
  registrationToken: z.string().min(1),
  protocolVersion: z.string().default("1.0"),
});

export type HubRegistrationRequest = z.infer<
  typeof hubRegistrationRequestSchema
>;

export const hubRegistrationResponseSchema = z.object({
  instanceId: z.string().uuid(),
  attestationToken: z.string(),
  attestationExpiresAt: z.string().datetime(),
  hubDomain: z.string(),
  hubPublicKey: z.string(),
});

export type HubRegistrationResponse = z.infer<
  typeof hubRegistrationResponseSchema
>;

// ---------------------------------------------------------------------------
// Attestation Trust (instance→instance auto-trust via hub)
// ---------------------------------------------------------------------------

export const hubAttestationTrustRequestSchema = z.object({
  instanceUrl: z.string().url(),
  domain: z.string().min(1),
  publicKey: z.string().min(1),
  keyId: z.string().min(1),
  attestationToken: z.string().min(1),
  hubDomain: z.string().min(1),
  requestedCapabilities: federationCapabilitiesSchema,
  protocolVersion: z.string().default("1.0"),
});

export type HubAttestationTrustRequest = z.infer<
  typeof hubAttestationTrustRequestSchema
>;

// ---------------------------------------------------------------------------
// Fingerprint Registration (instance→hub push)
// ---------------------------------------------------------------------------

export const hubFingerprintRegisterSchema = z.object({
  fingerprint: z.string().min(1),
  submitterDid: z.string().min(1),
  publicationName: z.string().optional(),
  submittedAt: z.string().datetime().optional(),
});

export type HubFingerprintRegister = z.infer<
  typeof hubFingerprintRegisterSchema
>;

// ---------------------------------------------------------------------------
// Fingerprint Lookup (instance→hub query)
// ---------------------------------------------------------------------------

export const hubFingerprintQuerySchema = z.object({
  fingerprint: z.string().min(1),
  submitterDid: z.string().min(1),
  requestingDomain: z.string().min(1),
});

export type HubFingerprintQuery = z.infer<typeof hubFingerprintQuerySchema>;

export const hubFingerprintConflictSchema = z.object({
  sourceDomain: z.string(),
  publicationName: z.string().nullable(),
  submittedAt: z.string().nullable(),
});

export const hubFingerprintResultSchema = z.object({
  found: z.boolean(),
  conflicts: z.array(hubFingerprintConflictSchema),
});

export type HubFingerprintResult = z.infer<typeof hubFingerprintResultSchema>;

// ---------------------------------------------------------------------------
// Hub Instance Admin
// ---------------------------------------------------------------------------

export const hubRegisteredInstanceSchema = z.object({
  id: z.string().uuid(),
  domain: z.string(),
  instanceUrl: z.string(),
  status: z.enum(["active", "suspended", "revoked"]),
  lastSeenAt: z.date().nullable(),
  metadata: z.record(z.string(), z.unknown()),
  createdAt: z.date(),
});

export type HubRegisteredInstance = z.infer<typeof hubRegisteredInstanceSchema>;

export const hubInstanceListQuerySchema = z.object({
  status: z.enum(["active", "suspended", "revoked"]).optional(),
});
