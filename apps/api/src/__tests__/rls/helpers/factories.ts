import { faker } from '@faker-js/faker';
import { drizzle } from 'drizzle-orm/node-postgres';
import { getAdminPool } from './db-setup';
import {
  organizations,
  users,
  organizationMembers,
  submissionPeriods,
  submissions,
  manuscripts,
  manuscriptVersions,
  files,
  submissionHistory,
  payments,
  auditEvents,
  retentionPolicies,
  userConsents,
  journalDirectory,
  externalSubmissions,
  correspondence,
  writerProfiles,
  submissionDiscussions,
  submissionVotes,
  submissionReviewers,
  pipelineItems,
  publications,
  issues,
  issueSections,
  issueItems,
  cmsConnections,
  type PipelineItem,
  type Publication,
  type Issue,
  type IssueSection,
  type IssueItem,
  type Organization,
  type User,
  type OrganizationMember,
  type SubmissionPeriod,
  type Submission,
  type Manuscript,
  type ManuscriptVersion,
  type File,
  type SubmissionHistoryEntry,
  type Payment,
  type AuditEvent,
  type RetentionPolicy,
  type UserConsent,
  type JournalDirectoryEntry,
  type ExternalSubmission,
  type CorrespondenceRecord,
  type WriterProfile,
} from '@colophony/db';

// (different optional peer dep contexts); runtime is single copy, types diverge. Cast to unify.
function adminDb(): any {
  return drizzle(getAdminPool());
}

export async function createOrganization(
  overrides?: Partial<Organization>,
): Promise<Organization> {
  const db = adminDb();
  const [org] = await db
    .insert(organizations)
    .values({
      name: faker.company.name(),
      slug: faker.string.alphanumeric(20).toLowerCase(),
      ...overrides,
    })
    .returning();
  return org;
}

export async function createUser(overrides?: Partial<User>): Promise<User> {
  const db = adminDb();
  const [user] = await db
    .insert(users)
    .values({
      email: `${faker.string.alphanumeric(10)}_${Date.now()}@${faker.internet.domainName()}`,
      ...overrides,
    })
    .returning();
  return user;
}

export async function createOrgMember(
  organizationId: string,
  userId: string,
  overrides?: Partial<OrganizationMember>,
): Promise<OrganizationMember> {
  const db = adminDb();
  const [member] = await db
    .insert(organizationMembers)
    .values({
      organizationId,
      userId,
      roles: ['ADMIN'],
      ...overrides,
    })
    .returning();
  return member;
}

export async function createSubmissionPeriod(
  organizationId: string,
  overrides?: Partial<SubmissionPeriod>,
): Promise<SubmissionPeriod> {
  const db = adminDb();
  const now = new Date();
  const [period] = await db
    .insert(submissionPeriods)
    .values({
      organizationId,
      name: faker.lorem.words(3),
      opensAt: now,
      closesAt: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
      ...overrides,
    })
    .returning();
  return period;
}

export async function createSubmission(
  organizationId: string,
  submitterId: string,
  overrides?: Partial<Submission>,
): Promise<Submission> {
  const db = adminDb();
  const [submission] = await db
    .insert(submissions)
    .values({
      organizationId,
      submitterId,
      title: faker.lorem.sentence(),
      content: faker.lorem.paragraphs(2),
      status: 'DRAFT',
      ...overrides,
    })
    .returning();
  return submission;
}

export async function createManuscript(
  ownerId: string,
  overrides?: Partial<Manuscript>,
): Promise<Manuscript> {
  const db = adminDb();
  const [manuscript] = await db
    .insert(manuscripts)
    .values({
      ownerId,
      title: faker.lorem.sentence(),
      ...overrides,
    })
    .returning();
  return manuscript;
}

export async function createManuscriptVersion(
  manuscriptId: string,
  overrides?: Partial<ManuscriptVersion>,
): Promise<ManuscriptVersion> {
  const db = adminDb();
  const [version] = await db
    .insert(manuscriptVersions)
    .values({
      manuscriptId,
      versionNumber: 1,
      ...overrides,
    })
    .returning();
  return version;
}

