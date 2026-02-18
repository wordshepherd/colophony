import { z } from "zod";

// ---------------------------------------------------------------------------
// Audit logging — shared constants and typed params
// ---------------------------------------------------------------------------

/** Audit action constants. */
export const AuditActions = {
  // User lifecycle (synced from Zitadel webhooks)
  USER_CREATED: "USER_CREATED",
  USER_UPDATED: "USER_UPDATED",
  USER_DEACTIVATED: "USER_DEACTIVATED",
  USER_REACTIVATED: "USER_REACTIVATED",
  USER_REMOVED: "USER_REMOVED",
  USER_EMAIL_VERIFIED: "USER_EMAIL_VERIFIED",

  // Organization lifecycle
  ORG_CREATED: "ORG_CREATED",
  ORG_UPDATED: "ORG_UPDATED",
  ORG_DELETED: "ORG_DELETED",
  ORG_MEMBER_ADDED: "ORG_MEMBER_ADDED",
  ORG_MEMBER_REMOVED: "ORG_MEMBER_REMOVED",
  ORG_MEMBER_ROLE_CHANGED: "ORG_MEMBER_ROLE_CHANGED",

  // Submission lifecycle
  SUBMISSION_CREATED: "SUBMISSION_CREATED",
  SUBMISSION_UPDATED: "SUBMISSION_UPDATED",
  SUBMISSION_SUBMITTED: "SUBMISSION_SUBMITTED",
  SUBMISSION_STATUS_CHANGED: "SUBMISSION_STATUS_CHANGED",
  SUBMISSION_DELETED: "SUBMISSION_DELETED",
  SUBMISSION_WITHDRAWN: "SUBMISSION_WITHDRAWN",

  // File lifecycle
  FILE_UPLOADED: "FILE_UPLOADED",
  FILE_DELETED: "FILE_DELETED",
  FILE_SCAN_CLEAN: "FILE_SCAN_CLEAN",
  FILE_SCAN_INFECTED: "FILE_SCAN_INFECTED",
  FILE_SCAN_FAILED: "FILE_SCAN_FAILED",

  // Authentication failures
  AUTH_TOKEN_INVALID: "AUTH_TOKEN_INVALID",
  AUTH_TOKEN_EXPIRED: "AUTH_TOKEN_EXPIRED",
  AUTH_USER_NOT_PROVISIONED: "AUTH_USER_NOT_PROVISIONED",
  AUTH_USER_DEACTIVATED: "AUTH_USER_DEACTIVATED",

  // API key lifecycle
  API_KEY_CREATED: "API_KEY_CREATED",
  API_KEY_REVOKED: "API_KEY_REVOKED",
  API_KEY_DELETED: "API_KEY_DELETED",
  API_KEY_AUTH_SUCCESS: "API_KEY_AUTH_SUCCESS",
  API_KEY_AUTH_FAILED: "API_KEY_AUTH_FAILED",
  API_KEY_SCOPE_DENIED: "API_KEY_SCOPE_DENIED",

  // Payment lifecycle
  PAYMENT_SUCCEEDED: "PAYMENT_SUCCEEDED",
  PAYMENT_EXPIRED: "PAYMENT_EXPIRED",

  // Audit access
  AUDIT_ACCESSED: "AUDIT_ACCESSED",
} as const;

export type AuditAction = (typeof AuditActions)[keyof typeof AuditActions];

/** Audit resource constants. */
export const AuditResources = {
  USER: "user",
  ORGANIZATION: "organization",
  SUBMISSION: "submission",
  FILE: "file",
  AUTH: "auth",
  API_KEY: "api_key",
  PAYMENT: "payment",
  AUDIT: "audit",
} as const;

export type AuditResource =
  (typeof AuditResources)[keyof typeof AuditResources];

// ---------------------------------------------------------------------------
// Discriminated union — enforces valid action↔resource pairs
// ---------------------------------------------------------------------------

interface BaseAuditParams {
  resourceId?: string;
  oldValue?: unknown;
  newValue?: unknown;
  actorId?: string;
  organizationId?: string;
  ipAddress?: string;
  userAgent?: string;
  requestId?: string;
  method?: string;
  route?: string;
}

export interface UserAuditParams extends BaseAuditParams {
  resource: typeof AuditResources.USER;
  action:
    | typeof AuditActions.USER_CREATED
    | typeof AuditActions.USER_UPDATED
    | typeof AuditActions.USER_DEACTIVATED
    | typeof AuditActions.USER_REACTIVATED
    | typeof AuditActions.USER_REMOVED
    | typeof AuditActions.USER_EMAIL_VERIFIED;
}

