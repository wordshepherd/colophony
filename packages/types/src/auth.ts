import { z } from "zod";

// ---------------------------------------------------------------------------
// Legacy schemas — v1 email/password auth
// These are preserved for frontend compatibility. Zitadel handles auth in v2.
// ---------------------------------------------------------------------------

/** @deprecated v1 schema — Zitadel handles login in v2 */
export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

/** @deprecated v1 type */
export type LoginInput = z.infer<typeof loginSchema>;

/** @deprecated v1 schema — Zitadel handles registration in v2 */
export const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(72), // bcrypt max
  name: z.string().min(1).max(255).optional(),
});

/** @deprecated v1 type */
export type RegisterInput = z.infer<typeof registerSchema>;

/** @deprecated v1 schema — Zitadel manages token refresh in v2 */
export const refreshTokenSchema = z.object({
  refreshToken: z.string(),
});

/** @deprecated v1 type */
export type RefreshTokenInput = z.infer<typeof refreshTokenSchema>;

/** @deprecated v1 schema */
export const authResponseSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
  expiresIn: z.number(),
});

/** @deprecated v1 type */
export type AuthResponse = z.infer<typeof authResponseSchema>;

/** @deprecated v1 schema */
export const emailVerificationSchema = z.object({
  token: z.string().min(1),
});

/** @deprecated v1 type */
export type EmailVerificationInput = z.infer<typeof emailVerificationSchema>;

/** @deprecated v1 schema */
export const resendVerificationSchema = z.object({
  email: z.string().email(),
});

/** @deprecated v1 type */
export type ResendVerificationInput = z.infer<typeof resendVerificationSchema>;

/** @deprecated v1 schema */
export const emailVerificationResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
});

/** @deprecated v1 type */
export type EmailVerificationResponse = z.infer<
  typeof emailVerificationResponseSchema
>;

/** @deprecated v1 schema */
export const forgotPasswordSchema = z.object({
  email: z.string().email(),
});

/** @deprecated v1 type */
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;

/** @deprecated v1 schema */
export const resetPasswordSchema = z.object({
  token: z.string(),
  password: z.string().min(8).max(72),
});

/** @deprecated v1 type */
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

/** @deprecated v1 schema */
export const changePasswordSchema = z.object({
  currentPassword: z.string(),
  newPassword: z.string().min(8).max(72),
});

/** @deprecated v1 type */
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

/** @deprecated v1 type — use OidcTokenClaims for Zitadel tokens */
export interface JwtPayload {
  sub: string; // user ID
  email: string;
  iat: number;
  exp: number;
}

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
