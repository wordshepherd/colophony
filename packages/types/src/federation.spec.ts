import { describe, it, expect } from "vitest";
import { federationMetadataSchema } from "./federation.js";

const validMetadata = {
  software: "colophony" as const,
  version: "2.0.0-dev",
  domain: "magazine.example",
  publicKey:
    "-----BEGIN PUBLIC KEY-----\nMCowBQYDK2VwAyEA...\n-----END PUBLIC KEY-----",
  keyId: "magazine.example#main",
  capabilities: ["identity"],
  mode: "allowlist" as const,
  contactEmail: null,
  publications: [],
};

describe("federationMetadataSchema", () => {
  it("accepts valid metadata", () => {
    const result = federationMetadataSchema.safeParse(validMetadata);
    expect(result.success).toBe(true);
  });

  it("accepts domain with port", () => {
    const result = federationMetadataSchema.safeParse({
      ...validMetadata,
      domain: "localhost:4000",
      keyId: "localhost:4000#main",
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid PEM publicKey", () => {
    const result = federationMetadataSchema.safeParse({
      ...validMetadata,
      publicKey: "not-a-pem",
    });
    expect(result.success).toBe(false);
  });

  it("rejects empty keyId", () => {
    const result = federationMetadataSchema.safeParse({
      ...validMetadata,
      keyId: "",
    });
    expect(result.success).toBe(false);
  });

  it("rejects keyId without hash fragment", () => {
    const result = federationMetadataSchema.safeParse({
      ...validMetadata,
      keyId: "magazine.example-main",
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid domain format", () => {
    const result = federationMetadataSchema.safeParse({
      ...validMetadata,
      domain: "-bad",
    });
    expect(result.success).toBe(false);
  });

  it("accepts metadata with trustedPeers", () => {
    const result = federationMetadataSchema.safeParse({
      ...validMetadata,
      trustedPeers: ["peer.example"],
    });
    expect(result.success).toBe(true);
  });

  it("accepts metadata without trustedPeers", () => {
    const result = federationMetadataSchema.safeParse(validMetadata);
    expect(result.success).toBe(true);
  });

  it("rejects empty version", () => {
    const result = federationMetadataSchema.safeParse({
      ...validMetadata,
      version: "",
    });
    expect(result.success).toBe(false);
  });
});
