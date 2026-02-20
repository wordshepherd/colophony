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
    fields: (t) => ({
      submission: t.field({
        type: SubmissionType,
        resolve: (r) => r.submission,
      }),
      historyEntry: t.field({
        type: SubmissionHistoryType,
        resolve: (r) => r.historyEntry,
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
    fields: (t) => ({
      organization: t.field({
        type: OrganizationType,
        resolve: (r) => r.organization,
      }),
      membership: t.field({
        type: OrganizationMemberType,
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
    fields: (t) => ({
      id: t.exposeString('id'),
      name: t.exposeString('name'),
      scopes: t.expose('scopes', { type: 'JSON' }),
      keyPrefix: t.exposeString('keyPrefix'),
      plainTextKey: t.exposeString('plainTextKey'),
      createdAt: t.expose('createdAt', { type: 'DateTime' }),
      expiresAt: t.expose('expiresAt', { type: 'DateTime', nullable: true }),
      lastUsedAt: t.expose('lastUsedAt', {
        type: 'DateTime',
        nullable: true,
      }),
      revokedAt: t.expose('revokedAt', { type: 'DateTime', nullable: true }),
    }),
  });

export const RevokeApiKeyPayload = builder
  .objectRef<{
    id: string;
    name: string;
    revokedAt: Date | null;
  }>('RevokeApiKeyPayload')
  .implement({
    fields: (t) => ({
      id: t.exposeString('id'),
      name: t.exposeString('name'),
      revokedAt: t.expose('revokedAt', { type: 'DateTime', nullable: true }),
    }),
  });

// ---------------------------------------------------------------------------
// Generic payloads
// ---------------------------------------------------------------------------

export const SuccessPayload = builder
  .objectRef<{ success: boolean }>('SuccessPayload')
  .implement({
    fields: (t) => ({
      success: t.exposeBoolean('success'),
    }),
  });