export async function createFile(
  manuscriptVersionId: string,
  overrides?: Partial<File>,
): Promise<File> {
  const db = adminDb();
  const [file] = await db
    .insert(files)
    .values({
      manuscriptVersionId,
      filename: faker.system.fileName(),
      mimeType: faker.system.mimeType(),
      size: faker.number.int({ min: 1000, max: 10000000 }),
      storageKey: `uploads/${faker.string.uuid()}/${faker.system.fileName()}`,
      ...overrides,
    })
    .returning();
  return file;
}

export async function createSubmissionHistory(
  submissionId: string,
  overrides?: Partial<SubmissionHistoryEntry>,
): Promise<SubmissionHistoryEntry> {
  const db = adminDb();
  const [history] = await db
    .insert(submissionHistory)
    .values({
      submissionId,
      toStatus: 'SUBMITTED',
      ...overrides,
    })
    .returning();
  return history;
}

export async function createPayment(
  organizationId: string,
  overrides?: Partial<Payment>,
): Promise<Payment> {
  const db = adminDb();
  const [payment] = await db
    .insert(payments)
    .values({
      organizationId,
      amount: faker.number.int({ min: 500, max: 10000 }),
      currency: 'usd',
      stripePaymentId: `pi_${faker.string.alphanumeric(24)}`,
      stripeSessionId: `cs_${faker.string.alphanumeric(24)}`,
      ...overrides,
    })
    .returning();
  return payment;
}

export async function createAuditEvent(
  overrides?: Partial<AuditEvent>,
): Promise<AuditEvent> {
  const db = adminDb();
  const [event] = await db
    .insert(auditEvents)
    .values({
      action: faker.helpers.arrayElement(['CREATE', 'UPDATE', 'DELETE']),
      resource: `${faker.string.alpha(10)}_${Date.now()}`,
      ...overrides,
    })
    .returning();
  return event;
}

export async function createRetentionPolicy(
  overrides?: Partial<RetentionPolicy>,
): Promise<RetentionPolicy> {
  const db = adminDb();
  const [policy] = await db
    .insert(retentionPolicies)
    .values({
      resource: `${faker.string.alpha(10)}_${Date.now()}_${faker.string.alphanumeric(5)}`,
      retentionDays: faker.number.int({ min: 30, max: 365 }),
      ...overrides,
    })
    .returning();
  return policy;
}

export async function createUserConsent(
  userId: string,
  overrides?: Partial<UserConsent>,
): Promise<UserConsent> {
  const db = adminDb();
  const [consent] = await db
    .insert(userConsents)
    .values({
      userId,
      consentType: `consent_${faker.string.alpha(10)}_${Date.now()}`,
      granted: true,
      ...overrides,
    })
    .returning();
  return consent;
}

export async function createJournalDirectoryEntry(
  overrides?: Partial<JournalDirectoryEntry>,
): Promise<JournalDirectoryEntry> {
  const db = adminDb();
  const name = overrides?.name ?? faker.company.name();
  const [entry] = await db
    .insert(journalDirectory)
    .values({
      name,
      normalizedName:
        overrides?.normalizedName ??
        name.toLowerCase().replace(/[^a-z0-9]+/g, '_'),
      ...overrides,
    })
    .returning();
  return entry;
}

export async function createExternalSubmission(
  userId: string,
  overrides?: Partial<ExternalSubmission>,
): Promise<ExternalSubmission> {
  const db = adminDb();
  const [extSub] = await db
    .insert(externalSubmissions)
    .values({
      userId,
      journalName: faker.company.name(),
      status: 'sent',
      ...overrides,
    })
    .returning();
  return extSub;
}

