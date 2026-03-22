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

/**
 * Zitadel Actions v2 event payload nested inside the webhook body.
 * Contains user profile data for user.human.* events.
 */
export const zitadelEventPayloadSchema = z.looseObject({
  userName: z.string().optional(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  displayName: z.string().optional(),
  email: z.string().optional(),
  emailVerified: z.boolean().optional(),
  preferredLanguage: z.string().optional(),
});

/**
 * Zitadel Actions v2 webhook payload format.
 *
 * Actual format discovered from staging (2026-03-22):
 * - `event_type` (snake_case, e.g., "user.human.added")
 * - `created_at` (ISO timestamp)
 * - `aggregateID` + `sequence` (used as idempotency key)
 * - `userID` (top-level, the acting user or Zitadel system)
 * - `event_payload` (nested object with user profile data)
 */
export const zitadelWebhookPayloadSchema = z.looseObject({
  aggregateID: z.string().min(1),
  aggregateType: z.string().optional(),
  resourceOwner: z.string().optional(),
  instanceID: z.string().optional(),
  version: z.string().optional(),
  sequence: z.number(),
  event_type: z.string().min(1),
  created_at: z.string().min(1),
  userID: z.string().optional(),
  event_payload: zitadelEventPayloadSchema.optional(),
});

export type ZitadelWebhookPayload = z.infer<typeof zitadelWebhookPayloadSchema>;

/** @deprecated Use zitadelEventPayloadSchema instead */
export const zitadelWebhookUserSchema = z.looseObject({
  userId: z.string().optional(),
  username: z.string().optional(),
  email: z.string().optional(),
  emailVerified: z.boolean().optional(),
  displayName: z.string().optional(),
});
