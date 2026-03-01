import {
  manuscripts,
  externalSubmissions,
  correspondence,
  eq,
  sql,
  type DrizzleDb,
} from '@colophony/db';
import { desc } from 'drizzle-orm';
import type { CSRStatus, WorkspaceStats } from '@colophony/types';

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export const workspaceStatsService = {
  async getStats(tx: DrizzleDb, userId: string): Promise<WorkspaceStats> {
    // Manuscript count
    const [msCount] = await tx
      .select({ count: sql<number>`count(*)::int` })
      .from(manuscripts)
      .where(eq(manuscripts.ownerId, userId));
    const manuscriptCount = msCount?.count ?? 0;

    // External submission status counts
    const statusCounts = await tx
      .select({
        status: externalSubmissions.status,
        count: sql<number>`count(*)::int`,
      })
      .from(externalSubmissions)
      .where(eq(externalSubmissions.userId, userId))
      .groupBy(externalSubmissions.status);

    const countByStatus = new Map(statusCounts.map((r) => [r.status, r.count]));

    const pendingStatuses: CSRStatus[] = ['sent', 'in_review', 'hold', 'draft'];
    const pendingSubmissions = pendingStatuses.reduce(
      (sum, s) => sum + (countByStatus.get(s) ?? 0),
      0,
    );
    const acceptedSubmissions = countByStatus.get('accepted') ?? 0;
    const rejectedSubmissions = countByStatus.get('rejected') ?? 0;

    const decided = acceptedSubmissions + rejectedSubmissions;
    const acceptanceRate = decided > 0 ? acceptedSubmissions / decided : null;

    // Recent activity: last 10 across external submissions + correspondence
    const recentExtSubs = await tx
      .select({
        id: externalSubmissions.id,
        label: externalSubmissions.journalName,
        timestamp: externalSubmissions.updatedAt,
      })
      .from(externalSubmissions)
      .where(eq(externalSubmissions.userId, userId))
      .orderBy(desc(externalSubmissions.updatedAt))
      .limit(10);

    const recentCorr = await tx
      .select({
        id: correspondence.id,
        label: correspondence.subject,
        timestamp: correspondence.sentAt,
      })
      .from(correspondence)
      .where(eq(correspondence.userId, userId))
      .orderBy(desc(correspondence.sentAt))
      .limit(10);

    const recentActivity = [
      ...recentExtSubs.map((r) => ({
        type: 'external_submission' as const,
        id: r.id,
        label: r.label,
        timestamp: r.timestamp.toISOString(),
      })),
      ...recentCorr.map((r) => ({
        type: 'correspondence' as const,
        id: r.id,
        label: r.label ?? 'Untitled',
        timestamp: r.timestamp.toISOString(),
      })),
    ]
      .sort(
        (a, b) =>
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
      )
      .slice(0, 10);

    return {
      manuscriptCount,
      pendingSubmissions,
      acceptedSubmissions,
      rejectedSubmissions,
      acceptanceRate,
      recentActivity,
    };
  },
};