export async function createCorrespondence(
  userId: string,
  overrides?: Partial<CorrespondenceRecord>,
): Promise<CorrespondenceRecord> {
  const db = adminDb();
  const [corr] = await db
    .insert(correspondence)
    .values({
      userId,
      direction: 'inbound',
      channel: 'email',
      sentAt: new Date(),
      body: faker.lorem.paragraph(),
      source: 'manual',
      ...overrides,
    })
    .returning();
  return corr;
}

export async function createWriterProfile(
  userId: string,
  overrides?: Partial<WriterProfile>,
): Promise<WriterProfile> {
  const db = adminDb();
  const [profile] = await db
    .insert(writerProfiles)
    .values({
      userId,
      platform:
        overrides?.platform ??
        faker.helpers.arrayElement([
          'submittable',
          'duotrope',
          'chillsubs',
          'moksha',
        ]),
      ...overrides,
    })
    .returning();
  return profile;
}

// ---------------------------------------------------------------------------
// Submission-child fixtures.
//
// `createTwoOrgScenario` deliberately does not seed these — they are only
// needed by suites that exercise the per-submission list methods. Without
// them those suites assert "no org B rows" against an empty table, which is
// true for the wrong reason. Seed explicitly and assert a non-zero org A
// count first.
// ---------------------------------------------------------------------------

export type SubmissionDiscussionRow = typeof submissionDiscussions.$inferSelect;
export type SubmissionVoteRow = typeof submissionVotes.$inferSelect;
export type SubmissionReviewerRow = typeof submissionReviewers.$inferSelect;

export async function createSubmissionDiscussion(
  organizationId: string,
  submissionId: string,
  authorId: string,
  overrides?: Partial<SubmissionDiscussionRow>,
): Promise<SubmissionDiscussionRow> {
  const db = adminDb();
  const [discussion] = await db
    .insert(submissionDiscussions)
    .values({
      organizationId,
      submissionId,
      authorId,
      content: faker.lorem.paragraph(),
      ...overrides,
    })
    .returning();
  return discussion;
}

export async function createSubmissionVote(
  organizationId: string,
  submissionId: string,
  voterUserId: string,
  overrides?: Partial<SubmissionVoteRow>,
): Promise<SubmissionVoteRow> {
  const db = adminDb();
  const [vote] = await db
    .insert(submissionVotes)
    .values({
      organizationId,
      submissionId,
      voterUserId,
      decision: 'ACCEPT',
      ...overrides,
    })
    .returning();
  return vote;
}

export async function createSubmissionReviewer(
  organizationId: string,
  submissionId: string,
  reviewerUserId: string,
  overrides?: Partial<SubmissionReviewerRow>,
): Promise<SubmissionReviewerRow> {
  const db = adminDb();
  const [reviewer] = await db
    .insert(submissionReviewers)
    .values({
      organizationId,
      submissionId,
      reviewerUserId,
      ...overrides,
    })
    .returning();
  return reviewer;
}

/**
 * `organizationId` and `submissionId` are deliberately independent positional
 * params rather than the org being derived from the submission. Scoping
 * `pipelineService.create` is exactly a fix for mismatched pairs, so the suite
 * that proves it has to be able to seed one.
 *
 * Note `pipeline_items_submission_id_idx` is a GLOBAL unique index on
 * `submission_id` — one item per submission across every org, ever — so a suite
 * seeding these wants one submission per intended item.
 *
 * No `createPipelineHistory` / `createPipelineComment` alongside it: both tables
 * cascade from `pipeline_items` and no case reads them through a factory. Same
 * rule as the `createPortfolioEntry` note below.
 */
export async function createPipelineItem(
  organizationId: string,
  submissionId: string,
  overrides?: Partial<PipelineItem>,
): Promise<PipelineItem> {
  const db = adminDb();
  const [item] = await db
    .insert(pipelineItems)
    .values({
      organizationId,
      submissionId,
      ...overrides,
    })
    .returning();
  return item;
}

