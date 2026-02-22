import { relations } from "drizzle-orm";
import { organizations } from "./organizations";
import { users } from "./users";
import { organizationMembers } from "./members";
import { formDefinitions, formFields, formPages } from "./forms";
import {
  submissionPeriods,
  submissions,
  submissionFiles,
  submissionHistory,
} from "./submissions";
import { payments } from "./payments";
import { auditEvents, dsarRequests } from "./audit";
import { retentionPolicies, userConsents } from "./compliance";
import { apiKeys } from "./api-keys";

// --- organizations ---

export const organizationsRelations = relations(organizations, ({ many }) => ({
  members: many(organizationMembers),
  formDefinitions: many(formDefinitions),
  submissionPeriods: many(submissionPeriods),
  submissions: many(submissions),
  payments: many(payments),
  auditEvents: many(auditEvents),
  retentionPolicies: many(retentionPolicies),
  userConsents: many(userConsents),
  apiKeys: many(apiKeys),
}));

// --- users ---

export const usersRelations = relations(users, ({ many }) => ({
  memberships: many(organizationMembers),
  formDefinitions: many(formDefinitions),
  submissions: many(submissions),
  auditEvents: many(auditEvents),
  dsarRequests: many(dsarRequests),
  userConsents: many(userConsents),
  apiKeys: many(apiKeys),
}));

// --- organization_members ---

export const organizationMembersRelations = relations(
  organizationMembers,
  ({ one }) => ({
    organization: one(organizations, {
      fields: [organizationMembers.organizationId],
      references: [organizations.id],
    }),
    user: one(users, {
      fields: [organizationMembers.userId],
      references: [users.id],
    }),
  }),
);

// --- form_definitions ---

export const formDefinitionsRelations = relations(
  formDefinitions,
  ({ one, many }) => ({
    organization: one(organizations, {
      fields: [formDefinitions.organizationId],
      references: [organizations.id],
    }),
    creator: one(users, {
      fields: [formDefinitions.createdBy],
      references: [users.id],
    }),
    fields: many(formFields),
    pages: many(formPages),
    submissionPeriods: many(submissionPeriods),
    submissions: many(submissions),
  }),
);

// --- form_fields ---

export const formFieldsRelations = relations(formFields, ({ one }) => ({
  formDefinition: one(formDefinitions, {
    fields: [formFields.formDefinitionId],
    references: [formDefinitions.id],
  }),
  page: one(formPages, {
    fields: [formFields.pageId],
    references: [formPages.id],
  }),
}));

// --- form_pages ---

export const formPagesRelations = relations(formPages, ({ one, many }) => ({
  formDefinition: one(formDefinitions, {
    fields: [formPages.formDefinitionId],
    references: [formDefinitions.id],
  }),
  fields: many(formFields),
}));

// --- submission_periods ---

export const submissionPeriodsRelations = relations(
  submissionPeriods,
  ({ one, many }) => ({
    organization: one(organizations, {
      fields: [submissionPeriods.organizationId],
      references: [organizations.id],
    }),
    formDefinition: one(formDefinitions, {
      fields: [submissionPeriods.formDefinitionId],
      references: [formDefinitions.id],
    }),
    submissions: many(submissions),
  }),
);

// --- submissions ---

export const submissionsRelations = relations(submissions, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [submissions.organizationId],
    references: [organizations.id],
  }),
  submitter: one(users, {
    fields: [submissions.submitterId],
    references: [users.id],
  }),
  submissionPeriod: one(submissionPeriods, {
    fields: [submissions.submissionPeriodId],
    references: [submissionPeriods.id],
  }),
  formDefinition: one(formDefinitions, {
    fields: [submissions.formDefinitionId],
    references: [formDefinitions.id],
  }),
  files: many(submissionFiles),
  history: many(submissionHistory),
  payments: many(payments),
}));

// --- submission_files ---

export const submissionFilesRelations = relations(
  submissionFiles,
  ({ one }) => ({
    submission: one(submissions, {
      fields: [submissionFiles.submissionId],
      references: [submissions.id],
    }),
  }),
);

// --- submission_history ---

export const submissionHistoryRelations = relations(
  submissionHistory,
  ({ one }) => ({
    submission: one(submissions, {
      fields: [submissionHistory.submissionId],
      references: [submissions.id],
    }),
  }),
);

// --- payments ---

export const paymentsRelations = relations(payments, ({ one }) => ({
  organization: one(organizations, {
    fields: [payments.organizationId],
    references: [organizations.id],
  }),
  submission: one(submissions, {
    fields: [payments.submissionId],
    references: [submissions.id],
  }),
}));

// --- audit_events ---

export const auditEventsRelations = relations(auditEvents, ({ one }) => ({
  organization: one(organizations, {
    fields: [auditEvents.organizationId],
    references: [organizations.id],
  }),
  actor: one(users, {
    fields: [auditEvents.actorId],
    references: [users.id],
  }),
}));

// --- dsar_requests ---

export const dsarRequestsRelations = relations(dsarRequests, ({ one }) => ({
  user: one(users, {
    fields: [dsarRequests.userId],
    references: [users.id],
  }),
}));

// --- retention_policies ---

export const retentionPoliciesRelations = relations(
  retentionPolicies,
  ({ one }) => ({
    organization: one(organizations, {
      fields: [retentionPolicies.organizationId],
      references: [organizations.id],
    }),
  }),
);

// --- user_consents ---

export const userConsentsRelations = relations(userConsents, ({ one }) => ({
  user: one(users, {
    fields: [userConsents.userId],
    references: [users.id],
  }),
  organization: one(organizations, {
    fields: [userConsents.organizationId],
    references: [organizations.id],
  }),
}));

// --- api_keys ---

export const apiKeysRelations = relations(apiKeys, ({ one }) => ({
  organization: one(organizations, {
    fields: [apiKeys.organizationId],
    references: [organizations.id],
  }),
  creator: one(users, {
    fields: [apiKeys.createdBy],
    references: [users.id],
  }),
}));
