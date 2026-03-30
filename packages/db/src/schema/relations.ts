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
import { cmsConnections } from "./cms";
import { trustedPeers } from "./trusted-peers";
import {
  journalDirectory,
  externalSubmissions,
  correspondence,
  writerProfiles,
} from "./writer-workspace";
import { savedQueuePresets } from "./saved-queue-presets";
import { workspaceCollections, workspaceItems } from "./workspace-collections";
import {
  contributors,
  contributorPublications,
  rightsAgreements,
  paymentTransactions,
} from "./business-ops";
import { contestGroups, contestJudges, contestResults } from "./contests";

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
  cmsConnections: many(cmsConnections),
  trustedPeers: many(trustedPeers),
  savedQueuePresets: many(savedQueuePresets),
  workspaceCollections: many(workspaceCollections),
  contributors: many(contributors),
  rightsAgreements: many(rightsAgreements),
  paymentTransactions: many(paymentTransactions),
  contestGroups: many(contestGroups),
  contestJudges: many(contestJudges),
  contestResults: many(contestResults),
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
  externalSubmissions: many(externalSubmissions),
  correspondence: many(correspondence),
  writerProfiles: many(writerProfiles),
  savedQueuePresets: many(savedQueuePresets),
  workspaceCollections: many(workspaceCollections),
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
  externalSubmissions: many(externalSubmissions),
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
    contestGroup: one(contestGroups, {
      fields: [submissionPeriods.contestGroupId],
      references: [contestGroups.id],
    }),
    submissions: many(submissions),
    contestJudges: many(contestJudges),
    contestResults: many(contestResults),
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
  correspondence: many(correspondence),
  workspaceItems: many(workspaceItems),
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
    cmsConnections: many(cmsConnections),
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

// --- cms_connections ---

// --- trusted_peers ---

export const trustedPeersRelations = relations(trustedPeers, ({ one }) => ({
  organization: one(organizations, {
    fields: [trustedPeers.organizationId],
    references: [organizations.id],
  }),
}));

// --- cms_connections ---

export const cmsConnectionsRelations = relations(cmsConnections, ({ one }) => ({
  organization: one(organizations, {
    fields: [cmsConnections.organizationId],
    references: [organizations.id],
  }),
  publication: one(publications, {
    fields: [cmsConnections.publicationId],
    references: [publications.id],
  }),
}));

// --- journal_directory ---

export const journalDirectoryRelations = relations(
  journalDirectory,
  ({ many }) => ({
    externalSubmissions: many(externalSubmissions),
  }),
);

// --- external_submissions ---

export const externalSubmissionsRelations = relations(
  externalSubmissions,
  ({ one, many }) => ({
    user: one(users, {
      fields: [externalSubmissions.userId],
      references: [users.id],
    }),
    manuscript: one(manuscripts, {
      fields: [externalSubmissions.manuscriptId],
      references: [manuscripts.id],
    }),
    journal: one(journalDirectory, {
      fields: [externalSubmissions.journalDirectoryId],
      references: [journalDirectory.id],
    }),
    correspondence: many(correspondence),
  }),
);

// --- correspondence ---

export const correspondenceRelations = relations(correspondence, ({ one }) => ({
  user: one(users, {
    fields: [correspondence.userId],
    references: [users.id],
  }),
  submission: one(submissions, {
    fields: [correspondence.submissionId],
    references: [submissions.id],
  }),
  externalSubmission: one(externalSubmissions, {
    fields: [correspondence.externalSubmissionId],
    references: [externalSubmissions.id],
  }),
}));

// --- writer_profiles ---

export const writerProfilesRelations = relations(writerProfiles, ({ one }) => ({
  user: one(users, {
    fields: [writerProfiles.userId],
    references: [users.id],
  }),
}));

// --- workspace_collections ---

export const workspaceCollectionsRelations = relations(
  workspaceCollections,
  ({ one, many }) => ({
    organization: one(organizations, {
      fields: [workspaceCollections.organizationId],
      references: [organizations.id],
    }),
    owner: one(users, {
      fields: [workspaceCollections.ownerId],
      references: [users.id],
    }),
    items: many(workspaceItems),
  }),
);

