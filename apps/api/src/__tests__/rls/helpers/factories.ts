import { faker } from '@faker-js/faker';
import { drizzle } from 'drizzle-orm/node-postgres';
import { getAdminPool, type DrizzleDb } from './db-setup';
import {
  organizations,
  users,
  organizationMembers,
  submissionPeriods,
  submissions,
  submissionFiles,
  submissionHistory,
  payments,
  auditEvents,
  retentionPolicies,
  userConsents,
  type Organization,
  type User,
  type OrganizationMember,
  type SubmissionPeriod,
  type Submission,
  type SubmissionFile,
  type SubmissionHistoryEntry,
  type Payment,
  type AuditEvent,
  type RetentionPolicy,
  type UserConsent,
} from '@colophony/db';

function adminDb(): DrizzleDb {
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
      role: 'ADMIN',
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

export async function createSubmissionFile(
  submissionId: string,
  overrides?: Partial<SubmissionFile>,
): Promise<SubmissionFile> {
  const db = adminDb();
  const [file] = await db
    .insert(submissionFiles)
    .values({
      submissionId,
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
  fileA: SubmissionFile;
  fileB: SubmissionFile;
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

  const [fileA, fileB] = await Promise.all([
    createSubmissionFile(submissionA.id),
    createSubmissionFile(submissionB.id),
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
