import { z } from "zod";

// ---------------------------------------------------------------------------
// Audit logging — shared constants and typed params
// ---------------------------------------------------------------------------

/** Audit action constants. */
export const AuditActions = {
  // User lifecycle (synced from Zitadel webhooks)
  USER_CREATED: "USER_CREATED",
  USER_JIT_PROVISIONED: "USER_JIT_PROVISIONED",
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
  REVIEWER_ASSIGNED: "REVIEWER_ASSIGNED",
  REVIEWER_UNASSIGNED: "REVIEWER_UNASSIGNED",
  REVIEWER_READ: "REVIEWER_READ",
  SUBMISSION_EXPORTED: "SUBMISSION_EXPORTED",

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

  // Content extraction lifecycle
  CONTENT_EXTRACT_COMPLETE: "CONTENT_EXTRACT_COMPLETE",
  CONTENT_EXTRACT_FAILED: "CONTENT_EXTRACT_FAILED",
  CONTENT_EXTRACT_UNSUPPORTED: "CONTENT_EXTRACT_UNSUPPORTED",

  // Payment lifecycle
  PAYMENT_SUCCEEDED: "PAYMENT_SUCCEEDED",
  PAYMENT_EXPIRED: "PAYMENT_EXPIRED",

  // Embed token lifecycle
  EMBED_TOKEN_CREATED: "EMBED_TOKEN_CREATED",
  EMBED_TOKEN_REVOKED: "EMBED_TOKEN_REVOKED",

  // Embed submission
  EMBED_SUBMISSION_CREATED: "EMBED_SUBMISSION_CREATED",
  EMBED_SUBMISSION_RESUBMITTED: "EMBED_SUBMISSION_RESUBMITTED",

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
  CONTRACT_SIGNED: "CONTRACT_SIGNED",
  CONTRACT_COMPLETED: "CONTRACT_COMPLETED",
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
  PIPELINE_COPYEDIT_SAVED: "PIPELINE_COPYEDIT_SAVED",
  PIPELINE_COPYEDIT_EXPORTED: "PIPELINE_COPYEDIT_EXPORTED",
  PIPELINE_COPYEDIT_IMPORTED: "PIPELINE_COPYEDIT_IMPORTED",

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

  // Transfer lifecycle
  TRANSFER_INITIATED: "TRANSFER_INITIATED",
  TRANSFER_INBOUND_RECEIVED: "TRANSFER_INBOUND_RECEIVED",
  TRANSFER_COMPLETED: "TRANSFER_COMPLETED",
  TRANSFER_CANCELLED: "TRANSFER_CANCELLED",
  TRANSFER_FAILED: "TRANSFER_FAILED",
  TRANSFER_FILE_SERVED: "TRANSFER_FILE_SERVED",
  TRANSFER_FILES_FETCH_STARTED: "TRANSFER_FILES_FETCH_STARTED",
  TRANSFER_FILES_FETCH_COMPLETED: "TRANSFER_FILES_FETCH_COMPLETED",
  TRANSFER_FILES_FETCH_FAILED: "TRANSFER_FILES_FETCH_FAILED",

  // Identity migration lifecycle
  MIGRATION_REQUESTED: "MIGRATION_REQUESTED",
  MIGRATION_INBOUND_RECEIVED: "MIGRATION_INBOUND_RECEIVED",
  MIGRATION_APPROVED: "MIGRATION_APPROVED",
  MIGRATION_REJECTED: "MIGRATION_REJECTED",
  MIGRATION_BUNDLE_SENT: "MIGRATION_BUNDLE_SENT",
  MIGRATION_BUNDLE_RECEIVED: "MIGRATION_BUNDLE_RECEIVED",
  MIGRATION_COMPLETED: "MIGRATION_COMPLETED",
  MIGRATION_FAILED: "MIGRATION_FAILED",
  MIGRATION_CANCELLED: "MIGRATION_CANCELLED",
  MIGRATION_FILE_SERVED: "MIGRATION_FILE_SERVED",
  MIGRATION_BROADCAST_SENT: "MIGRATION_BROADCAST_SENT",
  MIGRATION_BROADCAST_RECEIVED: "MIGRATION_BROADCAST_RECEIVED",
  USER_SOFT_DEACTIVATED: "USER_SOFT_DEACTIVATED",

  // Federation lifecycle
  FEDERATION_KEY_GENERATED: "FEDERATION_KEY_GENERATED",
  FEDERATION_USER_KEY_GENERATED: "FEDERATION_USER_KEY_GENERATED",
  FEDERATION_USER_KEY_ROTATED: "FEDERATION_USER_KEY_ROTATED",
  FEDERATION_USER_KEY_REVOKED: "FEDERATION_USER_KEY_REVOKED",
  FEDERATION_TRUST_INITIATED: "FEDERATION_TRUST_INITIATED",
  FEDERATION_TRUST_ACCEPTED: "FEDERATION_TRUST_ACCEPTED",
  FEDERATION_TRUST_REJECTED: "FEDERATION_TRUST_REJECTED",
  FEDERATION_TRUST_REVOKED: "FEDERATION_TRUST_REVOKED",
  FEDERATION_TRUST_RECEIVED: "FEDERATION_TRUST_RECEIVED",
  FEDERATION_TRUST_AUTO_ACCEPTED: "FEDERATION_TRUST_AUTO_ACCEPTED",
  FEDERATION_CONFIG_UPDATED: "FEDERATION_CONFIG_UPDATED",

  // Hub lifecycle
  HUB_INSTANCE_REGISTERED: "HUB_INSTANCE_REGISTERED",
  HUB_INSTANCE_SUSPENDED: "HUB_INSTANCE_SUSPENDED",
  HUB_INSTANCE_REVOKED: "HUB_INSTANCE_REVOKED",
  HUB_ATTESTATION_ISSUED: "HUB_ATTESTATION_ISSUED",
  HUB_FINGERPRINT_REGISTERED: "HUB_FINGERPRINT_REGISTERED",
  HUB_FINGERPRINT_QUERIED: "HUB_FINGERPRINT_QUERIED",
  HUB_AUTO_TRUST_ESTABLISHED: "HUB_AUTO_TRUST_ESTABLISHED",

  // Relay — email & notifications
  EMAIL_QUEUED: "EMAIL_QUEUED",
  EMAIL_SENT: "EMAIL_SENT",
  EMAIL_FAILED: "EMAIL_FAILED",
  NOTIFICATION_PREFERENCE_UPDATED: "NOTIFICATION_PREFERENCE_UPDATED",

  // Relay — in-app notifications
  IN_APP_NOTIFICATION_CREATED: "IN_APP_NOTIFICATION_CREATED",
  IN_APP_NOTIFICATION_READ: "IN_APP_NOTIFICATION_READ",
  IN_APP_NOTIFICATION_ALL_READ: "IN_APP_NOTIFICATION_ALL_READ",

  // Relay — webhooks
  WEBHOOK_ENDPOINT_CREATED: "WEBHOOK_ENDPOINT_CREATED",
  WEBHOOK_ENDPOINT_UPDATED: "WEBHOOK_ENDPOINT_UPDATED",
  WEBHOOK_ENDPOINT_DELETED: "WEBHOOK_ENDPOINT_DELETED",
  WEBHOOK_ENDPOINT_SECRET_ROTATED: "WEBHOOK_ENDPOINT_SECRET_ROTATED",
  WEBHOOK_DELIVERED: "WEBHOOK_DELIVERED",
  WEBHOOK_DELIVERY_FAILED: "WEBHOOK_DELIVERY_FAILED",
  WEBHOOK_DELIVERY_RETRIED: "WEBHOOK_DELIVERY_RETRIED",
  WEBHOOK_ENDPOINT_AUTO_DISABLED: "WEBHOOK_ENDPOINT_AUTO_DISABLED",

  // Correspondence lifecycle
  CORRESPONDENCE_SENT: "CORRESPONDENCE_SENT",
  CORRESPONDENCE_AUTO_CAPTURED: "CORRESPONDENCE_AUTO_CAPTURED",
  CORRESPONDENCE_MANUAL_LOGGED: "CORRESPONDENCE_MANUAL_LOGGED",

  // Voting lifecycle
  SUBMISSION_VOTE_CAST: "SUBMISSION_VOTE_CAST",
  SUBMISSION_VOTE_UPDATED: "SUBMISSION_VOTE_UPDATED",
  SUBMISSION_VOTE_DELETED: "SUBMISSION_VOTE_DELETED",

  // Discussion lifecycle
  DISCUSSION_COMMENT_ADDED: "DISCUSSION_COMMENT_ADDED",

  // Email template lifecycle
  EMAIL_TEMPLATE_CREATED: "EMAIL_TEMPLATE_CREATED",
  EMAIL_TEMPLATE_UPDATED: "EMAIL_TEMPLATE_UPDATED",
  EMAIL_TEMPLATE_DELETED: "EMAIL_TEMPLATE_DELETED",

  // External submission lifecycle
  EXTERNAL_SUBMISSION_CREATED: "EXTERNAL_SUBMISSION_CREATED",
  EXTERNAL_SUBMISSION_UPDATED: "EXTERNAL_SUBMISSION_UPDATED",
  EXTERNAL_SUBMISSION_DELETED: "EXTERNAL_SUBMISSION_DELETED",

  // Writer profile lifecycle
  WRITER_PROFILE_CREATED: "WRITER_PROFILE_CREATED",
  WRITER_PROFILE_UPDATED: "WRITER_PROFILE_UPDATED",
  WRITER_PROFILE_DELETED: "WRITER_PROFILE_DELETED",

  // CSR export/import
  CSR_EXPORTED: "CSR_EXPORTED",
  CSR_IMPORTED: "CSR_IMPORTED",

  // Audit access
  AUDIT_ACCESSED: "AUDIT_ACCESSED",

  // Invitation lifecycle
  INVITATION_CREATED: "INVITATION_CREATED",
  INVITATION_REVOKED: "INVITATION_REVOKED",
  INVITATION_ACCEPTED: "INVITATION_ACCEPTED",
  INVITATION_RESENT: "INVITATION_RESENT",

  // Collection lifecycle
  COLLECTION_CREATED: "COLLECTION_CREATED",
  COLLECTION_UPDATED: "COLLECTION_UPDATED",
  COLLECTION_DELETED: "COLLECTION_DELETED",
  COLLECTION_ITEM_ADDED: "COLLECTION_ITEM_ADDED",
  COLLECTION_ITEM_REMOVED: "COLLECTION_ITEM_REMOVED",
  COLLECTION_ITEM_UPDATED: "COLLECTION_ITEM_UPDATED",

  // Contributor lifecycle
  CONTRIBUTOR_CREATED: "CONTRIBUTOR_CREATED",
  CONTRIBUTOR_UPDATED: "CONTRIBUTOR_UPDATED",
  CONTRIBUTOR_DELETED: "CONTRIBUTOR_DELETED",
  CONTRIBUTOR_LINKED: "CONTRIBUTOR_LINKED",
  CONTRIBUTOR_UNLINKED: "CONTRIBUTOR_UNLINKED",
  CONTRIBUTOR_PUBLICATION_ADDED: "CONTRIBUTOR_PUBLICATION_ADDED",
  CONTRIBUTOR_PUBLICATION_REMOVED: "CONTRIBUTOR_PUBLICATION_REMOVED",

  // Rights agreement lifecycle
  RIGHTS_AGREEMENT_CREATED: "RIGHTS_AGREEMENT_CREATED",
  RIGHTS_AGREEMENT_UPDATED: "RIGHTS_AGREEMENT_UPDATED",
  RIGHTS_AGREEMENT_SENT: "RIGHTS_AGREEMENT_SENT",
  RIGHTS_AGREEMENT_SIGNED: "RIGHTS_AGREEMENT_SIGNED",
  RIGHTS_AGREEMENT_ACTIVATED: "RIGHTS_AGREEMENT_ACTIVATED",
  RIGHTS_AGREEMENT_REVERTED: "RIGHTS_AGREEMENT_REVERTED",
  RIGHTS_AGREEMENT_DELETED: "RIGHTS_AGREEMENT_DELETED",

  // Payment transaction lifecycle
  PAYMENT_TRANSACTION_CREATED: "PAYMENT_TRANSACTION_CREATED",
  PAYMENT_TRANSACTION_UPDATED: "PAYMENT_TRANSACTION_UPDATED",
  PAYMENT_TRANSACTION_STATUS_CHANGED: "PAYMENT_TRANSACTION_STATUS_CHANGED",
  PAYMENT_TRANSACTION_DELETED: "PAYMENT_TRANSACTION_DELETED",

  // Contest lifecycle
  CONTEST_GROUP_CREATED: "CONTEST_GROUP_CREATED",
  CONTEST_GROUP_UPDATED: "CONTEST_GROUP_UPDATED",
  CONTEST_GROUP_DELETED: "CONTEST_GROUP_DELETED",
  CONTEST_JUDGE_ASSIGNED: "CONTEST_JUDGE_ASSIGNED",
  CONTEST_JUDGE_UPDATED: "CONTEST_JUDGE_UPDATED",
  CONTEST_JUDGE_REMOVED: "CONTEST_JUDGE_REMOVED",
  CONTEST_RESULT_CREATED: "CONTEST_RESULT_CREATED",
  CONTEST_RESULT_UPDATED: "CONTEST_RESULT_UPDATED",
  CONTEST_RESULT_DELETED: "CONTEST_RESULT_DELETED",
  CONTEST_WINNERS_ANNOUNCED: "CONTEST_WINNERS_ANNOUNCED",
  CONTEST_PRIZE_DISBURSED: "CONTEST_PRIZE_DISBURSED",

  // Sim-sub group lifecycle
  SIMSUB_GROUP_CREATED: "SIMSUB_GROUP_CREATED",
  SIMSUB_GROUP_UPDATED: "SIMSUB_GROUP_UPDATED",
  SIMSUB_GROUP_DELETED: "SIMSUB_GROUP_DELETED",
  SIMSUB_GROUP_SUBMISSION_ADDED: "SIMSUB_GROUP_SUBMISSION_ADDED",
  SIMSUB_GROUP_SUBMISSION_REMOVED: "SIMSUB_GROUP_SUBMISSION_REMOVED",

  // Portfolio entry lifecycle
  PORTFOLIO_ENTRY_CREATED: "PORTFOLIO_ENTRY_CREATED",
  PORTFOLIO_ENTRY_UPDATED: "PORTFOLIO_ENTRY_UPDATED",
  PORTFOLIO_ENTRY_DELETED: "PORTFOLIO_ENTRY_DELETED",

  // Reader feedback lifecycle
  READER_FEEDBACK_CREATED: "READER_FEEDBACK_CREATED",
  READER_FEEDBACK_FORWARDED: "READER_FEEDBACK_FORWARDED",
  READER_FEEDBACK_DELETED: "READER_FEEDBACK_DELETED",
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
  TRANSFER: "transfer",
  MIGRATION: "migration",
  HUB: "hub",
  EMAIL: "email",
  NOTIFICATION_INBOX: "notification_inbox",
  NOTIFICATION_PREFERENCE: "notification_preference",
  WEBHOOK_ENDPOINT: "webhook_endpoint",
  WEBHOOK_DELIVERY: "webhook_delivery",
  EXTERNAL_SUBMISSION: "external_submission",
  WRITER_PROFILE: "writer_profile",
  CORRESPONDENCE: "correspondence",
  EMAIL_TEMPLATE: "email_template",
  CSR: "csr",
  AUDIT: "audit",
  COLLECTION: "collection",
  INVITATION: "invitation",
  CONTRIBUTOR: "contributor",
  CONTRIBUTOR_PUBLICATION: "contributor_publication",
  RIGHTS_AGREEMENT: "rights_agreement",
  PAYMENT_TRANSACTION: "payment_transaction",
  CONTEST: "contest",
  CONTEST_GROUP: "contest_group",
  SIMSUB_GROUP: "simsub_group",
  PORTFOLIO_ENTRY: "portfolio_entry",
  READER_FEEDBACK: "reader_feedback",
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
    | typeof AuditActions.USER_JIT_PROVISIONED
    | typeof AuditActions.USER_UPDATED
    | typeof AuditActions.USER_DEACTIVATED
    | typeof AuditActions.USER_REACTIVATED
    | typeof AuditActions.USER_REMOVED
    | typeof AuditActions.USER_EMAIL_VERIFIED
    | typeof AuditActions.USER_GDPR_DELETED
    | typeof AuditActions.USER_SOFT_DEACTIVATED;
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
    | typeof AuditActions.SUBMISSION_WITHDRAWN
    | typeof AuditActions.REVIEWER_ASSIGNED
    | typeof AuditActions.REVIEWER_UNASSIGNED
    | typeof AuditActions.REVIEWER_READ
    | typeof AuditActions.DISCUSSION_COMMENT_ADDED
    | typeof AuditActions.SUBMISSION_VOTE_CAST
    | typeof AuditActions.SUBMISSION_VOTE_UPDATED
    | typeof AuditActions.SUBMISSION_VOTE_DELETED
    | typeof AuditActions.SUBMISSION_EXPORTED;
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
    | typeof AuditActions.MANUSCRIPT_VERSION_CREATED
    | typeof AuditActions.CONTENT_EXTRACT_COMPLETE
    | typeof AuditActions.CONTENT_EXTRACT_FAILED
    | typeof AuditActions.CONTENT_EXTRACT_UNSUPPORTED;
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
    | typeof AuditActions.EMBED_SUBMISSION_RESUBMITTED
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
    | typeof AuditActions.PIPELINE_COMMENT_ADDED
    | typeof AuditActions.PIPELINE_COPYEDIT_SAVED
    | typeof AuditActions.PIPELINE_COPYEDIT_EXPORTED
    | typeof AuditActions.PIPELINE_COPYEDIT_IMPORTED;
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
    | typeof AuditActions.CONTRACT_SIGNED
    | typeof AuditActions.CONTRACT_COMPLETED
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
    | typeof AuditActions.FEDERATION_USER_KEY_ROTATED
    | typeof AuditActions.FEDERATION_USER_KEY_REVOKED
    | typeof AuditActions.FEDERATION_TRUST_INITIATED
    | typeof AuditActions.FEDERATION_TRUST_ACCEPTED
    | typeof AuditActions.FEDERATION_TRUST_REJECTED
    | typeof AuditActions.FEDERATION_TRUST_REVOKED
    | typeof AuditActions.FEDERATION_TRUST_RECEIVED
    | typeof AuditActions.FEDERATION_TRUST_AUTO_ACCEPTED
    | typeof AuditActions.FEDERATION_CONFIG_UPDATED;
}

