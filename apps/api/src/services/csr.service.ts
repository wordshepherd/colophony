import {
  db,
  submissions,
  organizations,
  submissionPeriods,
  submissionHistory,
  manuscriptVersions,
  manuscripts,
  externalSubmissions,
  correspondence,
  writerProfiles,
  users,
  eq,
  inArray,
} from '@colophony/db';
import type { DrizzleDb } from '@colophony/db';
import type {
  CSRExportEnvelope,
  CSRNativeSubmission,
  CSRImportInput,
  CSRImportResult,
  Genre,
  MigrationStatusHistoryEntry,
} from '@colophony/types';
import { genreSchema, hopperToCsrStatus } from '@colophony/types';

// ---------------------------------------------------------------------------
// Error classes
// ---------------------------------------------------------------------------

export class CSRExportError extends Error {
  override name = 'CSRExportError' as const;
  constructor(message: string) {
    super(message);
  }
}

export class CSRImportError extends Error {
  override name = 'CSRImportError' as const;
  constructor(message: string) {
    super(message);
  }
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MAX_NATIVE_SUBMISSIONS = 10_000;
const MAX_EXTERNAL = 10_000;
const MAX_CORRESPONDENCE = 50_000;

/** Statuses that indicate a terminal/decided submission. */
const TERMINAL_STATUSES = new Set(['ACCEPTED', 'REJECTED', 'WITHDRAWN']);

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export const csrService = {
  /**
   * Assemble a full CSR export envelope for a user.
   *
   * Uses superuser `db` — justified: CSR export is a user-level operation
   * that spans all orgs. Same justification as migration bundle and GDPR.
   */
  async assembleExport(params: { userId: string }): Promise<CSRExportEnvelope> {
    // 1. User identity
    const [user] = await db
      .select({ id: users.id, email: users.email })
      .from(users)
      .where(eq(users.id, params.userId));

    if (!user) {
      throw new CSRExportError('User not found');
    }

    // 2. Native submissions (cross-org)
    const allSubmissions = await db
      .select({
        id: submissions.id,
        title: submissions.title,
        coverLetter: submissions.coverLetter,
        status: submissions.status,
        formData: submissions.formData,
        submittedAt: submissions.submittedAt,
        organizationId: submissions.organizationId,
        manuscriptVersionId: submissions.manuscriptVersionId,
        submissionPeriodId: submissions.submissionPeriodId,
      })
      .from(submissions)
      .limit(MAX_NATIVE_SUBMISSIONS)
      .where(eq(submissions.submitterId, params.userId));

    // 3. Batch-fetch orgs
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

    // 4. Batch-fetch periods
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

    // 5. Batch-fetch genre via manuscript JOIN
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

    // 6. Batch-fetch submission history
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

      const grouped = new Map<string, typeof historyRows>();
      for (const row of historyRows) {
        const existing = grouped.get(row.submissionId);
        if (existing) {
          existing.push(row);
        } else {
          grouped.set(row.submissionId, [row]);
        }
      }

      for (const [subId, rows] of grouped) {
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

        let decidedAt: string | null = null;
        for (const r of rows) {
          if (TERMINAL_STATUSES.has(r.toStatus)) {
            decidedAt = new Date(r.changedAt).toISOString();
          }
        }

        historyMap.set(subId, { decidedAt, statusHistory });
      }
    }

    // 7. Build native submissions (all in one array, no closed/active split)
    const nativeSubmissions: CSRNativeSubmission[] = allSubmissions.map(
      (sub) => {
        const genre = sub.manuscriptVersionId
          ? (genreMap.get(sub.manuscriptVersionId) ?? null)
          : null;
        const periodName = sub.submissionPeriodId
          ? (periodMap.get(sub.submissionPeriodId) ?? null)
          : null;
        const history = historyMap.get(sub.id);

        return {
          originSubmissionId: sub.id,
          title: sub.title,
          genre,
          coverLetter: sub.coverLetter,
          status: hopperToCsrStatus(sub.status),
          formData: sub.formData ?? null,
          submittedAt: sub.submittedAt?.toISOString() ?? null,
          decidedAt: history?.decidedAt ?? null,
          publicationName: orgMap.get(sub.organizationId) ?? null,
          periodName,
          statusHistory: history?.statusHistory ?? [],
        };
      },
    );

    // 8. External submissions
    const extSubs = await db
      .select()
      .from(externalSubmissions)
      .limit(MAX_EXTERNAL)
      .where(eq(externalSubmissions.userId, params.userId));

    const externalSubmissionsResult = extSubs.map((s) => ({
      id: s.id,
      manuscriptId: s.manuscriptId,
      journalDirectoryId: s.journalDirectoryId,
      journalName: s.journalName,
      status: s.status,
      sentAt: s.sentAt?.toISOString() ?? null,
      respondedAt: s.respondedAt?.toISOString() ?? null,
      method: s.method,
      notes: s.notes,
      importedFrom: s.importedFrom,
      createdAt: s.createdAt.toISOString(),
      updatedAt: s.updatedAt.toISOString(),
    }));

    // 9. Correspondence
    const corr = await db
      .select()
      .from(correspondence)
      .limit(MAX_CORRESPONDENCE)
      .where(eq(correspondence.userId, params.userId));

    const correspondenceResult = corr.map((c) => ({
      id: c.id,
      submissionId: c.submissionId,
      externalSubmissionId: c.externalSubmissionId,
      direction: c.direction,
      channel: c.channel,
      sentAt: c.sentAt.toISOString(),
      subject: c.subject,
      body: c.body,
      senderName: c.senderName,
      senderEmail: c.senderEmail,
      isPersonalized: c.isPersonalized,
      source: c.source as 'colophony' | 'manual',
      capturedAt: c.capturedAt.toISOString(),
    }));

    // 10. Writer profiles
    const profiles = await db
      .select()
      .from(writerProfiles)
      .where(eq(writerProfiles.userId, params.userId));

    const writerProfilesResult = profiles.map((p) => ({
      id: p.id,
      platform: p.platform,
      externalId: p.externalId,
      profileUrl: p.profileUrl,
    }));

    // 11. Manuscripts
    const mss = await db
      .select({
        id: manuscripts.id,
        title: manuscripts.title,
        genre: manuscripts.genre,
        createdAt: manuscripts.createdAt,
      })
      .from(manuscripts)
      .where(eq(manuscripts.ownerId, params.userId));

    const manuscriptsResult = mss.map((m) => {
      let genre: Genre | null = null;
      if (m.genre != null) {
        const parsed = genreSchema.safeParse(m.genre);
        genre = parsed.success ? parsed.data : null;
      }
      return {
        id: m.id,
        title: m.title,
        genre,
        createdAt: m.createdAt.toISOString(),
      };
    });

    return {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      identity: {
        userId: user.id,
        email: user.email,
        displayName: null,
      },
      nativeSubmissions,
      externalSubmissions: externalSubmissionsResult,
      correspondence: correspondenceResult,
      writerProfiles: writerProfilesResult,
      manuscripts: manuscriptsResult,
    };
  },

