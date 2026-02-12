import type { JWTPayload, JWTHeaderParameters } from "jose";

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

/** Zitadel webhook event types we handle. */
export type ZitadelEventType =
  | "user.created"
  | "user.changed"
  | "user.deactivated"
  | "user.reactivated"
  | "user.removed"
  | "user.email.verified";

/** Shape of a Zitadel webhook payload. */
export interface ZitadelWebhookPayload {
  eventType: ZitadelEventType;
  /** Unique event ID for idempotency. */
  eventId: string;
  /** Timestamp of the event in Zitadel. */
  creationDate: string;
  /** The user affected by this event. */
  user?: {
    userId: string;
    username?: string;
    email?: string;
    emailVerified?: boolean;
    displayName?: string;
  };
  [key: string]: unknown;
}