export interface SimSubAuditParams extends BaseAuditParams {
  resource: typeof AuditResources.SIMSUB;
  action:
    | typeof AuditActions.SIMSUB_CHECK_PERFORMED
    | typeof AuditActions.SIMSUB_CONFLICT_FOUND
    | typeof AuditActions.SIMSUB_OVERRIDE_GRANTED
    | typeof AuditActions.SIMSUB_INBOUND_CHECK;
}

export interface TransferAuditParams extends BaseAuditParams {
  resource: typeof AuditResources.TRANSFER;
  action:
    | typeof AuditActions.TRANSFER_INITIATED
    | typeof AuditActions.TRANSFER_INBOUND_RECEIVED
    | typeof AuditActions.TRANSFER_COMPLETED
    | typeof AuditActions.TRANSFER_CANCELLED
    | typeof AuditActions.TRANSFER_FAILED
    | typeof AuditActions.TRANSFER_FILE_SERVED
    | typeof AuditActions.TRANSFER_FILES_FETCH_STARTED
    | typeof AuditActions.TRANSFER_FILES_FETCH_COMPLETED
    | typeof AuditActions.TRANSFER_FILES_FETCH_FAILED;
}

export interface MigrationAuditParams extends BaseAuditParams {
  resource: typeof AuditResources.MIGRATION;
  action:
    | typeof AuditActions.MIGRATION_REQUESTED
    | typeof AuditActions.MIGRATION_INBOUND_RECEIVED
    | typeof AuditActions.MIGRATION_APPROVED
    | typeof AuditActions.MIGRATION_REJECTED
    | typeof AuditActions.MIGRATION_BUNDLE_SENT
    | typeof AuditActions.MIGRATION_BUNDLE_RECEIVED
    | typeof AuditActions.MIGRATION_COMPLETED
    | typeof AuditActions.MIGRATION_FAILED
    | typeof AuditActions.MIGRATION_CANCELLED
    | typeof AuditActions.MIGRATION_FILE_SERVED
    | typeof AuditActions.MIGRATION_BROADCAST_SENT
    | typeof AuditActions.MIGRATION_BROADCAST_RECEIVED;
}