  /**
   * Import external submissions and correspondence from a CSR JSON payload.
   *
   * Uses RLS-scoped `tx` from userProcedure.
   */
  async importRecords(
    tx: DrizzleDb,
    params: { userId: string; input: CSRImportInput },
  ): Promise<CSRImportResult> {
    const { userId, input } = params;

    // 1. Batch-insert external submissions
    const submissionValues = input.submissions.map((s) => ({
      userId,
      journalName: s.journalName,
      journalDirectoryId: s.journalDirectoryId ?? null,
      status: s.status,
      sentAt: s.sentAt ? new Date(s.sentAt) : null,
      respondedAt: s.respondedAt ? new Date(s.respondedAt) : null,
      method: s.method ?? null,
      notes: s.notes ?? null,
      importedFrom: s.importedFrom ?? input.importedFrom,
    }));

    const createdSubs = await tx
      .insert(externalSubmissions)
      .values(submissionValues)
      .returning({ id: externalSubmissions.id });

    // 2. Insert correspondence linked to new submissions
    let correspondenceCreated = 0;
    if (input.correspondence.length > 0) {
      const correspondenceValues = input.correspondence.map((c) => {
        if (c.externalSubmissionIndex >= createdSubs.length) {
          throw new CSRImportError(
            `Invalid externalSubmissionIndex ${c.externalSubmissionIndex}: only ${createdSubs.length} submissions were created`,
          );
        }

        return {
          userId,
          externalSubmissionId: createdSubs[c.externalSubmissionIndex].id,
          direction: c.direction,
          channel: c.channel,
          sentAt: new Date(c.sentAt),
          subject: c.subject ?? null,
          body: c.body,
          senderName: c.senderName ?? null,
          senderEmail: c.senderEmail ?? null,
          isPersonalized: c.isPersonalized,
          source: 'manual' as const,
          capturedAt: new Date(),
        };
      });

      await tx.insert(correspondence).values(correspondenceValues);
      correspondenceCreated = correspondenceValues.length;
    }

    return {
      submissionsCreated: createdSubs.length,
      correspondenceCreated,
    };
  },
};
