import type { JWTPayload, JWTHeaderParameters } from "jose";
import { z } from "zod";

/** Configuration for the JWKS-based token verifier. */
export interface JwksConfig {
  /** Zitadel authority URL, e.g., http://localhost:8080 */
  authority: string;
  /** OIDC client ID used as audience check */
  clientId?: string;
  /** Clock tolerance in seconds (default: 5) */
  clockTolerance?: number;
  /** Allowed signing algorithms (default: ['RS256', 'ES256']) */
  algorithms?: string[];
}

/** Result of a successful token verification. */
export interface VerifiedToken {
  payload: JWTPayload;
  header: JWTHeaderParameters;
}

/** Known Zitadel event types (for switch narrowing, NOT for parse validation). */
export const zitadelEventTypeSchema = z.enum([
  "user.created",
  "user.changed",
  "user.deactivated",
  "user.reactivated",
  "user.removed",
  "user.email.verified",
]);
export type ZitadelEventType = z.infer<typeof zitadelEventTypeSchema>;

export const zitadelWebhookUserSchema = z
  .object({
    userId: z.string().optional(),
    username: z.string().optional(),
    email: z.string().optional(),
    emailVerified: z.boolean().optional(),
    displayName: z.string().optional(),
  })
  .passthrough();

/** eventType is z.string() (not z.enum) so unknown types pass validation
 *  and reach the switch default case for logging + idempotency recording. */
export const zitadelWebhookPayloadSchema = z
  .object({
    eventType: z.string().min(1),
    eventId: z.string().min(1),
    creationDate: z.string().min(1),
    user: zitadelWebhookUserSchema.optional(),
  })
  .passthrough();

export type ZitadelWebhookPayload = z.infer<typeof zitadelWebhookPayloadSchema>;