/**
 * `publications_org_slug_idx` is unique on `(organization_id, lower(slug))`, so
 * the slug is randomised rather than derived from the name — two publications in
 * one org is an ordinary fixture, and a name-derived slug would collide.
 */
export async function createPublication(
  organizationId: string,
  overrides?: Partial<Publication>,
): Promise<Publication> {
  const db = adminDb();
  const [publication] = await db
    .insert(publications)
    .values({
      organizationId,
      name: faker.company.name(),
      slug: faker.string.alphanumeric(20).toLowerCase(),
      ...overrides,
    })
    .returning();
  return publication;
}

/**
 * Like `createPipelineItem`, `organizationId` and `publicationId` are
 * independent positional params rather than the org being derived from the
 * publication — a suite proving `issueService` scopes its reads needs to be able
 * to seed a mismatched pair.
 */
export async function createIssue(
  organizationId: string,
  publicationId: string,
  overrides?: Partial<Issue>,
): Promise<Issue> {
  const db = adminDb();
  const [issue] = await db
    .insert(issues)
    .values({
      organizationId,
      publicationId,
      title: faker.lorem.words(3),
      ...overrides,
    })
    .returning();
  return issue;
}

/**
 * `issue_sections` carries no `organization_id` — it is scoped transitively
 * through its issue, and its RLS policy is an EXISTS on `issues`. So the org a
 * section belongs to is whatever `createIssue` was given; there is no second
 * parameter to get wrong.
 */
export async function createIssueSection(
  issueId: string,
  overrides?: Partial<IssueSection>,
): Promise<IssueSection> {
  const db = adminDb();
  const [section] = await db
    .insert(issueSections)
    .values({
      issueId,
      title: faker.lorem.words(2),
      ...overrides,
    })
    .returning();
  return section;
}

/**
 * Same transitive scoping as `createIssueSection`. Two unique constraints bound
 * how many of these a suite can seed: `issue_items_issue_pipeline_unique` on
 * `(issue_id, pipeline_item_id)`, and — reaching back up the chain — the GLOBAL
 * unique on `pipeline_items.submission_id`. So N issue items needs N pipeline
 * items needs N distinct submissions.
 */
export async function createIssueItem(
  issueId: string,
  pipelineItemId: string,
  overrides?: Partial<IssueItem>,
): Promise<IssueItem> {
  const db = adminDb();
  const [item] = await db
    .insert(issueItems)
    .values({
      issueId,
      pipelineItemId,
      ...overrides,
    })
    .returning();
  return item;
}

/**
 * `@colophony/db` exports no `CmsConnection` type, so the row type is inferred
 * here — the same workaround as `SubmissionDiscussionRow` above.
 *
 * `publication_id` is nullable and therefore an override rather than a
 * positional param; only the `listByPublication` cases need it set.
 */
export type CmsConnectionRow = typeof cmsConnections.$inferSelect;

export async function createCmsConnection(
  organizationId: string,
  overrides?: Partial<CmsConnectionRow>,
): Promise<CmsConnectionRow> {
  const db = adminDb();
  const [connection] = await db
    .insert(cmsConnections)
    .values({
      organizationId,
      adapterType: 'GHOST',
      name: faker.company.name(),
      config: { apiUrl: faker.internet.url(), apiKey: faker.string.uuid() },
      ...overrides,
    })
    .returning();
  return connection;
}

// No `createPortfolioEntry` here on purpose: `portfolioService.list` reads
// `submissions` and `external_submissions`, never `portfolio_entries`, so a
// fixture for that table would seed rows no assertion observes. Add one when a
// suite actually exercises `portfolio_entries_user_owner`.

