import crypto from 'node:crypto';
import { pool, apiKeys, eq, and, sql, type DrizzleDb } from '@colophony/db';
import type { CreateApiKeyInput, PaginationInput } from '@colophony/types';

const KEY_PREFIX = 'col_live_';

/**
 * Generate a new API key.
 * Format: col_live_<32 random hex chars> (41 chars total, 128 bits of entropy).
 */
function generateKey(): {
  plainTextKey: string;
  keyHash: string;
  keyPrefix: string;
} {
  const randomPart = crypto.randomBytes(16).toString('hex'); // 32 hex chars
  const plainTextKey = `${KEY_PREFIX}${randomPart}`;
  const keyHash = crypto
    .createHash('sha256')
    .update(plainTextKey)
    .digest('hex');
  return { plainTextKey, keyHash, keyPrefix: KEY_PREFIX };
}

function hashKey(plainTextKey: string): string {
  return crypto.createHash('sha256').update(plainTextKey).digest('hex');
}

export const apiKeyService = {
  /**
   * Create a new API key. Returns the plain text key (shown once).
   * Runs inside the caller's RLS transaction.
   */
  async create(
    tx: DrizzleDb,
    orgId: string,
    createdBy: string,
    input: CreateApiKeyInput,
  ) {
    const { plainTextKey, keyHash, keyPrefix } = generateKey();

    const [row] = await tx
      .insert(apiKeys)
      .values({
        organizationId: orgId,
        createdBy,
        name: input.name,
        keyHash,
        keyPrefix,
        scopes: input.scopes,
        expiresAt: input.expiresAt ?? null,
      })
      .returning({
        id: apiKeys.id,
        name: apiKeys.name,
        scopes: apiKeys.scopes,
        keyPrefix: apiKeys.keyPrefix,
        createdAt: apiKeys.createdAt,
        expiresAt: apiKeys.expiresAt,
        lastUsedAt: apiKeys.lastUsedAt,
        revokedAt: apiKeys.revokedAt,
      });

    return { ...row, plainTextKey };
  },

  /**
   * List API keys for the current org (RLS handles filtering).
   * Never returns keyHash.
   */
  async list(tx: DrizzleDb, pagination: PaginationInput) {
    const { page, limit } = pagination;
    const offset = (page - 1) * limit;

    const [items, countResult] = await Promise.all([
      tx
        .select({
          id: apiKeys.id,
          name: apiKeys.name,
          scopes: apiKeys.scopes,
          keyPrefix: apiKeys.keyPrefix,
          createdAt: apiKeys.createdAt,
          expiresAt: apiKeys.expiresAt,
          lastUsedAt: apiKeys.lastUsedAt,
          revokedAt: apiKeys.revokedAt,
        })
        .from(apiKeys)
        .orderBy(apiKeys.createdAt)
        .limit(limit)
        .offset(offset),
      tx.select({ count: sql<number>`count(*)::int` }).from(apiKeys),
    ]);

    const total = countResult[0]?.count ?? 0;

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  },

  /**
   * Get a single API key by ID. RLS scoped.
   */
  async getById(tx: DrizzleDb, keyId: string) {
    const [row] = await tx
      .select({
        id: apiKeys.id,
        name: apiKeys.name,
        scopes: apiKeys.scopes,
        keyPrefix: apiKeys.keyPrefix,
        createdAt: apiKeys.createdAt,
        expiresAt: apiKeys.expiresAt,
        lastUsedAt: apiKeys.lastUsedAt,
        revokedAt: apiKeys.revokedAt,
      })
      .from(apiKeys)
      .where(eq(apiKeys.id, keyId))
      .limit(1);
    return row ?? null;
  },

  /**
   * Revoke an API key by setting revokedAt.
   */
  async revoke(tx: DrizzleDb, keyId: string) {
    const [updated] = await tx
      .update(apiKeys)
      .set({ revokedAt: new Date() })
      .where(and(eq(apiKeys.id, keyId)))
      .returning({
        id: apiKeys.id,
        name: apiKeys.name,
        revokedAt: apiKeys.revokedAt,
      });
    return updated ?? null;
  },

  /**
   * Hard delete an API key.
   */
  async delete(tx: DrizzleDb, keyId: string) {
    const [deleted] = await tx
      .delete(apiKeys)
      .where(eq(apiKeys.id, keyId))
      .returning({ id: apiKeys.id });
    return deleted ?? null;
  },

  /**
   * Verify an API key by hashing and looking up via SECURITY DEFINER function.
   * Bypasses RLS for cross-org lookup (same pattern as list_user_organizations).
   * Returns key details + creator info, or null if not found.
   */
  async verifyKey(plainTextKey: string) {
    const keyHash = hashKey(plainTextKey);

    const result = await pool.query<{
      id: string;
      organization_id: string;
      created_by: string;
      name: string;
      scopes: string[];
      expires_at: Date | null;
      revoked_at: Date | null;
      last_used_at: Date | null;
      created_at: Date;
      creator_email: string;
      creator_email_verified: boolean;
      creator_deleted_at: Date | null;
    }>('SELECT * FROM verify_api_key($1)', [keyHash]);

    if (result.rows.length === 0) return null;

    const row = result.rows[0];
    return {
      apiKey: {
        id: row.id,
        organizationId: row.organization_id,
        createdBy: row.created_by,
        name: row.name,
        scopes: row.scopes,
        expiresAt: row.expires_at,
        revokedAt: row.revoked_at,
        lastUsedAt: row.last_used_at,
        createdAt: row.created_at,
      },
      creator: {
        id: row.created_by,
        email: row.creator_email,
        emailVerified: row.creator_email_verified,
        deletedAt: row.creator_deleted_at,
      },
    };
  },

  /**
   * Fire-and-forget update of lastUsedAt via SECURITY DEFINER function.
   * Errors are swallowed — callers use `void apiKeyService.touchLastUsed(...)`.
   */
  async touchLastUsed(keyId: string): Promise<void> {
    try {
      await pool.query('SELECT touch_api_key_last_used($1, $2)', [
        keyId,
        new Date(),
      ]);
    } catch {
      // Swallow — non-critical update
    }
  },
};
