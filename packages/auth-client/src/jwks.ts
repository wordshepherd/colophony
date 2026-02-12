import { createRemoteJWKSet, jwtVerify } from "jose";
import type { JwksConfig, VerifiedToken } from "./types.js";

/**
 * Creates a reusable OIDC token verifier backed by a remote JWKS endpoint.
 *
 * The JWKS is fetched once and cached with automatic cooldown-based refresh.
 * Validates issuer, audience, signing algorithm, and azp (for multi-audience tokens).
 */
export function createJwksVerifier(config: JwksConfig) {
  // Zitadel issues tokens with trailing slash on issuer
  const issuer = config.authority.replace(/\/+$/, "") + "/";
  const jwksUrl = new URL("/oauth/v2/keys", issuer);

  const JWKS = createRemoteJWKSet(jwksUrl, {
    cooldownDuration: 30_000, // 30s between refetches
    cacheMaxAge: 10 * 60 * 1000, // 10 min cache
  });

  return async function verifyToken(token: string): Promise<VerifiedToken> {
    const { payload, protectedHeader } = await jwtVerify(token, JWKS, {
      issuer,
      audience: config.clientId || undefined,
      algorithms: config.algorithms ?? ["RS256", "ES256"],
      clockTolerance: config.clockTolerance ?? 5,
    });

    // Enforce azp when aud is multi-valued (OIDC spec)
    if (config.clientId && Array.isArray(payload.aud)) {
      if (!payload.azp || payload.azp !== config.clientId) {
        throw new Error("invalid_azp");
      }
    }

    return { payload, header: protectedHeader };
  };
}