// --- workspace_items ---

export const workspaceItemsRelations = relations(workspaceItems, ({ one }) => ({
  collection: one(workspaceCollections, {
    fields: [workspaceItems.collectionId],
    references: [workspaceCollections.id],
  }),
  submission: one(submissions, {
    fields: [workspaceItems.submissionId],
    references: [submissions.id],
  }),
}));

// --- contributors ---

export const contributorsRelations = relations(
  contributors,
  ({ one, many }) => ({
    organization: one(organizations, {
      fields: [contributors.organizationId],
      references: [organizations.id],
    }),
    user: one(users, {
      fields: [contributors.userId],
      references: [users.id],
    }),
    publications: many(contributorPublications),
    rightsAgreements: many(rightsAgreements),
    paymentTransactions: many(paymentTransactions),
  }),
);

// --- contributor_publications ---

export const contributorPublicationsRelations = relations(
  contributorPublications,
  ({ one }) => ({
    contributor: one(contributors, {
      fields: [contributorPublications.contributorId],
      references: [contributors.id],
    }),
    pipelineItem: one(pipelineItems, {
      fields: [contributorPublications.pipelineItemId],
      references: [pipelineItems.id],
    }),
  }),
);

// --- rights_agreements ---

export const rightsAgreementsRelations = relations(
  rightsAgreements,
  ({ one }) => ({
    organization: one(organizations, {
      fields: [rightsAgreements.organizationId],
      references: [organizations.id],
    }),
    contributor: one(contributors, {
      fields: [rightsAgreements.contributorId],
      references: [contributors.id],
    }),
    pipelineItem: one(pipelineItems, {
      fields: [rightsAgreements.pipelineItemId],
      references: [pipelineItems.id],
    }),
  }),
);

// --- payment_transactions ---

export const paymentTransactionsRelations = relations(
  paymentTransactions,
  ({ one }) => ({
    organization: one(organizations, {
      fields: [paymentTransactions.organizationId],
      references: [organizations.id],
    }),
    contributor: one(contributors, {
      fields: [paymentTransactions.contributorId],
      references: [contributors.id],
    }),
    submission: one(submissions, {
      fields: [paymentTransactions.submissionId],
      references: [submissions.id],
    }),
    payment: one(payments, {
      fields: [paymentTransactions.paymentId],
      references: [payments.id],
    }),
  }),
);

// --- contest_groups ---

export const contestGroupsRelations = relations(
  contestGroups,
  ({ one, many }) => ({
    organization: one(organizations, {
      fields: [contestGroups.organizationId],
      references: [organizations.id],
    }),
    rounds: many(submissionPeriods),
  }),
);

// --- contest_judges ---

export const contestJudgesRelations = relations(contestJudges, ({ one }) => ({
  organization: one(organizations, {
    fields: [contestJudges.organizationId],
    references: [organizations.id],
  }),
  submissionPeriod: one(submissionPeriods, {
    fields: [contestJudges.submissionPeriodId],
    references: [submissionPeriods.id],
  }),
  user: one(users, {
    fields: [contestJudges.userId],
    references: [users.id],
    relationName: "contestJudge",
  }),
  assignedByUser: one(users, {
    fields: [contestJudges.assignedBy],
    references: [users.id],
    relationName: "contestJudgeAssigner",
  }),
}));

// --- contest_results ---

export const contestResultsRelations = relations(contestResults, ({ one }) => ({
  organization: one(organizations, {
    fields: [contestResults.organizationId],
    references: [organizations.id],
  }),
  submissionPeriod: one(submissionPeriods, {
    fields: [contestResults.submissionPeriodId],
    references: [submissionPeriods.id],
  }),
  submission: one(submissions, {
    fields: [contestResults.submissionId],
    references: [submissions.id],
  }),
  disbursement: one(paymentTransactions, {
    fields: [contestResults.disbursementId],
    references: [paymentTransactions.id],
  }),
}));
