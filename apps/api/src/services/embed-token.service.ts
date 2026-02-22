import crypto from 'node:crypto';
import {
  pool,
  embedTokens,
  submissionPeriods,
  eq,
  and,
  type DrizzleDb,
} from '@colophony/db';
import type { CreateEmbedTokenInput } from '@colophony/types';
import { EMBED_TOKEN_PREFIX } from '@colophony/types';

/** Token data returned from verify_embed_token() SECURITY DEFINER function. */
export interface VerifiedEmbedToken {
  id: string;
  organizationId: string;
  submissionPeriodId: string;
  allowedOrigins: string[];
  themeConfig: Record<string, unknown> | null;
  active: boolean;
  expiresAt: Date | null;
  period: {
    name: string;
    opensAt: Date;
    closesAt: Date;
    formDefinitionId: string | null;
    maxSubmissions: number | null;
    fee: string | null;
  };
}

/**
 * Generate a new embed token.
 * Format: col_emb_<32 random hex chars> (40 chars total, 128 bits of entropy).
 */
function generateToken(): {
  plainTextToken: string;
  tokenHash: string;
  tokenPrefix: string;
} {
  const randomPart = crypto.randomBytes(16).toString('hex');
  const plainTextToken = `${EMBED_TOKEN_PREFIX}${randomPart}`;
  const tokenHash = crypto
    .createHash('sha256')
    .update(plainTextToken)
    .digest('hex');
  return { plainTextToken, tokenHash, tokenPrefix: EMBED_TOKEN_PREFIX };
}

function hashToken(plainTextToken: string): string {
  return crypto.createHash('sha256').update(plainTextToken).digest('hex');
}

export const embedTokenService = {
  /**
   * Create a new embed token. Returns the plain text token (shown once).
   * Runs inside the caller's RLS transaction.
   */
  async create(
    tx: DrizzleDb,
    orgId: string,
    createdBy: string,
    input: CreateEmbedTokenInput,
  ) {
    // Verify the submission period exists within the caller's org (RLS-scoped)
    const [period] = await tx
      .select({ id: submissionPeriods.id })
      .from(submissionPeriods)
      .where(eq(submissionPeriods.id, input.submissionPeriodId))
      .limit(1);

    if (!period) {
      throw new Error('Submission period not found');
    }

    const { plainTextToken, tokenHash, tokenPrefix } = generateToken();

    const [row] = await tx
      .insert(embedTokens)
      .values({
        organizationId: orgId,
        submissionPeriodId: input.submissionPeriodId,
        tokenHash,
        tokenPrefix,
        allowedOrigins: input.allowedOrigins ?? [],
        themeConfig: input.themeConfig ?? {},
        createdBy,
        expiresAt: input.expiresAt ?? null,
      })
      .returning({
        id: embedTokens.id,
        submissionPeriodId: embedTokens.submissionPeriodId,
        tokenPrefix: embedTokens.tokenPrefix,
        allowedOrigins: embedTokens.allowedOrigins,
        themeConfig: embedTokens.themeConfig,
        active: embedTokens.active,
        createdAt: embedTokens.createdAt,
        expiresAt: embedTokens.expiresAt,
      });

    return { ...row, plainTextToken };
  },

  /**
   * List embed tokens for a specific submission period (RLS handles org filtering).
   */
  async list(tx: DrizzleDb, submissionPeriodId: string) {
    return tx
      .select({
        id: embedTokens.id,
        submissionPeriodId: embedTokens.submissionPeriodId,
        tokenPrefix: embedTokens.tokenPrefix,
        allowedOrigins: embedTokens.allowedOrigins,
        themeConfig: embedTokens.themeConfig,
        active: embedTokens.active,
        createdAt: embedTokens.createdAt,
        expiresAt: embedTokens.expiresAt,
      })
      .from(embedTokens)
      .where(eq(embedTokens.submissionPeriodId, submissionPeriodId))
      .orderBy(embedTokens.createdAt);
  },

  /**
   * Revoke an embed token by setting active = false.
   */
  async revoke(tx: DrizzleDb, tokenId: string) {
    const [updated] = await tx
      .update(embedTokens)
      .set({ active: false })
      .where(and(eq(embedTokens.id, tokenId)))
      .returning({
        id: embedTokens.id,
        active: embedTokens.active,
      });
    return updated ?? null;
  },

  /**
   * Hard delete an embed token.
   */
  async delete(tx: DrizzleDb, tokenId: string) {
    const [deleted] = await tx
      .delete(embedTokens)
      .where(eq(embedTokens.id, tokenId))
      .returning({ id: embedTokens.id });
    return deleted ?? null;
  },

  /**
   * Verify an embed token by hashing and looking up via SECURITY DEFINER function.
   * Bypasses RLS for cross-org lookup (same pattern as verify_api_key).
   * Returns token details + period data, or null if not found.
   */
  async verifyToken(
    plainTextToken: string,
  ): Promise<VerifiedEmbedToken | null> {
    const tokenHash = hashToken(plainTextToken);

    const result = await pool.query<{
      id: string;
      organization_id: string;
      submission_period_id: string;
      allowed_origins: string[];
      theme_config: Record<string, unknown> | null;
      active: boolean;
      expires_at: Date | null;
      period_name: string;
      period_opens_at: Date;
      period_closes_at: Date;
      period_form_definition_id: string | null;
      period_max_submissions: number | null;
      period_fee: string | null;
    }>('SELECT * FROM verify_embed_token($1)', [tokenHash]);

    if (result.rows.length === 0) return null;

    const row = result.rows[0];
    return {
      id: row.id,
      organizationId: row.organization_id,
      submissionPeriodId: row.submission_period_id,
      allowedOrigins: row.allowed_origins,
      themeConfig: row.theme_config,
      active: row.active,
      expiresAt: row.expires_at,
      period: {
        name: row.period_name,
        opensAt: row.period_opens_at,
        closesAt: row.period_closes_at,
        formDefinitionId: row.period_form_definition_id,
        maxSubmissions: row.period_max_submissions,
        fee: row.period_fee,
      },
    };
  },
};