export interface OrgAuditParams extends BaseAuditParams {
  resource: typeof AuditResources.ORGANIZATION;
  action:
    | typeof AuditActions.ORG_CREATED
    | typeof AuditActions.ORG_UPDATED
    | typeof AuditActions.ORG_DELETED
    | typeof AuditActions.ORG_MEMBER_ADDED
    | typeof AuditActions.ORG_MEMBER_REMOVED
    | typeof AuditActions.ORG_MEMBER_ROLE_CHANGED;
}

export interface SubmissionAuditParams extends BaseAuditParams {
  resource: typeof AuditResources.SUBMISSION;
  action:
    | typeof AuditActions.SUBMISSION_CREATED
    | typeof AuditActions.SUBMISSION_UPDATED
    | typeof AuditActions.SUBMISSION_SUBMITTED
    | typeof AuditActions.SUBMISSION_STATUS_CHANGED
    | typeof AuditActions.SUBMISSION_DELETED
    | typeof AuditActions.SUBMISSION_WITHDRAWN;
}

export interface FileAuditParams extends BaseAuditParams {
  resource: typeof AuditResources.FILE;
  action:
    | typeof AuditActions.FILE_UPLOADED
    | typeof AuditActions.FILE_DELETED
    | typeof AuditActions.FILE_SCAN_CLEAN
    | typeof AuditActions.FILE_SCAN_INFECTED
    | typeof AuditActions.FILE_SCAN_FAILED;
}

export interface AuthAuditParams extends BaseAuditParams {
  resource: typeof AuditResources.AUTH;
  action:
    | typeof AuditActions.AUTH_TOKEN_INVALID
    | typeof AuditActions.AUTH_TOKEN_EXPIRED
    | typeof AuditActions.AUTH_USER_NOT_PROVISIONED
    | typeof AuditActions.AUTH_USER_DEACTIVATED;
}

export interface ApiKeyAuditParams extends BaseAuditParams {
  resource: typeof AuditResources.API_KEY;
  action:
    | typeof AuditActions.API_KEY_CREATED
    | typeof AuditActions.API_KEY_REVOKED
    | typeof AuditActions.API_KEY_DELETED
    | typeof AuditActions.API_KEY_AUTH_SUCCESS
    | typeof AuditActions.API_KEY_AUTH_FAILED
    | typeof AuditActions.API_KEY_SCOPE_DENIED;
}

export interface PaymentAuditParams extends BaseAuditParams {
  resource: typeof AuditResources.PAYMENT;
  action:
    | typeof AuditActions.PAYMENT_SUCCEEDED
    | typeof AuditActions.PAYMENT_EXPIRED;
}

export interface AuditAccessAuditParams extends BaseAuditParams {
  resource: typeof AuditResources.AUDIT;
  action: typeof AuditActions.AUDIT_ACCESSED;
}

/** Union of all resource-specific param types. */
export type AuditLogParams =
  | UserAuditParams
  | OrgAuditParams
  | SubmissionAuditParams
  | FileAuditParams
  | AuthAuditParams
  | ApiKeyAuditParams
  | PaymentAuditParams
  | AuditAccessAuditParams;

// ---------------------------------------------------------------------------
// Query/response schemas for audit endpoints
// ---------------------------------------------------------------------------

/** List/filter input schema for audit events. */
export const listAuditEventsSchema = z.object({
  action: z.nativeEnum(AuditActions).optional(),
  resource: z.nativeEnum(AuditResources).optional(),
  actorId: z.string().uuid().optional(),
  resourceId: z.string().uuid().optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(100).default(20),
});

export type ListAuditEventsInput = z.infer<typeof listAuditEventsSchema>;

/** Single audit event response schema. */
export const auditEventResponseSchema = z.object({
  id: z.string().uuid(),
  action: z.string(),
  resource: z.string(),
  resourceId: z.string().uuid().nullable(),
  actorId: z.string().uuid().nullable(),
  oldValue: z.unknown().nullable(),
  newValue: z.unknown().nullable(),
  ipAddress: z.string().nullable(),
  userAgent: z.string().nullable(),
  requestId: z.string().nullable(),
  method: z.string().nullable(),
  route: z.string().nullable(),
  createdAt: z.date(),
});

export type AuditEventResponse = z.infer<typeof auditEventResponseSchema>;