export interface HubAuditParams extends BaseAuditParams {
  resource: typeof AuditResources.HUB;
  action:
    | typeof AuditActions.HUB_INSTANCE_REGISTERED
    | typeof AuditActions.HUB_INSTANCE_SUSPENDED
    | typeof AuditActions.HUB_INSTANCE_REVOKED
    | typeof AuditActions.HUB_ATTESTATION_ISSUED
    | typeof AuditActions.HUB_FINGERPRINT_REGISTERED
    | typeof AuditActions.HUB_FINGERPRINT_QUERIED
    | typeof AuditActions.HUB_AUTO_TRUST_ESTABLISHED;
}

export interface EmailAuditParams extends BaseAuditParams {
  resource: typeof AuditResources.EMAIL;
  action:
    | typeof AuditActions.EMAIL_QUEUED
    | typeof AuditActions.EMAIL_SENT
    | typeof AuditActions.EMAIL_FAILED;
}

export interface NotificationInboxAuditParams extends BaseAuditParams {
  resource: typeof AuditResources.NOTIFICATION_INBOX;
  action:
    | typeof AuditActions.IN_APP_NOTIFICATION_CREATED
    | typeof AuditActions.IN_APP_NOTIFICATION_READ
    | typeof AuditActions.IN_APP_NOTIFICATION_ALL_READ;
}

