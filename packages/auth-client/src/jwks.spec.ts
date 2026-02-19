import { describe, it, expect, vi, beforeEach } from "vitest";
import { SignJWT, exportJWK, generateKeyPair } from "jose";

// We test createJwksVerifier by mocking jose's createRemoteJWKSet and jwtVerify.
// This avoids needing a real HTTP server for the JWKS endpoint.

// Mock jose module — we intercept createRemoteJWKSet and jwtVerify
vi.mock("jose", async () => {
  const actual = await vi.importActual<typeof import("jose")>("jose");
  return {
    ...actual,
    createRemoteJWKSet: vi.fn(),
  };
});

import { createRemoteJWKSet } from "jose";
import { createJwksVerifier } from "./jwks.js";

// Generate a real RS256 key pair for signing test tokens
let privateKey: CryptoKey;
let publicKey: CryptoKey;

beforeEach(async () => {
  const pair = await generateKeyPair("RS256");
  privateKey = pair.privateKey;
  publicKey = pair.publicKey;

  // Mock createRemoteJWKSet to return a function that resolves to the public key
  vi.mocked(createRemoteJWKSet).mockReturnValue(
    (async (_protectedHeader: unknown, _token: unknown) =>
      publicKey) as ReturnType<typeof createRemoteJWKSet>,
  );
});

async function signToken(
  claims: Record<string, unknown>,
  opts?: { algorithm?: string; expiresIn?: string },
): Promise<string> {
  let builder = new SignJWT(claims)
    .setProtectedHeader({ alg: opts?.algorithm ?? "RS256" })
    .setIssuedAt()
    .setIssuer("http://localhost:8080/")
    .setExpirationTime(opts?.expiresIn ?? "1h");

  return builder.sign(privateKey);
}

describe("createJwksVerifier", () => {
  it("verifies a valid token with correct issuer", async () => {
    const verify = createJwksVerifier({
      authority: "http://localhost:8080",
    });

    const token = await signToken({ sub: "user-123" });
    const result = await verify(token);

    expect(result.payload.sub).toBe("user-123");
    expect(result.payload.iss).toBe("http://localhost:8080/");
    expect(result.header.alg).toBe("RS256");
  });

  it("verifies token with audience claim", async () => {
    const verify = createJwksVerifier({
      authority: "http://localhost:8080",
      clientId: "my-client",
    });

    const token = await signToken({ sub: "user-123", aud: "my-client" });
    const result = await verify(token);

    expect(result.payload.sub).toBe("user-123");
  });

  it("rejects token with wrong audience", async () => {
    const verify = createJwksVerifier({
      authority: "http://localhost:8080",
      clientId: "my-client",
    });

    const token = await signToken({ sub: "user-123", aud: "wrong-client" });
    await expect(verify(token)).rejects.toThrow();
  });

  it("enforces azp for multi-audience tokens", async () => {
    const verify = createJwksVerifier({
      authority: "http://localhost:8080",
      clientId: "my-client",
    });

    // Multi-aud token with correct azp
    const goodToken = await signToken({
      sub: "user-123",
      aud: ["my-client", "other-service"],
      azp: "my-client",
    });
    const result = await verify(goodToken);
    expect(result.payload.sub).toBe("user-123");

    // Multi-aud token with wrong azp
    const badToken = await signToken({
      sub: "user-123",
      aud: ["my-client", "other-service"],
      azp: "wrong-client",
    });
    await expect(verify(badToken)).rejects.toThrow("invalid_azp");

    // Multi-aud token with no azp — allowed (Zitadel omits azp in JWT access tokens)
    const noAzpToken = await signToken({
      sub: "user-123",
      aud: ["my-client", "other-service"],
    });
    await expect(verify(noAzpToken)).resolves.toBeDefined();
  });

  it("rejects expired token", async () => {
    const verify = createJwksVerifier({
      authority: "http://localhost:8080",
    });

    const token = await signToken({ sub: "user-123" }, { expiresIn: "-1h" });
    await expect(verify(token)).rejects.toThrow();
  });

  it("normalizes authority with trailing slash", async () => {
    const verify = createJwksVerifier({
      authority: "http://localhost:8080/",
    });

    const token = await signToken({ sub: "user-123" });
    const result = await verify(token);
    expect(result.payload.iss).toBe("http://localhost:8080/");
  });

  it("passes JWKS URL with /oauth/v2/keys path", () => {
    createJwksVerifier({ authority: "http://localhost:8080" });

    expect(createRemoteJWKSet).toHaveBeenCalledWith(
      new URL("http://localhost:8080/oauth/v2/keys"),
      expect.objectContaining({
        cooldownDuration: 30_000,
        cacheMaxAge: 600_000,
      }),
    );
  });
});
