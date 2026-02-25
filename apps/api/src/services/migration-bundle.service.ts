import crypto from 'node:crypto';
import * as jose from 'jose';
import {
  db,
  submissions,
  files,
  manuscriptVersions,
  organizations,
  eq,
  and,
  inArray,
} from '@colophony/db';
import type {
  MigrationBundle,
  MigrationSubmissionHistory,
  MigrationActiveSubmission,
  TransferFileManifestEntry,
} from '@colophony/types';
import type { Env } from '../config/env.js';
import { federationService } from './federation.service.js';

// ---------------------------------------------------------------------------
// Error classes
// ---------------------------------------------------------------------------

export class MigrationBundleError extends Error {
  override name = 'MigrationBundleError' as const;
  constructor(message: string) {
    super(message);
  }
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Statuses that indicate a closed/decided submission (metadata only). */
const CLOSED_STATUSES = ['REJECTED', 'WITHDRAWN', 'ACCEPTED'] as const;

/** Statuses that indicate an active/in-progress submission (full data + files). */
const ACTIVE_STATUSES = ['DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'HOLD'] as const;

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export const migrationBundleService = {
  /**
   * Assemble a migration bundle for a user across all their submissions.
   *
   * Superuser `db` — justified: migration is a user-level operation that spans
   * all orgs. User owns their data cross-org (same justification as GDPR
   * deletion which also crosses org boundaries).
   */
  async assembleBundleForUser(
    env: Env,
    params: {
      userId: string;
      userEmail: string;
      userDid: string;
      destinationDomain: string;
      destinationUserDid: string | null;
      migrationId: string;
    },
  ): Promise<MigrationBundle> {
    const domain = env.FEDERATION_DOMAIN ?? 'localhost';

    // Query all submissions owned by this user across all orgs (superuser)
    const allSubmissions = await db
      .select({
        id: submissions.id,
        title: submissions.title,
        coverLetter: submissions.coverLetter,
        content: submissions.content,
        status: submissions.status,
        formData: submissions.formData,
        submittedAt: submissions.submittedAt,
        organizationId: submissions.organizationId,
        manuscriptVersionId: submissions.manuscriptVersionId,
      })
      .from(submissions)
      .where(eq(submissions.submitterId, params.userId));

    // Enrich with org/period names
    const orgIds = [...new Set(allSubmissions.map((s) => s.organizationId))];
    const orgMap = new Map<string, string>();
    if (orgIds.length > 0) {
      const orgs = await db
        .select({ id: organizations.id, name: organizations.name })
        .from(organizations)
        .where(inArray(organizations.id, orgIds));
      for (const org of orgs) {
        orgMap.set(org.id, org.name);
      }
    }

    // Build closed submissions (metadata only)
    const submissionHistory: MigrationSubmissionHistory[] = [];
    const activeSubmissions: MigrationActiveSubmission[] = [];
    const allFileIds: string[] = [];

    for (const sub of allSubmissions) {
      const pubName = orgMap.get(sub.organizationId) ?? null;

      if ((CLOSED_STATUSES as readonly string[]).includes(sub.status)) {
        submissionHistory.push({
          originSubmissionId: sub.id,
          title: sub.title,
          genre: null,
          coverLetter: sub.coverLetter,
          status: sub.status,
          formData: sub.formData ?? null,
          submittedAt: sub.submittedAt?.toISOString() ?? null,
          decidedAt: null,
          publicationName: pubName,
          periodName: null,
        });
      } else if ((ACTIVE_STATUSES as readonly string[]).includes(sub.status)) {
        // Get file manifest for active submissions
        let fileManifest: TransferFileManifestEntry[] = [];
        let contentFingerprint: string | null = null;

        if (sub.manuscriptVersionId) {
          // CLEAN files only (same filter as transfer.service.ts)
          const fileRows = await db
            .select({
              id: files.id,
              filename: files.filename,
              mimeType: files.mimeType,
              size: files.size,
            })
            .from(files)
            .where(
              and(
                eq(files.manuscriptVersionId, sub.manuscriptVersionId),
                eq(files.scanStatus, 'CLEAN'),
              ),
            );

          fileManifest = fileRows.map((f) => ({
            fileId: f.id,
            filename: f.filename,
            mimeType: f.mimeType,
            size: Number(f.size),
          }));

          allFileIds.push(...fileManifest.map((f) => f.fileId));

          // Content fingerprint from manuscript version
          const [version] = await db
            .select({
              contentFingerprint: manuscriptVersions.contentFingerprint,
            })
            .from(manuscriptVersions)
            .where(eq(manuscriptVersions.id, sub.manuscriptVersionId))
            .limit(1);

          contentFingerprint = version?.contentFingerprint ?? null;
        }

        activeSubmissions.push({
          originSubmissionId: sub.id,
          title: sub.title,
          genre: null,
          coverLetter: sub.coverLetter,
          content: sub.content ?? null,
          status: sub.status,
          formData: sub.formData ?? null,
          submittedAt: sub.submittedAt?.toISOString() ?? null,
          decidedAt: null,
          publicationName: pubName,
          periodName: null,
          fileManifest,
          contentFingerprint,
        });
      }
    }

    // Sign the bundle token
    const { token } = await this.signBundleToken(env, {
      migrationId: params.migrationId,
      userId: params.userId,
      fileIds: allFileIds,
      destinationDomain: params.destinationDomain,
    });

    return {
      protocolVersion: '1.0',
      originDomain: domain,
      userDid: params.userDid,
      destinationDomain: params.destinationDomain,
      destinationUserDid: params.destinationUserDid,
      identity: {
        email: params.userEmail,
        alsoKnownAs: [],
      },
      submissionHistory,
      activeSubmissions,
      bundleToken: token,
      createdAt: new Date().toISOString(),
    };
  },

  /**
   * Sign a JWT for file proxy during migration.
   * Same pattern as transfer.service.ts JWT signing.
   */
  async signBundleToken(
    env: Env,
    params: {
      migrationId: string;
      userId: string;
      fileIds: string[];
      destinationDomain: string;
    },
  ): Promise<{ token: string; expiresAt: Date }> {
    const config = await federationService.getOrInitConfig(env);
    const domain = env.FEDERATION_DOMAIN ?? 'localhost';
    const expiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000); // 72h

    const privateKeyObj = crypto.createPrivateKey(config.privateKey);
    const token = await new jose.SignJWT({
      migrationId: params.migrationId,
      userId: params.userId,
      fileIds: params.fileIds,
    })
      .setProtectedHeader({ alg: 'EdDSA' })
      .setIssuer(domain)
      .setSubject(params.userId)
      .setAudience(params.destinationDomain)
      .setExpirationTime(expiresAt)
      .setJti(params.migrationId)
      .sign(privateKeyObj);

    return { token, expiresAt };
  },
};