export interface NotificationPreferenceAuditParams extends BaseAuditParams {
  resource: typeof AuditResources.NOTIFICATION_PREFERENCE;
  action: typeof AuditActions.NOTIFICATION_PREFERENCE_UPDATED;
}

export interface WebhookEndpointAuditParams extends BaseAuditParams {
  resource: typeof AuditResources.WEBHOOK_ENDPOINT;
  action:
    | typeof AuditActions.WEBHOOK_ENDPOINT_CREATED
    | typeof AuditActions.WEBHOOK_ENDPOINT_UPDATED
    | typeof AuditActions.WEBHOOK_ENDPOINT_DELETED
    | typeof AuditActions.WEBHOOK_ENDPOINT_SECRET_ROTATED
    | typeof AuditActions.WEBHOOK_ENDPOINT_AUTO_DISABLED;
}

export interface WebhookDeliveryAuditParams extends BaseAuditParams {
  resource: typeof AuditResources.WEBHOOK_DELIVERY;
  action:
    | typeof AuditActions.WEBHOOK_DELIVERED
    | typeof AuditActions.WEBHOOK_DELIVERY_FAILED
    | typeof AuditActions.WEBHOOK_DELIVERY_RETRIED;
}

export interface ExternalSubmissionAuditParams extends BaseAuditParams {
  resource: typeof AuditResources.EXTERNAL_SUBMISSION;
  action:
    | typeof AuditActions.EXTERNAL_SUBMISSION_CREATED
    | typeof AuditActions.EXTERNAL_SUBMISSION_UPDATED
    | typeof AuditActions.EXTERNAL_SUBMISSION_DELETED;
}

