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
  verificationMethod: z.array(didVerificationMethodSchema),
  authentication: z.array(z.string()),
  assertionMethod: z.array(z.string()).optional(),
  service: z.array(didServiceEndpointSchema).optional(),
});

export type DidDocument = z.infer<typeof didDocumentSchema>;
