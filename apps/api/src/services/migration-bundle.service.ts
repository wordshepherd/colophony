import crypto from 'node:crypto';
import * as jose from 'jose';
import {
  db,
  submissions,
  files,
  manuscriptVersions,
  manuscripts,
  organizations,
  submissionPeriods,
  submissionHistory,
  eq,
  and,
  inArray,
} from '@colophony/db';
import type {
  MigrationBundle,
  MigrationSubmissionHistory,
  MigrationActiveSubmission,
  MigrationStatusHistoryEntry,
  TransferFileManifestEntry,
} from '@colophony/types';
import { genreSchema, hopperToCsrStatus } from '@colophony/types';
import type { Genre } from '@colophony/types';
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

/** Safety cap on submissions per migration bundle to prevent OOM. */
const MAX_SUBMISSIONS = 10_000;

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
        submissionPeriodId: submissions.submissionPeriodId,
      })
      .from(submissions)
      .limit(MAX_SUBMISSIONS)
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

    // Batch-fetch submission periods
    const periodIds = [
      ...new Set(
        allSubmissions
          .map((s) => s.submissionPeriodId)
          .filter((id): id is string => id != null),
      ),
    ];
    const periodMap = new Map<string, string>();
    if (periodIds.length > 0) {
      const periods = await db
        .select({ id: submissionPeriods.id, name: submissionPeriods.name })
        .from(submissionPeriods)
        .where(inArray(submissionPeriods.id, periodIds));
      for (const p of periods) {
        periodMap.set(p.id, p.name);
      }
    }

    // Batch-fetch genre via manuscript JOIN (all submissions, not just active)
    const allVersionIds = allSubmissions
      .map((s) => s.manuscriptVersionId)
      .filter((id): id is string => id != null);
    const genreMap = new Map<string, Genre | null>();
    if (allVersionIds.length > 0) {
      const genreRows = await db
        .select({
          versionId: manuscriptVersions.id,
          genre: manuscripts.genre,
        })
        .from(manuscriptVersions)
        .innerJoin(
          manuscripts,
          eq(manuscriptVersions.manuscriptId, manuscripts.id),
        )
        .where(inArray(manuscriptVersions.id, allVersionIds));
      for (const row of genreRows) {
        if (row.genre == null) {
          genreMap.set(row.versionId, null);
        } else {
          const parsed = genreSchema.safeParse(row.genre);
          genreMap.set(row.versionId, parsed.success ? parsed.data : null);
        }
      }
    }

    // Batch-fetch submission history
    const allSubIds = allSubmissions.map((s) => s.id);
    const historyMap = new Map<
      string,
      { decidedAt: string | null; statusHistory: MigrationStatusHistoryEntry[] }
    >();
    if (allSubIds.length > 0) {
      const historyRows = await db
        .select({
          submissionId: submissionHistory.submissionId,
          fromStatus: submissionHistory.fromStatus,
          toStatus: submissionHistory.toStatus,
          changedAt: submissionHistory.changedAt,
          comment: submissionHistory.comment,
        })
        .from(submissionHistory)
        .where(inArray(submissionHistory.submissionId, allSubIds));

      // Group by submissionId
      const grouped = new Map<string, typeof historyRows>();
      for (const row of historyRows) {
        const existing = grouped.get(row.submissionId);
        if (existing) {
          existing.push(row);
        } else {
          grouped.set(row.submissionId, [row]);
        }
      }

      const terminalStatuses = new Set(['ACCEPTED', 'REJECTED', 'WITHDRAWN']);

      for (const [subId, rows] of grouped) {
        // Sort by changedAt ASC
        rows.sort(
          (a, b) =>
            new Date(a.changedAt).getTime() - new Date(b.changedAt).getTime(),
        );

        const statusHistory: MigrationStatusHistoryEntry[] = rows.map((r) => ({
          from: r.fromStatus ? hopperToCsrStatus(r.fromStatus) : null,
          to: hopperToCsrStatus(r.toStatus),
          changedAt: new Date(r.changedAt).toISOString(),
          comment: r.comment,
        }));

        // Derive decidedAt from last terminal transition (handles re-decisions)
        let decidedAt: string | null = null;
        for (const r of rows) {
          if (terminalStatuses.has(r.toStatus)) {
            decidedAt = new Date(r.changedAt).toISOString();
          }
        }

        historyMap.set(subId, { decidedAt, statusHistory });
      }
    }

    // Batch-fetch files and versions for active submissions (avoids N+1)
    const versionIds = allSubmissions
      .filter(
        (s) =>
          (ACTIVE_STATUSES as readonly string[]).includes(s.status) &&
          s.manuscriptVersionId,
      )
      .map((s) => s.manuscriptVersionId!);

    const filesMap = new Map<string, TransferFileManifestEntry[]>();
    const versionFingerprintMap = new Map<string, string | null>();

    if (versionIds.length > 0) {
      const fileRows = await db
        .select({
          id: files.id,
          filename: files.filename,
          mimeType: files.mimeType,
          size: files.size,
          manuscriptVersionId: files.manuscriptVersionId,
        })
        .from(files)
        .where(
          and(
            inArray(files.manuscriptVersionId, versionIds),
            eq(files.scanStatus, 'CLEAN'),
          ),
        );

      for (const f of fileRows) {
        const key = f.manuscriptVersionId;
        const entry: TransferFileManifestEntry = {
          fileId: f.id,
          filename: f.filename,
          mimeType: f.mimeType,
          size: Number(f.size),
        };
        const existing = filesMap.get(key);
        if (existing) {
          existing.push(entry);
        } else {
          filesMap.set(key, [entry]);
        }
      }

      const versionRows = await db
        .select({
          id: manuscriptVersions.id,
          contentFingerprint: manuscriptVersions.contentFingerprint,
        })
        .from(manuscriptVersions)
        .where(inArray(manuscriptVersions.id, versionIds));

      for (const v of versionRows) {
        versionFingerprintMap.set(v.id, v.contentFingerprint);
      }
    }

    // Build closed submissions (metadata only)
    const closedHistory: MigrationSubmissionHistory[] = [];
    const activeSubmissions: MigrationActiveSubmission[] = [];
    const allFileIds: string[] = [];

    for (const sub of allSubmissions) {
      const pubName = orgMap.get(sub.organizationId) ?? null;

      const genre = sub.manuscriptVersionId
        ? (genreMap.get(sub.manuscriptVersionId) ?? null)
        : null;
      const periodName = sub.submissionPeriodId
        ? (periodMap.get(sub.submissionPeriodId) ?? null)
        : null;
      const history = historyMap.get(sub.id);

      if ((CLOSED_STATUSES as readonly string[]).includes(sub.status)) {
        closedHistory.push({
          originSubmissionId: sub.id,
          title: sub.title,
          genre,
          coverLetter: sub.coverLetter,
          status: hopperToCsrStatus(sub.status),
          formData: sub.formData ?? null,
          submittedAt: sub.submittedAt?.toISOString() ?? null,
          decidedAt: history?.decidedAt ?? null,
          publicationName: pubName,
          periodName,
          statusHistory: history?.statusHistory ?? [],
        });
      } else if ((ACTIVE_STATUSES as readonly string[]).includes(sub.status)) {
        let fileManifest: TransferFileManifestEntry[] = [];
        let contentFingerprint: string | null = null;

        if (sub.manuscriptVersionId) {
          fileManifest = filesMap.get(sub.manuscriptVersionId) ?? [];
          allFileIds.push(...fileManifest.map((f) => f.fileId));
          contentFingerprint =
            versionFingerprintMap.get(sub.manuscriptVersionId) ?? null;
        }

        activeSubmissions.push({
          originSubmissionId: sub.id,
          title: sub.title,
          genre,
          coverLetter: sub.coverLetter,
          content: sub.content ?? null,
          status: hopperToCsrStatus(sub.status),
          formData: sub.formData ?? null,
          submittedAt: sub.submittedAt?.toISOString() ?? null,
          decidedAt: history?.decidedAt ?? null,
          publicationName: pubName,
          periodName,
          statusHistory: history?.statusHistory ?? [],
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
      submissionHistory: closedHistory,
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
