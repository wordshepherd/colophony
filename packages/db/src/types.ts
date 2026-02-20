import type { InferSelectModel, InferInsertModel } from "drizzle-orm";
import type { organizations } from "./schema/organizations";
import type { users } from "./schema/users";
import type { organizationMembers } from "./schema/members";
import type { formDefinitions, formFields } from "./schema/forms";
import type {
  submissionPeriods,
  submissions,
  submissionFiles,
  submissionHistory,
} from "./schema/submissions";
import type { payments, stripeWebhookEvents } from "./schema/payments";
import type { auditEvents, dsarRequests } from "./schema/audit";
import type { retentionPolicies, userConsents } from "./schema/compliance";
import type { outboxEvents } from "./schema/messaging";
import type { zitadelWebhookEvents } from "./schema/webhooks";

// --- Select types (what you get back from queries) ---

export type Organization = InferSelectModel<typeof organizations>;
export type User = InferSelectModel<typeof users>;
export type OrganizationMember = InferSelectModel<typeof organizationMembers>;
export type FormDefinition = InferSelectModel<typeof formDefinitions>;
export type FormField = InferSelectModel<typeof formFields>;
export type SubmissionPeriod = InferSelectModel<typeof submissionPeriods>;
export type Submission = InferSelectModel<typeof submissions>;
export type SubmissionFile = InferSelectModel<typeof submissionFiles>;
export type SubmissionHistoryEntry = InferSelectModel<typeof submissionHistory>;
export type Payment = InferSelectModel<typeof payments>;
export type StripeWebhookEvent = InferSelectModel<typeof stripeWebhookEvents>;
export type AuditEvent = InferSelectModel<typeof auditEvents>;
export type DsarRequest = InferSelectModel<typeof dsarRequests>;
export type RetentionPolicy = InferSelectModel<typeof retentionPolicies>;
export type UserConsent = InferSelectModel<typeof userConsents>;
export type OutboxEvent = InferSelectModel<typeof outboxEvents>;
export type ZitadelWebhookEvent = InferSelectModel<typeof zitadelWebhookEvents>;

// --- Insert types (what you pass to insert queries) ---

export type NewOrganization = InferInsertModel<typeof organizations>;
export type NewUser = InferInsertModel<typeof users>;
export type NewOrganizationMember = InferInsertModel<
  typeof organizationMembers
>;
export type NewFormDefinition = InferInsertModel<typeof formDefinitions>;
export type NewFormField = InferInsertModel<typeof formFields>;
export type NewSubmissionPeriod = InferInsertModel<typeof submissionPeriods>;
export type NewSubmission = InferInsertModel<typeof submissions>;
export type NewSubmissionFile = InferInsertModel<typeof submissionFiles>;
export type NewSubmissionHistoryEntry = InferInsertModel<
  typeof submissionHistory
>;
export type NewPayment = InferInsertModel<typeof payments>;
export type NewStripeWebhookEvent = InferInsertModel<
  typeof stripeWebhookEvents
>;
export type NewAuditEvent = InferInsertModel<typeof auditEvents>;
export type NewDsarRequest = InferInsertModel<typeof dsarRequests>;
export type NewRetentionPolicy = InferInsertModel<typeof retentionPolicies>;
export type NewUserConsent = InferInsertModel<typeof userConsents>;
export type NewOutboxEvent = InferInsertModel<typeof outboxEvents>;
export type NewZitadelWebhookEvent = InferInsertModel<
  typeof zitadelWebhookEvents
>;
