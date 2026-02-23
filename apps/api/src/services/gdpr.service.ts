import { pool } from '@colophony/db';
import { AuditActions, AuditResources } from '@colophony/types';
import type { Env } from '../config/env.js';
import { enqueueS3Cleanup } from '../queues/s3-cleanup.queue.js';
import { serializeValue } from './audit.service.js';

export class UserNotDeletableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UserNotDeletableError';
  }
}

export class OrgNotDeletableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'OrgNotDeletableError';
  }
}

export const gdprService = {
  /**
   * Delete a user account and scrub PII from audit events.
   *
   * SECURITY NOTE: Uses pool.connect() directly (bypasses RLS) because:
   * 1. users table has no RLS policies
   * 2. audit_events UPDATE requires superuser (audit_writer tamper protection)
   * 3. File collection is a cross-tenant read (same pattern as userService.getProfile)
   * This is a privileged GDPR operation — matches existing patterns in
   * zitadel.webhook.ts and user.service.ts
   */
  async deleteUser(
    userId: string,
    env: Env,
  ): Promise<{ storageKeysEnqueued: number }> {
    const client = await pool.connect();
    let storageKeys: Array<{
      storageKey: string;
      bucket: 'clean' | 'quarantine';
    }> = [];

    try {
      await client.query('BEGIN');

      // Verify user exists
      const userResult = await client.query(
        'SELECT id FROM users WHERE id = $1',
        [userId],
      );
      if (userResult.rows.length === 0) {
        throw new UserNotDeletableError('User not found');
      }

      // Step 1: Collect S3 storage keys before cascade deletes the rows
      const fileResult = await client.query<{
        storage_key: string;
        scan_status: string;
      }>(
        `SELECT f.storage_key, f.scan_status
         FROM files f
         JOIN manuscript_versions mv ON f.manuscript_version_id = mv.id
         JOIN manuscripts m ON mv.manuscript_id = m.id
         WHERE m.owner_id = $1`,
        [userId],
      );

      storageKeys = fileResult.rows.map((row) => ({
        storageKey: row.storage_key,
        bucket:
          row.scan_status === 'CLEAN'
            ? ('clean' as const)
            : ('quarantine' as const),
      }));

      // Step 2: Scrub audit PII
      await client.query(
        `UPDATE audit_events
         SET old_value = '{"_scrubbed":"gdpr"}',
             new_value = '{"_scrubbed":"gdpr"}',
             ip_address = NULL,
             user_agent = NULL
         WHERE actor_id = $1`,
        [userId],
      );

      // Step 3: Log GDPR deletion audit event (before DELETE so actor_id is still valid)
      const auditNewValue = serializeValue({
        deletedUserId: userId,
        storageKeysCount: storageKeys.length,
      });
      await client.query(
        `SELECT insert_audit_event(
          $1::varchar, $2::varchar,
          $3::uuid, $4::uuid,
          NULL::uuid,
          NULL::text, $5::text,
          NULL::varchar, NULL::text,
          NULL::varchar, NULL::varchar,
          NULL::varchar
        )`,
        [
          AuditActions.USER_GDPR_DELETED,
          AuditResources.USER,
          userId,
          userId,
          auditNewValue,
        ],
      );

      // Step 4: DELETE user row — CASCADE handles: manuscripts → versions → files,
      // dsar_requests, organization_members, user_consents.
      // SET NULL handles: submissions.submitterId, api_keys.createdBy,
      // form_definitions.createdBy, embed_tokens.createdBy, audit_events.actorId.
      await client.query('DELETE FROM users WHERE id = $1', [userId]);

      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }

    // Step 5: Enqueue S3 cleanup (outside transaction, best-effort)
    let storageKeysEnqueued = 0;
    if (storageKeys.length > 0) {
      try {
        await enqueueS3Cleanup(env, {
          storageKeys,
          reason: 'user_gdpr_deletion',
          sourceId: userId,
        });
        storageKeysEnqueued = storageKeys.length;
      } catch {
        // Best-effort — DB deletion already committed.
        // S3 objects will remain as orphans until manual cleanup.
      }
    }

    return { storageKeysEnqueued };
  },

  /**
   * Delete an organization and all its children.
   *
   * SECURITY NOTE: Uses pool.connect() directly (bypasses RLS) because:
   * 1. organizations table has no RLS policies
   * 2. audit_events UPDATE requires superuser (audit_writer tamper protection)
   * 3. Admin check is a cross-org membership lookup (same pattern as
   *    organizationService.listUserOrganizations using SECURITY DEFINER)
   */
  async deleteOrganization(
    orgId: string,
    actorUserId: string,
    env: Env,
  ): Promise<void> {
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // Step 1: Verify ADMIN role
      const memberResult = await client.query<{ role: string }>(
        'SELECT role FROM organization_members WHERE organization_id = $1 AND user_id = $2',
        [orgId, actorUserId],
      );
      if (
        memberResult.rows.length === 0 ||
        memberResult.rows[0].role !== 'ADMIN'
      ) {
        throw new OrgNotDeletableError(
          'Only organization admins can delete an organization',
        );
      }

      // Step 2: Scrub audit PII for org
      await client.query(
        `UPDATE audit_events
         SET old_value = '{"_scrubbed":"org_deleted"}',
             new_value = '{"_scrubbed":"org_deleted"}',
             ip_address = NULL,
             user_agent = NULL
         WHERE organization_id = $1`,
        [orgId],
      );

      // Step 3: Log org deletion audit via raw SQL
      // Pass NULL for organization_id — the org is about to be deleted, and the
      // insert_audit_event() SECURITY DEFINER runs as audit_writer which respects
      // RLS. The INSERT policy requires organization_id IS NULL OR matches current_org,
      // and we have no org context set on this pool connection. The deleted org ID
      // is captured in newValue JSON for traceability.
      const auditNewValue = serializeValue({
        deletedOrgId: orgId,
        deletedBy: actorUserId,
      });
      await client.query(
        `SELECT insert_audit_event(
          $1::varchar, $2::varchar,
          $3::uuid, $4::uuid,
          NULL::uuid,
          NULL::text, $5::text,
          NULL::varchar, NULL::text,
          NULL::varchar, NULL::varchar,
          NULL::varchar
        )`,
        [
          AuditActions.ORG_DELETED,
          AuditResources.ORGANIZATION,
          orgId, // p_resource_id — the deleted org
          actorUserId, // p_actor_id — who performed deletion
          auditNewValue, // p_new_value
        ],
      );

      // Step 4: DELETE organization — CASCADE handles: members, submission_periods,
      // submissions, submission_history, form_definitions, form_pages, form_fields,
      // api_keys, embed_tokens, retention_policies, user_consents.
      // SET NULL handles: payments.organizationId, audit_events.organizationId.
      await client.query('DELETE FROM organizations WHERE id = $1', [orgId]);

      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
    // No S3 cleanup needed — files belong to users' manuscripts (user-scoped), not orgs.
    void env; // env unused for org deletion but kept for API consistency
  },
};
