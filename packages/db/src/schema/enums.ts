import { pgEnum } from "drizzle-orm/pg-core";

export const roleEnum = pgEnum("Role", ["ADMIN", "EDITOR", "READER"]);

export const submissionStatusEnum = pgEnum("SubmissionStatus", [
  "DRAFT",
  "SUBMITTED",
  "UNDER_REVIEW",
  "ACCEPTED",
  "REJECTED",
  "HOLD",
  "WITHDRAWN",
  "REVISE_AND_RESUBMIT",
]);

export const scanStatusEnum = pgEnum("ScanStatus", [
  "PENDING",
  "SCANNING",
  "CLEAN",
  "INFECTED",
  "FAILED",
]);

export const paymentStatusEnum = pgEnum("PaymentStatus", [
  "PENDING",
  "PROCESSING",
  "SUCCEEDED",
  "FAILED",
  "REFUNDED",
]);

export const dsarTypeEnum = pgEnum("DsarType", [
  "ACCESS",
  "ERASURE",
  "RECTIFICATION",
  "PORTABILITY",
]);

export const dsarStatusEnum = pgEnum("DsarStatus", [
  "PENDING",
  "IN_PROGRESS",
  "COMPLETED",
  "REJECTED",
]);

export const formStatusEnum = pgEnum("FormStatus", [
  "DRAFT",
  "PUBLISHED",
  "ARCHIVED",
]);

export const formFieldTypeEnum = pgEnum("FormFieldType", [
  "text",
  "textarea",
  "rich_text",
  "number",
  "email",
  "url",
  "date",
  "select",
  "multi_select",
  "radio",
  "checkbox",
  "checkbox_group",
  "file_upload",
  "section_header",
  "info_text",
]);

export const voteDecisionEnum = pgEnum("VoteDecision", [
  "ACCEPT",
  "REJECT",
  "MAYBE",
]);

// ---------------------------------------------------------------------------
// Slate — Publication Pipeline
// ---------------------------------------------------------------------------

export const publicationStatusEnum = pgEnum("PublicationStatus", [
  "ACTIVE",
  "ARCHIVED",
]);

export const pipelineStageEnum = pgEnum("PipelineStage", [
  "COPYEDIT_PENDING",
  "COPYEDIT_IN_PROGRESS",
  "AUTHOR_REVIEW",
  "PROOFREAD",
  "READY_TO_PUBLISH",
  "PUBLISHED",
  "WITHDRAWN",
]);

export const issueStatusEnum = pgEnum("IssueStatus", [
  "PLANNING",
  "ASSEMBLING",
  "READY",
  "PUBLISHED",
  "ARCHIVED",
]);

export const cmsAdapterTypeEnum = pgEnum("CmsAdapterType", [
  "WORDPRESS",
  "GHOST",
]);

// ---------------------------------------------------------------------------
// Register — Identity & Federation
// ---------------------------------------------------------------------------

export const federationModeEnum = pgEnum("FederationMode", [
  "allowlist",
  "open",
  "managed_hub",
]);

export const peerTrustStatusEnum = pgEnum("PeerTrustStatus", [
  "pending_outbound",
  "pending_inbound",
  "active",
  "rejected",
  "revoked",
]);

export const simSubCheckResultEnum = pgEnum("SimSubCheckResult", [
  "CLEAR",
  "CONFLICT",
  "PARTIAL",
  "SKIPPED",
]);

export const pieceTransferStatusEnum = pgEnum("PieceTransferStatus", [
  "PENDING",
  "FILES_REQUESTED",
  "COMPLETED",
  "REJECTED",
  "FAILED",
  "CANCELLED",
  "EXPIRED",
]);

export const identityMigrationDirectionEnum = pgEnum(
  "IdentityMigrationDirection",
  ["outbound", "inbound"],
);

export const hubInstanceStatusEnum = pgEnum("HubInstanceStatus", [
  "active",
  "suspended",
  "revoked",
]);

export const trustInitiatorEnum = pgEnum("TrustInitiator", ["local", "remote"]);

export const inboundTransferStatusEnum = pgEnum("InboundTransferStatus", [
  "RECEIVED",
  "FILES_FETCHING",
  "FILES_COMPLETE",
  "FAILED",
]);

export const identityMigrationStatusEnum = pgEnum("IdentityMigrationStatus", [
  "PENDING",
  "PENDING_APPROVAL",
  "APPROVED",
  "BUNDLE_SENT",
  "PROCESSING",
  "COMPLETED",
  "REJECTED",
  "FAILED",
  "EXPIRED",
  "CANCELLED",
]);

// ---------------------------------------------------------------------------
// Relay — Notifications & Communications
// ---------------------------------------------------------------------------

export const emailSendStatusEnum = pgEnum("EmailSendStatus", [
  "QUEUED",
  "SENDING",
  "SENT",
  "FAILED",
  "BOUNCED",
]);

export const notificationChannelEnum = pgEnum("NotificationChannel", [
  "email",
  "in_app",
]);

export const webhookEndpointStatusEnum = pgEnum("WebhookEndpointStatus", [
  "ACTIVE",
  "DISABLED",
]);

export const webhookDeliveryStatusEnum = pgEnum("WebhookDeliveryStatus", [
  "QUEUED",
  "DELIVERING",
  "DELIVERED",
  "FAILED",
]);

export const contractStatusEnum = pgEnum("ContractStatus", [
  "DRAFT",
  "SENT",
  "VIEWED",
  "SIGNED",
  "COUNTERSIGNED",
  "COMPLETED",
  "VOIDED",
]);

// ---------------------------------------------------------------------------
// Register — Writer Workspace (CSR)
// ---------------------------------------------------------------------------

export const primaryGenreEnum = pgEnum("PrimaryGenre", [
  "poetry",
  "fiction",
  "creative_nonfiction",
  "nonfiction",
  "drama",
  "translation",
  "visual_art",
  "comics",
  "audio",
  "other",
]);

export const csrStatusEnum = pgEnum("CsrStatus", [
  "draft",
  "sent",
  "in_review",
  "hold",
  "accepted",
  "rejected",
  "withdrawn",
  "no_response",
  "revise",
  "unknown",
]);

export const correspondenceDirectionEnum = pgEnum("CorrespondenceDirection", [
  "inbound",
  "outbound",
]);

export const correspondenceChannelEnum = pgEnum("CorrespondenceChannel", [
  "email",
  "portal",
  "in_app",
  "other",
]);
