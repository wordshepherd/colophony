import type {
  Submission,
  SubmissionHistoryEntry,
  Organization,
  OrganizationMember,
} from '@colophony/db';
import { builder } from '../builder.js';
import { SubmissionType, SubmissionHistoryType } from './submission.js';
import { OrganizationType, OrganizationMemberType } from './organization.js';

// ---------------------------------------------------------------------------
// Submission mutation payloads
// ---------------------------------------------------------------------------

export const SubmissionStatusChangePayload = builder
  .objectRef<{
    submission: Submission;
    historyEntry: SubmissionHistoryEntry;
  }>('SubmissionStatusChangePayload')
  .implement({
    description: 'Result of a submission status transition.',
    fields: (t) => ({
      submission: t.field({
        type: SubmissionType,
        description: 'The submission after the status change.',
        resolve: (r) => r.submission,
      }),
      historyEntry: t.field({
        type: SubmissionHistoryType,
        description: 'The history entry recording this transition.',
        resolve: (r) => r.historyEntry,
      }),
    }),
  });

// ---------------------------------------------------------------------------
// Batch operation payloads
// ---------------------------------------------------------------------------

export const BatchStatusChangeSuccessItem = builder
  .objectRef<{
    submissionId: string;
    previousStatus: string;
    status: string;
  }>('BatchStatusChangeSuccessItem')
  .implement({
    description: 'A single successful status change in a batch operation.',
    fields: (t) => ({
      submissionId: t.exposeString('submissionId', {
        description: 'Submission that was updated.',
      }),
      previousStatus: t.exposeString('previousStatus', {
        description: 'Status before the change.',
      }),
      status: t.exposeString('status', {
        description: 'New status after the change.',
      }),
    }),
  });

export const BatchFailureItem = builder
  .objectRef<{
    submissionId: string;
    error: string;
  }>('BatchFailureItem')
  .implement({
    description: 'A single failure in a batch operation.',
    fields: (t) => ({
      submissionId: t.exposeString('submissionId', {
        description: 'Submission that failed.',
      }),
      error: t.exposeString('error', {
        description: 'Error message explaining the failure.',
      }),
    }),
  });

export const BatchStatusChangePayload = builder
  .objectRef<{
    succeeded: Array<{
      submissionId: string;
      previousStatus: string;
      status: string;
    }>;
    failed: Array<{ submissionId: string; error: string }>;
  }>('BatchStatusChangePayload')
  .implement({
    description: 'Result of a batch status change operation.',
    fields: (t) => ({
      succeeded: t.field({
        type: [BatchStatusChangeSuccessItem],
        description: 'Submissions that were successfully updated.',
        resolve: (r) => r.succeeded,
      }),
      failed: t.field({
        type: [BatchFailureItem],
        description: 'Submissions that failed to update.',
        resolve: (r) => r.failed,
      }),
    }),
  });

export const BatchAssignReviewersSuccessItem = builder
  .objectRef<{
    submissionId: string;
    assignedCount: number;
  }>('BatchAssignReviewersSuccessItem')
  .implement({
    description:
      'A single successful reviewer assignment in a batch operation.',
    fields: (t) => ({
      submissionId: t.exposeString('submissionId', {
        description: 'Submission that was updated.',
      }),
      assignedCount: t.exposeInt('assignedCount', {
        description: 'Number of reviewers assigned.',
      }),
    }),
  });

export const BatchAssignReviewersPayload = builder
  .objectRef<{
    succeeded: Array<{ submissionId: string; assignedCount: number }>;
    failed: Array<{ submissionId: string; error: string }>;
  }>('BatchAssignReviewersPayload')
  .implement({
    description: 'Result of a batch reviewer assignment operation.',
    fields: (t) => ({
      succeeded: t.field({
        type: [BatchAssignReviewersSuccessItem],
        description: 'Submissions that were successfully assigned.',
        resolve: (r) => r.succeeded,
      }),
      failed: t.field({
        type: [BatchFailureItem],
        description: 'Submissions that failed to assign.',
        resolve: (r) => r.failed,
      }),
    }),
  });

// ---------------------------------------------------------------------------
// Organization mutation payloads
// ---------------------------------------------------------------------------

export const CreateOrganizationPayload = builder
  .objectRef<{
    organization: Organization;
    membership: OrganizationMember;
  }>('CreateOrganizationPayload')
  .implement({
    description: 'Result of creating a new organization.',
    fields: (t) => ({
      organization: t.field({
        type: OrganizationType,
        description: 'The newly created organization.',
        resolve: (r) => r.organization,
      }),
      membership: t.field({
        type: OrganizationMemberType,
        description: "The creator's membership record.",
        resolve: (r) => r.membership,
      }),
    }),
  });

// ---------------------------------------------------------------------------
// API key mutation payloads
// ---------------------------------------------------------------------------

export const CreateApiKeyPayload = builder
  .objectRef<{
    id: string;
    name: string;
    scopes: unknown;
    keyPrefix: string;
    plainTextKey: string;
    createdAt: Date;
    expiresAt: Date | null;
    lastUsedAt: Date | null;
    revokedAt: Date | null;
  }>('CreateApiKeyPayload')
  .implement({
    description:
      'Result of creating a new API key. The plain-text key is shown only once.',
    fields: (t) => ({
      id: t.exposeString('id', { description: 'Unique identifier.' }),
      name: t.exposeString('name', { description: 'Human-readable name.' }),
      scopes: t.expose('scopes', {
        type: 'JSON',
        description: 'Granted permission scopes.',
      }),
      keyPrefix: t.exposeString('keyPrefix', {
        description: 'First characters for identification.',
      }),
      plainTextKey: t.exposeString('plainTextKey', {
        description: 'The full API key — shown only once, never stored.',
      }),
      createdAt: t.expose('createdAt', {
        type: 'DateTime',
        description: 'When the key was created.',
      }),
      expiresAt: t.expose('expiresAt', {
        type: 'DateTime',
        nullable: true,
        description: 'When the key expires.',
      }),
      lastUsedAt: t.expose('lastUsedAt', {
        type: 'DateTime',
        nullable: true,
        description: 'When the key was last used.',
      }),
      revokedAt: t.expose('revokedAt', {
        type: 'DateTime',
        nullable: true,
        description: 'When the key was revoked.',
      }),
    }),
  });

export const RevokeApiKeyPayload = builder
  .objectRef<{
    id: string;
    name: string;
    revokedAt: Date | null;
  }>('RevokeApiKeyPayload')
  .implement({
    description: 'Result of revoking an API key.',
    fields: (t) => ({
      id: t.exposeString('id', { description: 'API key ID.' }),
      name: t.exposeString('name', { description: 'Human-readable name.' }),
      revokedAt: t.expose('revokedAt', {
        type: 'DateTime',
        nullable: true,
        description: 'When the key was revoked.',
      }),
    }),
  });

// ---------------------------------------------------------------------------
// Generic payloads
// ---------------------------------------------------------------------------

export const SuccessPayload = builder
  .objectRef<{ success: boolean }>('SuccessPayload')
  .implement({
    description:
      "Generic success response for mutations that don't return a resource.",
    fields: (t) => ({
      success: t.exposeBoolean('success', {
        description: 'Always true on success.',
      }),
    }),
  });
