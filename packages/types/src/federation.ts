import { z } from "zod";

// ---------------------------------------------------------------------------
// .well-known/colophony — Instance Metadata
// ---------------------------------------------------------------------------

export const federationPublicationSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  slug: z.string(),
  organizationSlug: z.string(),
});

export type FederationPublication = z.infer<typeof federationPublicationSchema>;

export const federationMetadataSchema = z.object({
  software: z.literal("colophony"),
  version: z.string(),
  domain: z.string(),
  publicKey: z.string(),
  keyId: z.string(),
  capabilities: z.array(z.string()),
  mode: z.enum(["allowlist", "open", "managed_hub"]),
  contactEmail: z.string().nullable(),
  publications: z.array(federationPublicationSchema),
});

export type FederationMetadata = z.infer<typeof federationMetadataSchema>;

// ---------------------------------------------------------------------------
// .well-known/webfinger — RFC 7033 JRD
// ---------------------------------------------------------------------------

export const webFingerLinkSchema = z.object({
  rel: z.string(),
  type: z.string().optional(),
  href: z.string().optional(),
});

export type WebFingerLink = z.infer<typeof webFingerLinkSchema>;

export const webFingerResponseSchema = z.object({
  subject: z.string(),
  aliases: z.array(z.string()).optional(),
  links: z.array(webFingerLinkSchema).optional(),
});

export type WebFingerResponse = z.infer<typeof webFingerResponseSchema>;

export const webFingerQuerySchema = z.object({
  resource: z.string().min(1, "resource parameter is required"),
  rel: z.string().optional(),
});

// ---------------------------------------------------------------------------
// DID Document — W3C did:web resolution
// ---------------------------------------------------------------------------

export const didVerificationMethodSchema = z.object({
  id: z.string(),
  type: z.literal("JsonWebKey2020"),
  controller: z.string(),
  publicKeyJwk: z.object({
    kty: z.literal("OKP"),
    crv: z.literal("Ed25519"),
    x: z.string(),
  }),
});

export type DidVerificationMethod = z.infer<typeof didVerificationMethodSchema>;

export const didServiceEndpointSchema = z.object({
  id: z.string(),
  type: z.string(),
  serviceEndpoint: z.string().url(),
});

export type DidServiceEndpoint = z.infer<typeof didServiceEndpointSchema>;

export const didDocumentSchema = z.object({
  "@context": z.array(z.string()),
  id: z.string(),
  alsoKnownAs: z.array(z.string()).optional(),
  verificationMethod: z.array(didVerificationMethodSchema),
  authentication: z.array(z.string()),
  assertionMethod: z.array(z.string()).optional(),
  service: z.array(didServiceEndpointSchema).optional(),
});

export type DidDocument = z.infer<typeof didDocumentSchema>;

// ---------------------------------------------------------------------------
// Trust Establishment — Bilateral Federation Trust
// ---------------------------------------------------------------------------

export const peerTrustStatusSchema = z.enum([
  "pending_outbound",
  "pending_inbound",
  "active",
  "rejected",
  "revoked",
]);

export type PeerTrustStatus = z.infer<typeof peerTrustStatusSchema>;

export const federationCapabilitiesSchema = z.object({
  "identity.verify": z.boolean().optional(),
  "identity.migrate": z.boolean().optional(),
  "simsub.check": z.boolean().optional(),
  "simsub.respond": z.boolean().optional(),
  "transfer.initiate": z.boolean().optional(),
  "transfer.receive": z.boolean().optional(),
});

export type FederationCapabilities = z.infer<
  typeof federationCapabilitiesSchema
>;

export const trustRequestSchema = z.object({
  instanceUrl: z.string().url(),
  domain: z.string().min(1),
  publicKey: z.string().min(1),
  keyId: z.string().min(1),
  requestedCapabilities: federationCapabilitiesSchema,
  protocolVersion: z.string().default("1.0"),
});

export type TrustRequest = z.infer<typeof trustRequestSchema>;

export const trustAcceptSchema = z.object({
  instanceUrl: z.string().url(),
  domain: z.string().min(1),
  grantedCapabilities: federationCapabilitiesSchema,
  protocolVersion: z.string().default("1.0"),
});

export type TrustAccept = z.infer<typeof trustAcceptSchema>;

export const initiateTrustSchema = z.object({
  domain: z.string().min(1),
  requestedCapabilities: federationCapabilitiesSchema,
});

export type InitiateTrustInput = z.infer<typeof initiateTrustSchema>;

export const peerActionSchema = z.object({
  grantedCapabilities: federationCapabilitiesSchema.optional(),
});

export type PeerActionInput = z.infer<typeof peerActionSchema>;

export const trustedPeerSchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string().uuid(),
  domain: z.string(),
  instanceUrl: z.string(),
  publicKey: z.string(),
  keyId: z.string(),
  grantedCapabilities: z.record(z.string(), z.boolean()),
  status: peerTrustStatusSchema,
  initiatedBy: z.enum(["local", "remote"]),
  protocolVersion: z.string(),
  lastVerifiedAt: z.date().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type TrustedPeer = z.infer<typeof trustedPeerSchema>;

export const remoteMetadataPreviewSchema = z.object({
  domain: z.string(),
  software: z.string(),
  version: z.string(),
  publicKey: z.string(),
  keyId: z.string(),
  capabilities: z.array(z.string()),
  mode: z.string(),
  contactEmail: z.string().nullable(),
  publicationCount: z.number(),
});

export type RemoteMetadataPreview = z.infer<typeof remoteMetadataPreviewSchema>;

export const domainParamSchema = z.object({
  domain: z
    .string()
    .min(1)
    .regex(/^[a-zA-Z0-9][a-zA-Z0-9.-]+(:\d+)?$/, "Invalid domain format"),
});

export type DomainParam = z.infer<typeof domainParamSchema>;