export interface TwoOrgScenario {
  orgA: Organization;
  orgB: Organization;
  userA: User;
  userB: User;
  memberA: OrganizationMember;
  memberB: OrganizationMember;
  periodA: SubmissionPeriod;
  periodB: SubmissionPeriod;
  submissionA: Submission;
  submissionB: Submission;
  manuscriptA: Manuscript;
  manuscriptB: Manuscript;
  manuscriptVersionA: ManuscriptVersion;
  manuscriptVersionB: ManuscriptVersion;
  fileA: File;
  fileB: File;
  historyA: SubmissionHistoryEntry;
  historyB: SubmissionHistoryEntry;
  paymentA: Payment;
  paymentB: Payment;
  auditEventA: AuditEvent;
  auditEventB: AuditEvent;
  auditEventGlobal: AuditEvent;
  retentionPolicyA: RetentionPolicy;
  retentionPolicyB: RetentionPolicy;
  retentionPolicyGlobal: RetentionPolicy;
  userConsentA: UserConsent;
  userConsentB: UserConsent;
  userConsentGlobal: UserConsent;
}

export async function createTwoOrgScenario(): Promise<TwoOrgScenario> {
  const [orgA, orgB] = await Promise.all([
    createOrganization(),
    createOrganization(),
  ]);
  const [userA, userB] = await Promise.all([createUser(), createUser()]);

  const [memberA, memberB] = await Promise.all([
    createOrgMember(orgA.id, userA.id),
    createOrgMember(orgB.id, userB.id),
  ]);

  const [periodA, periodB] = await Promise.all([
    createSubmissionPeriod(orgA.id),
    createSubmissionPeriod(orgB.id),
  ]);

  const [submissionA, submissionB] = await Promise.all([
    createSubmission(orgA.id, userA.id, { submissionPeriodId: periodA.id }),
    createSubmission(orgB.id, userB.id, { submissionPeriodId: periodB.id }),
  ]);

  const [manuscriptA, manuscriptB] = await Promise.all([
    createManuscript(userA.id),
    createManuscript(userB.id),
  ]);

  const [manuscriptVersionA, manuscriptVersionB] = await Promise.all([
    createManuscriptVersion(manuscriptA.id),
    createManuscriptVersion(manuscriptB.id),
  ]);

  const [fileA, fileB] = await Promise.all([
    createFile(manuscriptVersionA.id),
    createFile(manuscriptVersionB.id),
  ]);

  const [historyA, historyB] = await Promise.all([
    createSubmissionHistory(submissionA.id),
    createSubmissionHistory(submissionB.id),
  ]);

  const [paymentA, paymentB] = await Promise.all([
    createPayment(orgA.id, { submissionId: submissionA.id }),
    createPayment(orgB.id, { submissionId: submissionB.id }),
  ]);

  const [auditEventA, auditEventB, auditEventGlobal] = await Promise.all([
    createAuditEvent({ organizationId: orgA.id, actorId: userA.id }),
    createAuditEvent({ organizationId: orgB.id, actorId: userB.id }),
    createAuditEvent({ organizationId: null, actorId: null }),
  ]);

  const [retentionPolicyA, retentionPolicyB, retentionPolicyGlobal] =
    await Promise.all([
      createRetentionPolicy({ organizationId: orgA.id }),
      createRetentionPolicy({ organizationId: orgB.id }),
      createRetentionPolicy({ organizationId: null }),
    ]);

  const [userConsentA, userConsentB, userConsentGlobal] = await Promise.all([
    createUserConsent(userA.id, { organizationId: orgA.id }),
    createUserConsent(userB.id, { organizationId: orgB.id }),
    createUserConsent(userA.id, { organizationId: null }),
  ]);

  return {
    orgA,
    orgB,
    userA,
    userB,
    memberA,
    memberB,
    periodA,
    periodB,
    submissionA,
    submissionB,
    manuscriptA,
    manuscriptB,
    manuscriptVersionA,
    manuscriptVersionB,
    fileA,
    fileB,
    historyA,
    historyB,
    paymentA,
    paymentB,
    auditEventA,
    auditEventB,
    auditEventGlobal,
    retentionPolicyA,
    retentionPolicyB,
    retentionPolicyGlobal,
    userConsentA,
    userConsentB,
    userConsentGlobal,
  };
}
