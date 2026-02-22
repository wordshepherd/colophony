import type { InferSelectModel, InferInsertModel } from "drizzle-orm";
import type { organizations } from "./schema/organizations";
import type { users } from "./schema/users";
import type { organizationMembers } from "./schema/members";
import type { formDefinitions, formFields, formPages } from "./schema/forms";
import type {
  manuscripts,
  manuscriptVersions,
  files,
} from "./schema/manuscripts";
import type {
  submissionPeriods,
  submissions,
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
export type FormPage = InferSelectModel<typeof formPages>;
export type Manuscript = InferSelectModel<typeof manuscripts>;
export type ManuscriptVersion = InferSelectModel<typeof manuscriptVersions>;
export type File = InferSelectModel<typeof files>;
export type SubmissionPeriod = InferSelectModel<typeof submissionPeriods>;
export type Submission = InferSelectModel<typeof submissions>;
export type SubmissionHistoryEntry = InferSelectModel<typeof submissionHistory>;
export type Payment = InferSelectModel<typeof payments>;
export type StripeWebhookEvent = InferSelectModel<typeof stripeWebhookEvents>;
export type AuditEvent = InferSelectModel<typeof auditEvents>;
export type DsarRequest = InferSelectModel<typeof dsarRequests>;
export type RetentionPolicy = InferSelectModel<typeof retentionPolicies>;
export type UserConsent = InferSelectModel<typeof userConsents>;
export type OutboxEvent = InferSelectModel<typeof outboxEvents>;
export type ZitadelWebhookEvent = InferSelectModel<typeof zitadelWebhookEvents>;

/** @deprecated Use File instead — submission_files has been replaced by the files table */
export type SubmissionFile = File;

// --- Insert types (what you pass to insert queries) ---

export type NewOrganization = InferInsertModel<typeof organizations>;
export type NewUser = InferInsertModel<typeof users>;
export type NewOrganizationMember = InferInsertModel<
  typeof organizationMembers
>;
export type NewFormDefinition = InferInsertModel<typeof formDefinitions>;
export type NewFormField = InferInsertModel<typeof formFields>;
export type NewFormPage = InferInsertModel<typeof formPages>;
export type NewManuscript = InferInsertModel<typeof manuscripts>;
export type NewManuscriptVersion = InferInsertModel<typeof manuscriptVersions>;
export type NewFile = InferInsertModel<typeof files>;
export type NewSubmissionPeriod = InferInsertModel<typeof submissionPeriods>;
export type NewSubmission = InferInsertModel<typeof submissions>;
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

/** @deprecated Use NewFile instead */
export type NewSubmissionFile = NewFile;
