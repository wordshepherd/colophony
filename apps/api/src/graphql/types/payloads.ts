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
