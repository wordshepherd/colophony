import { createRemoteJWKSet, jwtVerify } from "jose";
import type { JwksConfig, VerifiedToken } from "./types.js";

/**
 * Creates a reusable OIDC token verifier backed by a remote JWKS endpoint.
 *
 * The JWKS is fetched once and cached with automatic cooldown-based refresh.
 * Validates issuer, audience, signing algorithm, and azp (for multi-audience tokens).
 */
export function createJwksVerifier(config: JwksConfig) {
  // Normalize issuer: strip trailing slash for matching. jose v5+ accepts
  // string or string[] for the issuer check, so we accept both with and
  // without trailing slash to handle Zitadel version differences.
  const base = config.authority.replace(/\/+$/, "");
  const issuer = [base, base + "/"];
  const jwksUrl = new URL("/oauth/v2/keys", base + "/");

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

    // Enforce azp when aud is multi-valued (OIDC spec §2).
    // Zitadel's JWT access tokens may omit azp, so only reject when azp is
    // present but doesn't match — don't reject tokens that simply lack azp.
    if (config.clientId && Array.isArray(payload.aud) && payload.azp) {
      if (payload.azp !== config.clientId) {
        throw new Error("invalid_azp");
      }
    }

    return { payload, header: protectedHeader };
  };
}