export interface WriterProfileAuditParams extends BaseAuditParams {
  resource: typeof AuditResources.WRITER_PROFILE;
  action:
    | typeof AuditActions.WRITER_PROFILE_CREATED
    | typeof AuditActions.WRITER_PROFILE_UPDATED
    | typeof AuditActions.WRITER_PROFILE_DELETED;
}

export interface CorrespondenceAuditParams extends BaseAuditParams {
  resource: typeof AuditResources.CORRESPONDENCE;
  action:
    | typeof AuditActions.CORRESPONDENCE_SENT
    | typeof AuditActions.CORRESPONDENCE_AUTO_CAPTURED
    | typeof AuditActions.CORRESPONDENCE_MANUAL_LOGGED;
}

export interface EmailTemplateAuditParams extends BaseAuditParams {
  resource: typeof AuditResources.EMAIL_TEMPLATE;
  action:
    | typeof AuditActions.EMAIL_TEMPLATE_CREATED
    | typeof AuditActions.EMAIL_TEMPLATE_UPDATED
    | typeof AuditActions.EMAIL_TEMPLATE_DELETED;
}

export interface CSRAuditParams extends BaseAuditParams {
  resource: typeof AuditResources.CSR;
  action: typeof AuditActions.CSR_EXPORTED | typeof AuditActions.CSR_IMPORTED;
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

export interface CollectionAuditParams extends BaseAuditParams {
  resource: typeof AuditResources.COLLECTION;
  action:
    | typeof AuditActions.COLLECTION_CREATED
    | typeof AuditActions.COLLECTION_UPDATED
    | typeof AuditActions.COLLECTION_DELETED
    | typeof AuditActions.COLLECTION_ITEM_ADDED
    | typeof AuditActions.COLLECTION_ITEM_REMOVED
    | typeof AuditActions.COLLECTION_ITEM_UPDATED;
}

export interface InvitationAuditParams extends BaseAuditParams {
  resource: typeof AuditResources.INVITATION;
  action:
    | typeof AuditActions.INVITATION_CREATED
    | typeof AuditActions.INVITATION_REVOKED
    | typeof AuditActions.INVITATION_ACCEPTED
    | typeof AuditActions.INVITATION_RESENT;
}

export interface ContributorAuditParams extends BaseAuditParams {
  resource: typeof AuditResources.CONTRIBUTOR;
  action:
    | typeof AuditActions.CONTRIBUTOR_CREATED
    | typeof AuditActions.CONTRIBUTOR_UPDATED
    | typeof AuditActions.CONTRIBUTOR_DELETED
    | typeof AuditActions.CONTRIBUTOR_LINKED
    | typeof AuditActions.CONTRIBUTOR_UNLINKED
    | typeof AuditActions.CONTRIBUTOR_PUBLICATION_ADDED
    | typeof AuditActions.CONTRIBUTOR_PUBLICATION_REMOVED;
}

export interface RightsAgreementAuditParams extends BaseAuditParams {
  resource: typeof AuditResources.RIGHTS_AGREEMENT;
  action:
    | typeof AuditActions.RIGHTS_AGREEMENT_CREATED
    | typeof AuditActions.RIGHTS_AGREEMENT_UPDATED
    | typeof AuditActions.RIGHTS_AGREEMENT_SENT
    | typeof AuditActions.RIGHTS_AGREEMENT_SIGNED
    | typeof AuditActions.RIGHTS_AGREEMENT_ACTIVATED
    | typeof AuditActions.RIGHTS_AGREEMENT_REVERTED
    | typeof AuditActions.RIGHTS_AGREEMENT_DELETED;
}

export interface PaymentTransactionAuditParams extends BaseAuditParams {
  resource: typeof AuditResources.PAYMENT_TRANSACTION;
  action:
    | typeof AuditActions.PAYMENT_TRANSACTION_CREATED
    | typeof AuditActions.PAYMENT_TRANSACTION_UPDATED
    | typeof AuditActions.PAYMENT_TRANSACTION_STATUS_CHANGED
    | typeof AuditActions.PAYMENT_TRANSACTION_DELETED;
}

export interface ContestGroupAuditParams extends BaseAuditParams {
  resource: typeof AuditResources.CONTEST_GROUP;
  action:
    | typeof AuditActions.CONTEST_GROUP_CREATED
    | typeof AuditActions.CONTEST_GROUP_UPDATED
    | typeof AuditActions.CONTEST_GROUP_DELETED;
}

export interface ContestAuditParams extends BaseAuditParams {
  resource: typeof AuditResources.CONTEST;
  action:
    | typeof AuditActions.CONTEST_JUDGE_ASSIGNED
    | typeof AuditActions.CONTEST_JUDGE_UPDATED
    | typeof AuditActions.CONTEST_JUDGE_REMOVED
    | typeof AuditActions.CONTEST_RESULT_CREATED
    | typeof AuditActions.CONTEST_RESULT_UPDATED
    | typeof AuditActions.CONTEST_RESULT_DELETED
    | typeof AuditActions.CONTEST_WINNERS_ANNOUNCED
    | typeof AuditActions.CONTEST_PRIZE_DISBURSED;
}

export interface SimsubGroupAuditParams extends BaseAuditParams {
  resource: typeof AuditResources.SIMSUB_GROUP;
  action:
    | typeof AuditActions.SIMSUB_GROUP_CREATED
    | typeof AuditActions.SIMSUB_GROUP_UPDATED
    | typeof AuditActions.SIMSUB_GROUP_DELETED
    | typeof AuditActions.SIMSUB_GROUP_SUBMISSION_ADDED
    | typeof AuditActions.SIMSUB_GROUP_SUBMISSION_REMOVED;
}

export interface PortfolioEntryAuditParams extends BaseAuditParams {
  resource: typeof AuditResources.PORTFOLIO_ENTRY;
  action:
    | typeof AuditActions.PORTFOLIO_ENTRY_CREATED
    | typeof AuditActions.PORTFOLIO_ENTRY_UPDATED
    | typeof AuditActions.PORTFOLIO_ENTRY_DELETED;
}

export interface ReaderFeedbackAuditParams extends BaseAuditParams {
  resource: typeof AuditResources.READER_FEEDBACK;
  action:
    | typeof AuditActions.READER_FEEDBACK_CREATED
    | typeof AuditActions.READER_FEEDBACK_FORWARDED
    | typeof AuditActions.READER_FEEDBACK_DELETED;
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
  | TransferAuditParams
  | MigrationAuditParams
  | HubAuditParams
  | EmailAuditParams
  | NotificationInboxAuditParams
  | NotificationPreferenceAuditParams
  | WebhookEndpointAuditParams
  | WebhookDeliveryAuditParams
  | ExternalSubmissionAuditParams
  | WriterProfileAuditParams
  | CorrespondenceAuditParams
  | EmailTemplateAuditParams
  | CSRAuditParams
  | AuditAccessAuditParams
  | SystemAuditParams
  | CollectionAuditParams
  | InvitationAuditParams
  | ContributorAuditParams
  | RightsAgreementAuditParams
  | PaymentTransactionAuditParams
  | ContestGroupAuditParams
  | ContestAuditParams
  | SimsubGroupAuditParams
  | PortfolioEntryAuditParams
  | ReaderFeedbackAuditParams;

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
