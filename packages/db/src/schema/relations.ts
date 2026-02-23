import { relations } from "drizzle-orm";
import { organizations } from "./organizations";
import { users } from "./users";
import { organizationMembers } from "./members";
import { formDefinitions, formFields, formPages } from "./forms";
import { manuscripts, manuscriptVersions, files } from "./manuscripts";
import {
  submissionPeriods,
  submissions,
  submissionHistory,
} from "./submissions";
import { payments } from "./payments";
import { auditEvents, dsarRequests } from "./audit";
import { retentionPolicies, userConsents } from "./compliance";
import { apiKeys } from "./api-keys";
import { publications } from "./publications";
import { pipelineItems, pipelineHistory, pipelineComments } from "./pipeline";
import { contractTemplates, contracts } from "./contracts";
import { issues, issueSections, issueItems } from "./issues";

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
  publications: many(publications),
  pipelineItems: many(pipelineItems),
  contractTemplates: many(contractTemplates),
  contracts: many(contracts),
  issues: many(issues),
}));

// --- users ---

export const usersRelations = relations(users, ({ many }) => ({
  memberships: many(organizationMembers),
  formDefinitions: many(formDefinitions),
  submissions: many(submissions),
  manuscripts: many(manuscripts),
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

// --- manuscripts ---

export const manuscriptsRelations = relations(manuscripts, ({ one, many }) => ({
  owner: one(users, {
    fields: [manuscripts.ownerId],
    references: [users.id],
  }),
  versions: many(manuscriptVersions),
}));

// --- manuscript_versions ---

export const manuscriptVersionsRelations = relations(
  manuscriptVersions,
  ({ one, many }) => ({
    manuscript: one(manuscripts, {
      fields: [manuscriptVersions.manuscriptId],
      references: [manuscripts.id],
    }),
    files: many(files),
    submissions: many(submissions),
  }),
);

// --- files ---

export const filesRelations = relations(files, ({ one }) => ({
  manuscriptVersion: one(manuscriptVersions, {
    fields: [files.manuscriptVersionId],
    references: [manuscriptVersions.id],
  }),
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
    publication: one(publications, {
      fields: [submissionPeriods.publicationId],
      references: [publications.id],
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
  manuscriptVersion: one(manuscriptVersions, {
    fields: [submissions.manuscriptVersionId],
    references: [manuscriptVersions.id],
  }),
  history: many(submissionHistory),
  payments: many(payments),
  pipelineItems: many(pipelineItems),
}));

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

// --- publications ---

export const publicationsRelations = relations(
  publications,
  ({ one, many }) => ({
    organization: one(organizations, {
      fields: [publications.organizationId],
      references: [organizations.id],
    }),
    submissionPeriods: many(submissionPeriods),
    pipelineItems: many(pipelineItems),
    issues: many(issues),
  }),
);

// --- pipeline_items ---

export const pipelineItemsRelations = relations(
  pipelineItems,
  ({ one, many }) => ({
    organization: one(organizations, {
      fields: [pipelineItems.organizationId],
      references: [organizations.id],
    }),
    submission: one(submissions, {
      fields: [pipelineItems.submissionId],
      references: [submissions.id],
    }),
    publication: one(publications, {
      fields: [pipelineItems.publicationId],
      references: [publications.id],
    }),
    copyeditor: one(users, {
      fields: [pipelineItems.assignedCopyeditorId],
      references: [users.id],
      relationName: "pipelineItemCopyeditor",
    }),
    proofreader: one(users, {
      fields: [pipelineItems.assignedProofreaderId],
      references: [users.id],
      relationName: "pipelineItemProofreader",
    }),
    history: many(pipelineHistory),
    comments: many(pipelineComments),
    contracts: many(contracts),
    issueItems: many(issueItems),
  }),
);

// --- pipeline_history ---

export const pipelineHistoryRelations = relations(
  pipelineHistory,
  ({ one }) => ({
    pipelineItem: one(pipelineItems, {
      fields: [pipelineHistory.pipelineItemId],
      references: [pipelineItems.id],
    }),
  }),
);

// --- pipeline_comments ---

export const pipelineCommentsRelations = relations(
  pipelineComments,
  ({ one }) => ({
    pipelineItem: one(pipelineItems, {
      fields: [pipelineComments.pipelineItemId],
      references: [pipelineItems.id],
    }),
    author: one(users, {
      fields: [pipelineComments.authorId],
      references: [users.id],
    }),
  }),
);

// --- contract_templates ---

export const contractTemplatesRelations = relations(
  contractTemplates,
  ({ one, many }) => ({
    organization: one(organizations, {
      fields: [contractTemplates.organizationId],
      references: [organizations.id],
    }),
    contracts: many(contracts),
  }),
);

// --- contracts ---

export const contractsRelations = relations(contracts, ({ one }) => ({
  organization: one(organizations, {
    fields: [contracts.organizationId],
    references: [organizations.id],
  }),
  pipelineItem: one(pipelineItems, {
    fields: [contracts.pipelineItemId],
    references: [pipelineItems.id],
  }),
  contractTemplate: one(contractTemplates, {
    fields: [contracts.contractTemplateId],
    references: [contractTemplates.id],
  }),
}));

// --- issues ---

export const issuesRelations = relations(issues, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [issues.organizationId],
    references: [organizations.id],
  }),
  publication: one(publications, {
    fields: [issues.publicationId],
    references: [publications.id],
  }),
  sections: many(issueSections),
  items: many(issueItems),
}));

// --- issue_sections ---

export const issueSectionsRelations = relations(
  issueSections,
  ({ one, many }) => ({
    issue: one(issues, {
      fields: [issueSections.issueId],
      references: [issues.id],
    }),
    items: many(issueItems),
  }),
);

// --- issue_items ---

export const issueItemsRelations = relations(issueItems, ({ one }) => ({
  issue: one(issues, {
    fields: [issueItems.issueId],
    references: [issues.id],
  }),
  pipelineItem: one(pipelineItems, {
    fields: [issueItems.pipelineItemId],
    references: [pipelineItems.id],
  }),
  section: one(issueSections, {
    fields: [issueItems.issueSectionId],
    references: [issueSections.id],
  }),
}));
