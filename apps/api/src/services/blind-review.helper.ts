import { submissionPeriods, eq, type DrizzleDb } from '@colophony/db';
import type { BlindReviewMode, Role } from '@colophony/types';
import {
  shouldBlindSubmitter,
  shouldBlindPeerIdentity,
} from '@colophony/types';

/**
 * Resolve the blind review mode for a submission period.
 * Returns 'none' when periodId is null or the period is not found.
 */
export async function resolveBlindMode(
  tx: DrizzleDb,
  submissionPeriodId: string | null,
): Promise<BlindReviewMode> {
  if (!submissionPeriodId) return 'none';

  const [period] = await tx
    .select({ blindReviewMode: submissionPeriods.blindReviewMode })
    .from(submissionPeriods)
    .where(eq(submissionPeriods.id, submissionPeriodId))
    .limit(1);

  return period?.blindReviewMode ?? 'none';
}

/**
 * Null out submitterEmail when blind review is active and caller is not ADMIN.
 */
export function applySubmitterBlinding<
  T extends { submitterEmail: string | null },
>(item: T, blindMode: BlindReviewMode, callerRole: Role): T {
  if (shouldBlindSubmitter({ blindMode, callerRole })) {
    return { ...item, submitterEmail: null };
  }
  return item;
}

/**
 * Null out voterEmail when double-blind and caller is not ADMIN.
 */
export function applyVoterBlinding<T extends { voterEmail: string | null }>(
  item: T,
  blindMode: BlindReviewMode,
  callerRole: Role,
): T {
  if (shouldBlindPeerIdentity({ blindMode, callerRole })) {
    return { ...item, voterEmail: null };
  }
  return item;
}

/**
 * Null out authorEmail when double-blind and caller is not ADMIN.
 */
export function applyAuthorBlinding<T extends { authorEmail: string | null }>(
  item: T,
  blindMode: BlindReviewMode,
  callerRole: Role,
): T {
  if (shouldBlindPeerIdentity({ blindMode, callerRole })) {
    return { ...item, authorEmail: null };
  }
  return item;
}

/**
 * Null out reviewerEmail when double-blind and caller is not ADMIN.
 */
export function applyReviewerBlinding<
  T extends { reviewerEmail: string | null },
>(item: T, blindMode: BlindReviewMode, callerRole: Role): T {
  if (shouldBlindPeerIdentity({ blindMode, callerRole })) {
    return { ...item, reviewerEmail: null };
  }
  return item;
}
