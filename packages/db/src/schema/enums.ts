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
