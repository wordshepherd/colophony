import { z } from "zod";

// ---------------------------------------------------------------------------
// v2 — Zitadel OIDC types
// ---------------------------------------------------------------------------

/** Validated OIDC token claims from Zitadel. */
export const oidcTokenClaimsSchema = z.object({
  /** Zitadel user ID (subject) */
  sub: z.string(),
  /** Issuer URL (Zitadel authority with trailing slash) */
  iss: z.string(),
  /** Audience — single string or array */
  aud: z.union([z.string(), z.array(z.string())]).optional(),
  /** Authorized party (required when aud is multi-valued) */
  azp: z.string().optional(),
  /** Issued-at timestamp */
  iat: z.number().optional(),
  /** Expiration timestamp */
  exp: z.number().optional(),
});

export type OidcTokenClaims = z.infer<typeof oidcTokenClaimsSchema>;

/** Per-request auth context populated by the auth hook. */
export interface AuthContext {
  userId: string;
  zitadelUserId: string;
  email: string;
  emailVerified: boolean;
  orgId?: string;
  role?: "ADMIN" | "EDITOR" | "READER";
}

/** Standardized auth error response. */
export const authErrorSchema = z.object({
  error: z.enum([
    "unauthorized",
    "forbidden",
    "token_expired",
    "token_invalid",
    "user_not_provisioned",
    "user_deactivated",
    "invalid_org",
    "not_a_member",
  ]),
  message: z.string(),
});

export type AuthError = z.infer<typeof authErrorSchema>;
