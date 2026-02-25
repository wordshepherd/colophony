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

  // Period lifecycle
  PERIOD_CREATED: "PERIOD_CREATED",
  PERIOD_UPDATED: "PERIOD_UPDATED",
  PERIOD_DELETED: "PERIOD_DELETED",

  // Form lifecycle
  FORM_CREATED: "FORM_CREATED",
  FORM_UPDATED: "FORM_UPDATED",
  FORM_PUBLISHED: "FORM_PUBLISHED",
  FORM_ARCHIVED: "FORM_ARCHIVED",
  FORM_DUPLICATED: "FORM_DUPLICATED",
  FORM_DELETED: "FORM_DELETED",
  FORM_FIELD_ADDED: "FORM_FIELD_ADDED",
  FORM_FIELD_UPDATED: "FORM_FIELD_UPDATED",
  FORM_FIELD_REMOVED: "FORM_FIELD_REMOVED",
  FORM_FIELDS_REORDERED: "FORM_FIELDS_REORDERED",
  FORM_PAGE_ADDED: "FORM_PAGE_ADDED",
  FORM_PAGE_UPDATED: "FORM_PAGE_UPDATED",
  FORM_PAGE_REMOVED: "FORM_PAGE_REMOVED",
  FORM_PAGES_REORDERED: "FORM_PAGES_REORDERED",

  // Manuscript lifecycle
  MANUSCRIPT_CREATED: "MANUSCRIPT_CREATED",
  MANUSCRIPT_UPDATED: "MANUSCRIPT_UPDATED",
  MANUSCRIPT_DELETED: "MANUSCRIPT_DELETED",
  MANUSCRIPT_VERSION_CREATED: "MANUSCRIPT_VERSION_CREATED",

  // Payment lifecycle
  PAYMENT_SUCCEEDED: "PAYMENT_SUCCEEDED",
  PAYMENT_EXPIRED: "PAYMENT_EXPIRED",

  // Embed token lifecycle
  EMBED_TOKEN_CREATED: "EMBED_TOKEN_CREATED",
  EMBED_TOKEN_REVOKED: "EMBED_TOKEN_REVOKED",

  // Embed submission
  EMBED_SUBMISSION_CREATED: "EMBED_SUBMISSION_CREATED",

  // Guest user
  GUEST_USER_CREATED: "GUEST_USER_CREATED",

  // GDPR
  USER_GDPR_DELETED: "USER_GDPR_DELETED",
  S3_CLEANUP_COMPLETED: "S3_CLEANUP_COMPLETED",
  S3_CLEANUP_FAILED: "S3_CLEANUP_FAILED",

  // Publication lifecycle
  PUBLICATION_CREATED: "PUBLICATION_CREATED",
  PUBLICATION_UPDATED: "PUBLICATION_UPDATED",
  PUBLICATION_ARCHIVED: "PUBLICATION_ARCHIVED",

  // Contract template lifecycle
  CONTRACT_TEMPLATE_CREATED: "CONTRACT_TEMPLATE_CREATED",
  CONTRACT_TEMPLATE_UPDATED: "CONTRACT_TEMPLATE_UPDATED",
  CONTRACT_TEMPLATE_DELETED: "CONTRACT_TEMPLATE_DELETED",

  // Contract lifecycle
  CONTRACT_GENERATED: "CONTRACT_GENERATED",
  CONTRACT_SENT: "CONTRACT_SENT",
  CONTRACT_VOIDED: "CONTRACT_VOIDED",

  // Issue lifecycle
  ISSUE_CREATED: "ISSUE_CREATED",
  ISSUE_UPDATED: "ISSUE_UPDATED",
  ISSUE_PUBLISHED: "ISSUE_PUBLISHED",
  ISSUE_ARCHIVED: "ISSUE_ARCHIVED",
  ISSUE_ITEM_ADDED: "ISSUE_ITEM_ADDED",
  ISSUE_ITEM_REMOVED: "ISSUE_ITEM_REMOVED",

  // Pipeline lifecycle
  PIPELINE_ITEM_CREATED: "PIPELINE_ITEM_CREATED",
  PIPELINE_STAGE_CHANGED: "PIPELINE_STAGE_CHANGED",
  PIPELINE_COPYEDITOR_ASSIGNED: "PIPELINE_COPYEDITOR_ASSIGNED",
  PIPELINE_PROOFREADER_ASSIGNED: "PIPELINE_PROOFREADER_ASSIGNED",
  PIPELINE_COMMENT_ADDED: "PIPELINE_COMMENT_ADDED",

  // CMS connection lifecycle
  CMS_CONNECTION_CREATED: "CMS_CONNECTION_CREATED",
  CMS_CONNECTION_UPDATED: "CMS_CONNECTION_UPDATED",
  CMS_CONNECTION_DELETED: "CMS_CONNECTION_DELETED",
  CMS_CONNECTION_TESTED: "CMS_CONNECTION_TESTED",

  // Sim-sub enforcement
  SIMSUB_CHECK_PERFORMED: "SIMSUB_CHECK_PERFORMED",
  SIMSUB_CONFLICT_FOUND: "SIMSUB_CONFLICT_FOUND",
  SIMSUB_OVERRIDE_GRANTED: "SIMSUB_OVERRIDE_GRANTED",
  SIMSUB_INBOUND_CHECK: "SIMSUB_INBOUND_CHECK",

  // Federation lifecycle
  FEDERATION_KEY_GENERATED: "FEDERATION_KEY_GENERATED",
  FEDERATION_USER_KEY_GENERATED: "FEDERATION_USER_KEY_GENERATED",
  FEDERATION_TRUST_INITIATED: "FEDERATION_TRUST_INITIATED",
  FEDERATION_TRUST_ACCEPTED: "FEDERATION_TRUST_ACCEPTED",
  FEDERATION_TRUST_REJECTED: "FEDERATION_TRUST_REJECTED",
  FEDERATION_TRUST_REVOKED: "FEDERATION_TRUST_REVOKED",
  FEDERATION_TRUST_RECEIVED: "FEDERATION_TRUST_RECEIVED",

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
  MANUSCRIPT: "manuscript",
  PERIOD: "period",
  FORM: "form",
  AUTH: "auth",
  API_KEY: "api_key",
  PAYMENT: "payment",
  EMBED_TOKEN: "embed_token",
  PUBLICATION: "publication",
  PIPELINE_ITEM: "pipeline_item",
  CONTRACT_TEMPLATE: "contract_template",
  CONTRACT: "contract",
  ISSUE: "issue",
  CMS_CONNECTION: "cms_connection",
  FEDERATION: "federation",
  SIMSUB: "simsub",
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
    | typeof AuditActions.USER_EMAIL_VERIFIED
    | typeof AuditActions.USER_GDPR_DELETED;
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

