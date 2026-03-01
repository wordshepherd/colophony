import crypto from 'node:crypto';
import { pool, submissions, eq, type DrizzleDb } from '@colophony/db';
import { STATUS_TOKEN_PREFIX } from '@colophony/types';

export interface StatusCheckResult {
  submissionId: string;
  title: string | null;
  status: string;
  submittedAt: Date | null;
  organizationName: string;
  periodName: string | null;
}

function hashToken(plainText: string): string {
  return crypto.createHash('sha256').update(plainText).digest('hex');
}

/**
 * User-friendly status mapping.
 * Internal statuses → labels safe for external submitters.
 */
const STATUS_DISPLAY_MAP: Record<string, string> = {
  SUBMITTED: 'Under Review',
  UNDER_REVIEW: 'Under Review',
  HOLD: 'Under Review',
  ACCEPTED: 'Accepted',
  REJECTED: 'Not Accepted',
  WITHDRAWN: 'Withdrawn',
  REVISE_AND_RESUBMIT: 'Revision Requested',
};

function mapStatusForDisplay(internalStatus: string): string {
  return STATUS_DISPLAY_MAP[internalStatus] ?? 'Under Review';
}

export const statusTokenService = {
  /**
   * Generate a status token, hash it, and store the hash on the submission.
   * Returns the plain-text token (shown once to the submitter).
   */
  async generateAndStore(tx: DrizzleDb, submissionId: string): Promise<string> {
    const randomHex = crypto.randomBytes(16).toString('hex'); // 32 hex chars
    const plainToken = `${STATUS_TOKEN_PREFIX}${randomHex}`;
    const tokenHash = hashToken(plainToken);

    await tx
      .update(submissions)
      .set({ statusTokenHash: tokenHash })
      .where(eq(submissions.id, submissionId));

    return plainToken;
  },

  /**
   * Verify a status token by hashing and looking up via SECURITY DEFINER function.
   * Bypasses RLS for public status check (no auth context).
   */
  async verifyToken(plainTextToken: string): Promise<StatusCheckResult | null> {
    const tokenHash = hashToken(plainTextToken);

    const result = await pool.query<{
      submission_id: string;
      submission_title: string | null;
      submission_status: string;
      submitted_at: Date | null;
      organization_name: string;
      period_name: string | null;
    }>('SELECT * FROM verify_status_token($1)', [tokenHash]);

    if (result.rows.length === 0) return null;

    const row = result.rows[0];
    return {
      submissionId: row.submission_id,
      title: row.submission_title,
      status: mapStatusForDisplay(row.submission_status),
      submittedAt: row.submitted_at,
      organizationName: row.organization_name,
      periodName: row.period_name,
    };
  },
};
