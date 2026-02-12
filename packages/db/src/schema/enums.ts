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
