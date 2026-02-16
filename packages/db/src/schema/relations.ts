import { relations } from "drizzle-orm";
import { organizations } from "./organizations";
import { users } from "./users";
import { organizationMembers } from "./members";
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

// --- submission_periods ---

export const submissionPeriodsRelations = relations(
  submissionPeriods,
  ({ one, many }) => ({
    organization: one(organizations, {
      fields: [submissionPeriods.organizationId],
      references: [organizations.id],
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