export interface ManuscriptAuditParams extends BaseAuditParams {
  resource: typeof AuditResources.MANUSCRIPT;
  action:
    | typeof AuditActions.MANUSCRIPT_CREATED
    | typeof AuditActions.MANUSCRIPT_UPDATED
    | typeof AuditActions.MANUSCRIPT_DELETED
    | typeof AuditActions.MANUSCRIPT_VERSION_CREATED;
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

export interface PeriodAuditParams extends BaseAuditParams {
  resource: typeof AuditResources.PERIOD;
  action:
    | typeof AuditActions.PERIOD_CREATED
    | typeof AuditActions.PERIOD_UPDATED
    | typeof AuditActions.PERIOD_DELETED;
}

export interface FormAuditParams extends BaseAuditParams {
  resource: typeof AuditResources.FORM;
  action:
    | typeof AuditActions.FORM_CREATED
    | typeof AuditActions.FORM_UPDATED
    | typeof AuditActions.FORM_PUBLISHED
    | typeof AuditActions.FORM_ARCHIVED
    | typeof AuditActions.FORM_DUPLICATED
    | typeof AuditActions.FORM_DELETED
    | typeof AuditActions.FORM_FIELD_ADDED
    | typeof AuditActions.FORM_FIELD_UPDATED
    | typeof AuditActions.FORM_FIELD_REMOVED
    | typeof AuditActions.FORM_FIELDS_REORDERED
    | typeof AuditActions.FORM_PAGE_ADDED
    | typeof AuditActions.FORM_PAGE_UPDATED
    | typeof AuditActions.FORM_PAGE_REMOVED
    | typeof AuditActions.FORM_PAGES_REORDERED;
}

export interface PaymentAuditParams extends BaseAuditParams {
  resource: typeof AuditResources.PAYMENT;
  action:
    | typeof AuditActions.PAYMENT_SUCCEEDED
    | typeof AuditActions.PAYMENT_EXPIRED;
}

export interface EmbedTokenAuditParams extends BaseAuditParams {
  resource: typeof AuditResources.EMBED_TOKEN;
  action:
    | typeof AuditActions.EMBED_TOKEN_CREATED
    | typeof AuditActions.EMBED_TOKEN_REVOKED
    | typeof AuditActions.EMBED_SUBMISSION_CREATED
    | typeof AuditActions.GUEST_USER_CREATED;
}

export interface PublicationAuditParams extends BaseAuditParams {
  resource: typeof AuditResources.PUBLICATION;
  action:
    | typeof AuditActions.PUBLICATION_CREATED
    | typeof AuditActions.PUBLICATION_UPDATED
    | typeof AuditActions.PUBLICATION_ARCHIVED;
}

export interface PipelineItemAuditParams extends BaseAuditParams {
  resource: typeof AuditResources.PIPELINE_ITEM;
  action:
    | typeof AuditActions.PIPELINE_ITEM_CREATED
    | typeof AuditActions.PIPELINE_STAGE_CHANGED
    | typeof AuditActions.PIPELINE_COPYEDITOR_ASSIGNED
    | typeof AuditActions.PIPELINE_PROOFREADER_ASSIGNED
    | typeof AuditActions.PIPELINE_COMMENT_ADDED;
}

export interface ContractTemplateAuditParams extends BaseAuditParams {
  resource: typeof AuditResources.CONTRACT_TEMPLATE;
  action:
    | typeof AuditActions.CONTRACT_TEMPLATE_CREATED
    | typeof AuditActions.CONTRACT_TEMPLATE_UPDATED
    | typeof AuditActions.CONTRACT_TEMPLATE_DELETED;
}

export interface ContractAuditParams extends BaseAuditParams {
  resource: typeof AuditResources.CONTRACT;
  action:
    | typeof AuditActions.CONTRACT_GENERATED
    | typeof AuditActions.CONTRACT_SENT
    | typeof AuditActions.CONTRACT_VOIDED;
}

export interface IssueAuditParams extends BaseAuditParams {
  resource: typeof AuditResources.ISSUE;
  action:
    | typeof AuditActions.ISSUE_CREATED
    | typeof AuditActions.ISSUE_UPDATED
    | typeof AuditActions.ISSUE_PUBLISHED
    | typeof AuditActions.ISSUE_ARCHIVED
    | typeof AuditActions.ISSUE_ITEM_ADDED
    | typeof AuditActions.ISSUE_ITEM_REMOVED;
}

export interface CmsConnectionAuditParams extends BaseAuditParams {
  resource: typeof AuditResources.CMS_CONNECTION;
  action:
    | typeof AuditActions.CMS_CONNECTION_CREATED
    | typeof AuditActions.CMS_CONNECTION_UPDATED
    | typeof AuditActions.CMS_CONNECTION_DELETED
    | typeof AuditActions.CMS_CONNECTION_TESTED;
}

export interface FederationAuditParams extends BaseAuditParams {
  resource: typeof AuditResources.FEDERATION;
  action:
    | typeof AuditActions.FEDERATION_KEY_GENERATED
    | typeof AuditActions.FEDERATION_USER_KEY_GENERATED
    | typeof AuditActions.FEDERATION_TRUST_INITIATED
    | typeof AuditActions.FEDERATION_TRUST_ACCEPTED
    | typeof AuditActions.FEDERATION_TRUST_REJECTED
    | typeof AuditActions.FEDERATION_TRUST_REVOKED
    | typeof AuditActions.FEDERATION_TRUST_RECEIVED;
}

export interface SimSubAuditParams extends BaseAuditParams {
  resource: typeof AuditResources.SIMSUB;
  action:
    | typeof AuditActions.SIMSUB_CHECK_PERFORMED
    | typeof AuditActions.SIMSUB_CONFLICT_FOUND
    | typeof AuditActions.SIMSUB_OVERRIDE_GRANTED
    | typeof AuditActions.SIMSUB_INBOUND_CHECK;
}

export interface AuditAccessAuditParams extends BaseAuditParams {
  resource: typeof AuditResources.AUDIT;
  action: typeof AuditActions.AUDIT_ACCESSED;
}

export interface SystemAuditParams extends BaseAuditParams {
  resource: typeof AuditResources.FILE;
  action:
    | typeof AuditActions.S3_CLEANUP_COMPLETED
    | typeof AuditActions.S3_CLEANUP_FAILED;
}

/** Union of all resource-specific param types. */
export type AuditLogParams =
  | UserAuditParams
  | OrgAuditParams
  | SubmissionAuditParams
  | FileAuditParams
  | ManuscriptAuditParams
  | PeriodAuditParams
  | FormAuditParams
  | AuthAuditParams
  | ApiKeyAuditParams
  | PaymentAuditParams
  | EmbedTokenAuditParams
  | PublicationAuditParams
  | PipelineItemAuditParams
  | ContractTemplateAuditParams
  | ContractAuditParams
  | IssueAuditParams
  | CmsConnectionAuditParams
  | FederationAuditParams
  | SimSubAuditParams
  | AuditAccessAuditParams
  | SystemAuditParams;

// ---------------------------------------------------------------------------
// Query/response schemas for audit endpoints
// ---------------------------------------------------------------------------

/** List/filter input schema for audit events. */
export const listAuditEventsSchema = z.object({
  action: z
    .nativeEnum(AuditActions)
    .optional()
    .describe("Filter by audit action (e.g. ORG_CREATED)"),
  resource: z
    .nativeEnum(AuditResources)
    .optional()
    .describe("Filter by resource type (e.g. organization)"),
  actorId: z
    .string()
    .uuid()
    .optional()
    .describe("Filter by the user who performed the action"),
  resourceId: z
    .string()
    .uuid()
    .optional()
    .describe("Filter by the affected resource ID"),
  from: z.coerce.date().optional().describe("Start of date range (ISO-8601)"),
  to: z.coerce.date().optional().describe("End of date range (ISO-8601)"),
  page: z.number().int().min(1).default(1).describe("Page number (1-based)"),
  limit: z
    .number()
    .int()
    .min(1)
    .max(100)
    .default(20)
    .describe("Items per page (1-100, default 20)"),
});

export type ListAuditEventsInput = z.infer<typeof listAuditEventsSchema>;

/** Single audit event response schema. */
export const auditEventResponseSchema = z.object({
  id: z.string().uuid().describe("Unique identifier for the audit event"),
  action: z.string().describe("Action that was performed (e.g. ORG_CREATED)"),
  resource: z
    .string()
    .describe("Resource type that was affected (e.g. organization)"),
  resourceId: z
    .string()
    .uuid()
    .nullable()
    .describe("ID of the affected resource"),
  actorId: z
    .string()
    .uuid()
    .nullable()
    .describe("ID of the user who performed the action"),
  oldValue: z.unknown().nullable().describe("Previous state before the change"),
  newValue: z.unknown().nullable().describe("New state after the change"),
  ipAddress: z.string().nullable().describe("IP address of the request"),
  userAgent: z
    .string()
    .nullable()
    .describe("User-Agent header from the request"),
  requestId: z.string().nullable().describe("Correlation ID for the request"),
  method: z.string().nullable().describe("HTTP method of the request"),
  route: z.string().nullable().describe("API route that was called"),
  createdAt: z.date().describe("When the audit event was recorded"),
});

export type AuditEventResponse = z.infer<typeof auditEventResponseSchema>;
