import { Readable } from 'node:stream';
import crypto from 'node:crypto';
import * as jose from 'jose';
import {
  db,
  withRls,
  identityMigrations,
  submissions,
  trustedPeers,
  users,
  files,
  eq,
  and,
  sql,
  not,
  inArray,
} from '@colophony/db';
import { count } from 'drizzle-orm';
import {
  AuditActions,
  AuditResources,
  csrToHopperStatus,
  type MigrationInitiateRequest,
  type MigrationInitiateResponse,
  type MigrationBundleDelivery,
  type MigrationBundleAck,
  type MigrationCompleteNotify,
  type MigrationBroadcast,
  type MigrationListQuery,
  type IdentityMigration,
} from '@colophony/types';
import type { Env } from '../config/env.js';
import { auditService } from './audit.service.js';
import { federationService, domainToDid } from './federation.service.js';
import { migrationBundleService } from './migration-bundle.service.js';
import { signFederationRequest } from '../federation/http-signatures.js';
import { validateOutboundUrl } from '../lib/url-validation.js';
import { getGlobalRegistry } from '../adapters/registry-accessor.js';
import type { S3StorageAdapter } from '../adapters/storage/index.js';

// ---------------------------------------------------------------------------
// Error classes
// ---------------------------------------------------------------------------

export class MigrationNotFoundError extends Error {
  override name = 'MigrationNotFoundError' as const;
  constructor(id: string) {
    super(`Migration not found: ${id}`);
  }
}

export class MigrationInvalidStateError extends Error {
  override name = 'MigrationInvalidStateError' as const;
  constructor(message: string) {
    super(message);
  }
}

export class MigrationCapabilityError extends Error {
  override name = 'MigrationCapabilityError' as const;
  constructor(domain: string) {
    super(
      `Peer ${domain} does not have the required identity.migrate capability`,
    );
  }
}

export class MigrationTokenError extends Error {
  override name = 'MigrationTokenError' as const;
  constructor(message: string) {
    super(message);
  }
}

export class MigrationUserNotFoundError extends Error {
  override name = 'MigrationUserNotFoundError' as const;
  constructor(email: string) {
    super(`User not found: ${email}`);
  }
}

export class MigrationAlreadyActiveError extends Error {
  override name = 'MigrationAlreadyActiveError' as const;
  constructor() {
    super('An active migration already exists for this user and destination');
  }
}

// ---------------------------------------------------------------------------
// Terminal statuses (allow retries after these)
// ---------------------------------------------------------------------------

const TERMINAL_STATUSES = [
  'COMPLETED',
  'FAILED',
  'REJECTED',
  'EXPIRED',
  'CANCELLED',
] as const;

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export const migrationService = {
  // ─── Destination-side ───

  /**
   * Request a migration from the destination instance.
   *
   * 1. Look up trusted peer for organizationId with identity.migrate capability
   * 2. Send S2S request to origin
   * 3. Create local PENDING migration record
   */
  async requestMigration(
    env: Env,
    params: {
      userId: string;
      organizationId: string;
      originDomain: string;
      originEmail: string;
    },
  ): Promise<{ migrationId: string; status: string }> {
    const { userId, organizationId, originDomain, originEmail } = params;
    const domain = env.FEDERATION_DOMAIN ?? 'localhost';

    // Look up trusted peer for the target org
    const [peer] = await withRls({ orgId: organizationId }, async (tx) => {
      return tx
        .select({
          domain: trustedPeers.domain,
          instanceUrl: trustedPeers.instanceUrl,
        })
        .from(trustedPeers)
        .where(
          and(
            eq(trustedPeers.domain, originDomain),
            eq(trustedPeers.status, 'active'),
            sql`granted_capabilities @> '{"identity.migrate": true}'::jsonb`,
          ),
        )
        .limit(1);
    });

    if (!peer) {
      throw new MigrationCapabilityError(originDomain);
    }

    // Build local user DID
    const [user] = await db
      .select({ email: users.email })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    const emailLocal = user?.email?.split('@')[0] ?? userId;
    const encodedDomain = domainToDid(domain);
    const userDid = `did:web:${encodedDomain}:users:${emailLocal}`;

    // Build callback URL for bundle delivery
    const callbackUrl = `https://${domain}/federation/v1/migrations/bundle-delivery`;

    // Send S2S request to origin
    const config = await federationService.getOrInitConfig(env);
    const url = `${peer.instanceUrl}/federation/v1/migrations/request`;
    const devMode =
      process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test';
    await validateOutboundUrl(url, { devMode });

    const body = JSON.stringify({
      userEmail: originEmail,
      destinationDomain: domain,
      destinationUserDid: userDid,
      callbackUrl,
      protocolVersion: '1.0',
    } satisfies MigrationInitiateRequest);

    const { headers: signedHeaders } = signFederationRequest({
      method: 'POST',
      url,
      headers: { 'content-type': 'application/json' },
      body,
      privateKey: config.privateKey,
      keyId: `${domain}#main`,
    });

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...signedHeaders },
      body,
      signal: AbortSignal.timeout(10_000),
    });

    if (!response.ok) {
      const errorBody = await response.text().catch(() => 'unknown');
      throw new MigrationInvalidStateError(
        `Origin rejected migration request: ${response.status} ${errorBody}`,
      );
    }

    const remoteResult = (await response.json()) as MigrationInitiateResponse;

    // Reuse the origin's migration ID so S2S follow-up messages (bundle-delivery,
    // complete) can correlate correctly across both instances.
    const migrationId = remoteResult.migrationId;
    await withRls({ userId }, async (tx) => {
      await tx.insert(identityMigrations).values({
        id: migrationId,
        userId,
        organizationId,
        direction: 'inbound',
        peerDomain: originDomain,
        peerInstanceUrl: peer.instanceUrl,
        userDid,
        status: 'PENDING',
        callbackUrl,
      });
    });

    // Audit
    await auditService.logDirect({
      resource: AuditResources.MIGRATION,
      action: AuditActions.MIGRATION_REQUESTED,
      resourceId: migrationId,
      actorId: userId,
      newValue: {
        originDomain,
        originEmail,
        remoteMigrationId: remoteResult.migrationId,
      },
    });

    return { migrationId, status: 'pending' };
  },

  /**
   * Handle bundle delivery from origin instance.
   *
   * Superuser queries — justified: S2S pre-auth context, no local user session.
   */
  async handleBundleDelivery(
    env: Env,
    peerDomain: string,
    delivery: MigrationBundleDelivery,
  ): Promise<MigrationBundleAck> {
    // Find local migration by migrationId + peerDomain (superuser — S2S)
    const [migration] = await db
      .select()
      .from(identityMigrations)
      .where(
        and(
          eq(identityMigrations.id, delivery.migrationId),
          eq(identityMigrations.direction, 'inbound'),
          eq(identityMigrations.peerDomain, peerDomain),
          eq(identityMigrations.status, 'PENDING'),
        ),
      )
      .limit(1);

    if (!migration) {
      // Idempotency check: if already PROCESSING/COMPLETED, return existing ack
      const [existing] = await db
        .select({
          id: identityMigrations.id,
          status: identityMigrations.status,
        })
        .from(identityMigrations)
        .where(
          and(
            eq(identityMigrations.id, delivery.migrationId),
            eq(identityMigrations.direction, 'inbound'),
            eq(identityMigrations.peerDomain, peerDomain),
            inArray(identityMigrations.status, ['PROCESSING', 'COMPLETED']),
          ),
        )
        .limit(1);

      if (existing) {
        return {
          migrationId: existing.id,
          status: 'accepted',
          message: 'Already processed',
        };
      }

      throw new MigrationNotFoundError(delivery.migrationId);
    }

    const orgId = migration.organizationId;
    if (!orgId) {
      throw new MigrationInvalidStateError(
        'Migration record missing organization context',
      );
    }

    const bundle = delivery.bundle;

    // Import closed submissions with provenance (org-scoped RLS)
    await withRls({ orgId }, async (tx) => {
      for (const hist of bundle.submissionHistory) {
        // Idempotency: check if already imported
        const [existing] = await tx
          .select({ id: submissions.id })
          .from(submissions)
          .where(
            and(
              eq(submissions.transferredFromDomain, peerDomain),
              eq(
                submissions.transferredFromTransferId,
                hist.originSubmissionId,
              ),
            ),
          )
          .limit(1);

        if (existing) continue;

        await tx.insert(submissions).values({
          organizationId: orgId,
          submitterId: migration.userId,
          title: hist.title ?? 'Migrated submission',
          coverLetter: hist.coverLetter,
          status: csrToHopperStatus(hist.status) ?? 'REJECTED',
          formData: hist.formData ?? undefined,
          submittedAt: hist.submittedAt
            ? new Date(hist.submittedAt)
            : undefined,
          transferredFromDomain: peerDomain,
          transferredFromTransferId: hist.originSubmissionId,
        });
      }
    });

    // Import active submissions as DRAFT with file manifests (org-scoped RLS)
    await withRls({ orgId }, async (tx) => {
      for (const active of bundle.activeSubmissions) {
        // Idempotency: check if already imported
        const [existing] = await tx
          .select({ id: submissions.id })
          .from(submissions)
          .where(
            and(
              eq(submissions.transferredFromDomain, peerDomain),
              eq(
                submissions.transferredFromTransferId,
                active.originSubmissionId,
              ),
            ),
          )
          .limit(1);

        if (existing) continue;

        await tx.insert(submissions).values({
          organizationId: orgId,
          submitterId: migration.userId,
          title: active.title ?? 'Migrated submission',
          coverLetter: active.coverLetter,
          content: active.content,
          status: 'DRAFT',
          formData: {
            ...(active.formData ?? {}),
            _migrationFiles: active.fileManifest,
          },
          submittedAt: active.submittedAt
            ? new Date(active.submittedAt)
            : undefined,
          transferredFromDomain: peerDomain,
          transferredFromTransferId: active.originSubmissionId,
        });
      }
    });

    // Update migration status → PROCESSING
    await db
      .update(identityMigrations)
      .set({
        status: 'PROCESSING',
        migrationToken: bundle.bundleToken,
        bundleMetadata: {
          historyCount: bundle.submissionHistory.length,
          activeCount: bundle.activeSubmissions.length,
        },
        updatedAt: new Date(),
      })
      .where(eq(identityMigrations.id, migration.id));

    // POST completion notification to origin (fire-and-forget)
    void this.sendCompletionNotification(env, migration, peerDomain).catch(
      () => {
        // Best-effort — origin will timeout if notification fails
      },
    );

    // Audit
    await auditService.logDirect({
      resource: AuditResources.MIGRATION,
      action: AuditActions.MIGRATION_BUNDLE_RECEIVED,
      resourceId: migration.id,
      newValue: {
        peerDomain,
        historyCount: bundle.submissionHistory.length,
        activeCount: bundle.activeSubmissions.length,
      },
    });

    return { migrationId: migration.id, status: 'accepted' };
  },

  /** Internal helper: send completion notification to origin. */
  async sendCompletionNotification(
    env: Env,
    migration: {
      id: string;
      peerInstanceUrl: string | null;
      userDid: string | null;
    },
    _peerDomain: string,
  ): Promise<void> {
    if (!migration.peerInstanceUrl) return;

    const devMode =
      process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test';
    await validateOutboundUrl(migration.peerInstanceUrl, { devMode });

    const config = await federationService.getOrInitConfig(env);
    const domain = env.FEDERATION_DOMAIN ?? 'localhost';
    const url = `${migration.peerInstanceUrl}/federation/v1/migrations/complete`;
    const body = JSON.stringify({
      migrationId: migration.id,
      destinationUserDid: migration.userDid ?? '',
      status: 'completed',
    } satisfies MigrationCompleteNotify);

    const { headers: signedHeaders } = signFederationRequest({
      method: 'POST',
      url,
      headers: { 'content-type': 'application/json' },
      body,
      privateKey: config.privateKey,
      keyId: `${domain}#main`,
    });

    await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...signedHeaders },
      body,
      signal: AbortSignal.timeout(10_000),
    });
  },

  /**
   * Handle migration broadcast from a peer.
   * Log audit event. No local action needed unless we have the user.
   */
  async handleMigrationBroadcast(
    _env: Env,
    peerDomain: string,
    broadcast: MigrationBroadcast,
  ): Promise<void> {
    await auditService.logDirect({
      resource: AuditResources.MIGRATION,
      action: AuditActions.MIGRATION_BROADCAST_RECEIVED,
      newValue: {
        peerDomain,
        userDid: broadcast.userDid,
        migratedToDomain: broadcast.migratedToDomain,
      },
    });
  },

  // ─── Origin-side ───

  /**
   * Handle inbound migration request from destination instance.
   *
   * Superuser queries — justified: S2S pre-auth context, no local user session.
   * Must find user by email across all orgs (user-level operation).
   */
  async handleMigrationRequest(
    env: Env,
    peerDomain: string,
    request: MigrationInitiateRequest,
  ): Promise<MigrationInitiateResponse> {
    // Validate that the claimed destination domain matches the HTTP-signature-authenticated
    // peer. Prevents a compromised peer from routing bundles to attacker-controlled endpoints.
    if (request.destinationDomain !== peerDomain) {
      throw new MigrationCapabilityError(
        `Authenticated peer '${peerDomain}' does not match claimed destination '${request.destinationDomain}'`,
      );
    }

    // Look up user by email (superuser — no local user session in S2S context)
    const [user] = await db
      .select({
        id: users.id,
        email: users.email,
        deletedAt: users.deletedAt,
        isGuest: users.isGuest,
        migratedAt: users.migratedAt,
      })
      .from(users)
      .where(eq(users.email, request.userEmail))
      .limit(1);

    if (!user || user.deletedAt || user.isGuest) {
      throw new MigrationUserNotFoundError(request.userEmail);
    }

    if (user.migratedAt) {
      throw new MigrationInvalidStateError('User has already migrated');
    }

    // Verify no active migration exists for user+outbound+peerDomain
    const [existingMigration] = await db
      .select({ id: identityMigrations.id })
      .from(identityMigrations)
      .where(
        and(
          eq(identityMigrations.userId, user.id),
          eq(identityMigrations.direction, 'outbound'),
          eq(identityMigrations.peerDomain, request.destinationDomain),
          not(inArray(identityMigrations.status, [...TERMINAL_STATUSES])),
        ),
      )
      .limit(1);

    if (existingMigration) {
      throw new MigrationAlreadyActiveError();
    }

    // Verify at least one org on this instance trusts peerDomain with identity.migrate
    // Superuser cross-org query — justified: user-level operation
    const [trustedPeer] = await db
      .select({ id: trustedPeers.id })
      .from(trustedPeers)
      .where(
        and(
          eq(trustedPeers.domain, request.destinationDomain),
          eq(trustedPeers.status, 'active'),
          sql`granted_capabilities @> '{"identity.migrate": true}'::jsonb`,
        ),
      )
      .limit(1);

    if (!trustedPeer) {
      throw new MigrationCapabilityError(request.destinationDomain);
    }

    // Create PENDING_APPROVAL record (superuser — no local user context in S2S)
    const migrationId = crypto.randomUUID();
    const domain = env.FEDERATION_DOMAIN ?? 'localhost';
    const emailLocal = user.email.split('@')[0];
    const encodedDomain = domainToDid(domain);
    const userDid = `did:web:${encodedDomain}:users:${emailLocal}`;

    await db.insert(identityMigrations).values({
      id: migrationId,
      userId: user.id,
      direction: 'outbound',
      peerDomain: request.destinationDomain,
      peerInstanceUrl: `https://${request.destinationDomain}`,
      userDid,
      peerUserDid: request.destinationUserDid,
      status: 'PENDING_APPROVAL',
      callbackUrl: request.callbackUrl,
    });

    // Audit (logDirect — no org context for S2S)
    await auditService.logDirect({
      resource: AuditResources.MIGRATION,
      action: AuditActions.MIGRATION_INBOUND_RECEIVED,
      resourceId: migrationId,
      actorId: user.id,
      newValue: {
        peerDomain: request.destinationDomain,
        userEmail: request.userEmail,
      },
    });

    return { migrationId, status: 'pending_approval' };
  },

  /**
   * User approves an outbound migration. Assembles bundle and sends to destination.
   */
  async approveMigration(
    env: Env,
    params: { userId: string; migrationId: string },
  ): Promise<void> {
    const { userId, migrationId } = params;

    // Fetch migration via user-scoped RLS
    const [migration] = await withRls({ userId }, async (tx) => {
      return tx
        .select()
        .from(identityMigrations)
        .where(eq(identityMigrations.id, migrationId))
        .limit(1);
    });

    if (!migration) {
      throw new MigrationNotFoundError(migrationId);
    }

    if (migration.status !== 'PENDING_APPROVAL') {
      throw new MigrationInvalidStateError(
        `Migration must be PENDING_APPROVAL to approve (current: ${migration.status})`,
      );
    }

    if (!migration.callbackUrl) {
      throw new MigrationInvalidStateError(
        'Migration record missing callback URL',
      );
    }

    // Get user details
    const [user] = await db
      .select({ email: users.email })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user) {
      throw new MigrationInvalidStateError('User not found');
    }

    // Assemble bundle
    const bundle = await migrationBundleService.assembleBundleForUser(env, {
      userId,
      userEmail: user.email,
      userDid: migration.userDid ?? '',
      destinationDomain: migration.peerDomain,
      destinationUserDid: migration.peerUserDid,
      migrationId,
    });

    // POST bundle to callback URL with HTTP signature
    // SSRF check — callbackUrl is remote-controlled, must validate before fetch
    const devMode =
      process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test';
    await validateOutboundUrl(migration.callbackUrl, { devMode });

    const config = await federationService.getOrInitConfig(env);
    const domain = env.FEDERATION_DOMAIN ?? 'localhost';
    const url = migration.callbackUrl;
    const body = JSON.stringify({
      migrationId,
      bundle,
    } satisfies MigrationBundleDelivery);

    const { headers: signedHeaders } = signFederationRequest({
      method: 'POST',
      url,
      headers: { 'content-type': 'application/json' },
      body,
      privateKey: config.privateKey,
      keyId: `${domain}#main`,
    });

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...signedHeaders },
      body,
      signal: AbortSignal.timeout(30_000),
    });

    if (!response.ok) {
      const errorBody = await response.text().catch(() => 'unknown');
      // Update status to FAILED
      await withRls({ userId }, async (tx) => {
        await tx
          .update(identityMigrations)
          .set({
            status: 'FAILED',
            failureReason: `Bundle delivery failed: ${response.status} ${errorBody}`,
            updatedAt: new Date(),
          })
          .where(eq(identityMigrations.id, migrationId));
      });
      throw new MigrationInvalidStateError(
        `Destination rejected bundle: ${response.status}`,
      );
    }

    // Update status → BUNDLE_SENT
    await withRls({ userId }, async (tx) => {
      await tx
        .update(identityMigrations)
        .set({
          status: 'BUNDLE_SENT',
          migrationToken: bundle.bundleToken,
          approvedAt: new Date(),
          bundleMetadata: {
            historyCount: bundle.submissionHistory.length,
            activeCount: bundle.activeSubmissions.length,
          },
          updatedAt: new Date(),
        })
        .where(eq(identityMigrations.id, migrationId));
    });

    // Audit
    await auditService.logDirect({
      resource: AuditResources.MIGRATION,
      action: AuditActions.MIGRATION_APPROVED,
      resourceId: migrationId,
      actorId: userId,
    });

    await auditService.logDirect({
      resource: AuditResources.MIGRATION,
      action: AuditActions.MIGRATION_BUNDLE_SENT,
      resourceId: migrationId,
      actorId: userId,
      newValue: {
        historyCount: bundle.submissionHistory.length,
        activeCount: bundle.activeSubmissions.length,
      },
    });
  },

  /**
   * User rejects an outbound migration request.
   */
  async rejectMigration(
    _env: Env,
    params: { userId: string; migrationId: string },
  ): Promise<void> {
    const { userId, migrationId } = params;

    const [migration] = await withRls({ userId }, async (tx) => {
      return tx
        .select()
        .from(identityMigrations)
        .where(eq(identityMigrations.id, migrationId))
        .limit(1);
    });

    if (!migration) {
      throw new MigrationNotFoundError(migrationId);
    }

    if (migration.status !== 'PENDING_APPROVAL') {
      throw new MigrationInvalidStateError(
        `Migration must be PENDING_APPROVAL to reject (current: ${migration.status})`,
      );
    }

    await withRls({ userId }, async (tx) => {
      await tx
        .update(identityMigrations)
        .set({ status: 'REJECTED', updatedAt: new Date() })
        .where(eq(identityMigrations.id, migrationId));
    });

    await auditService.logDirect({
      resource: AuditResources.MIGRATION,
      action: AuditActions.MIGRATION_REJECTED,
      resourceId: migrationId,
      actorId: userId,
    });
  },

  /**
   * Handle completion notification from destination.
   *
   * Superuser — S2S pre-auth, no local user session.
   */
  async handleMigrationComplete(
    env: Env,
    peerDomain: string,
    notify: MigrationCompleteNotify,
  ): Promise<void> {
    // Find migration by ID + peerDomain (superuser — S2S pre-auth)
    const [migration] = await db
      .select()
      .from(identityMigrations)
      .where(
        and(
          eq(identityMigrations.id, notify.migrationId),
          eq(identityMigrations.peerDomain, peerDomain),
          eq(identityMigrations.direction, 'outbound'),
        ),
      )
      .limit(1);

    if (!migration) {
      throw new MigrationNotFoundError(notify.migrationId);
    }

    // Soft-deactivate user
    await this.softDeactivateUser(
      migration.userId,
      peerDomain,
      notify.destinationUserDid,
    );

    // Update migration status → COMPLETED
    await db
      .update(identityMigrations)
      .set({
        status: 'COMPLETED',
        peerUserDid: notify.destinationUserDid,
        completedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(identityMigrations.id, migration.id));

    // Broadcast to all trusted peers
    await this.broadcastMigration(env, {
      userDid: migration.userDid ?? '',
      migratedToDomain: peerDomain,
      migratedToUserDid: notify.destinationUserDid,
    });

    // Audit
    await auditService.logDirect({
      resource: AuditResources.MIGRATION,
      action: AuditActions.MIGRATION_COMPLETED,
      resourceId: migration.id,
      actorId: migration.userId,
    });

    await auditService.logDirect({
      resource: AuditResources.USER,
      action: AuditActions.USER_SOFT_DEACTIVATED,
      resourceId: migration.userId,
      actorId: migration.userId,
      newValue: { migratedToDomain: peerDomain },
    });
  },

  /**
   * Soft-deactivate a user after migration.
   * Superuser — user lifecycle operation (same justification as GDPR deletion).
   */
  async softDeactivateUser(
    userId: string,
    domain: string,
    did: string,
  ): Promise<void> {
    await db
      .update(users)
      .set({
        migratedToDomain: domain,
        migratedToDid: did,
        migratedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId));
  },

  /**
   * Broadcast migration to all trusted peers with identity.migrate capability.
   * Superuser cross-org query — justified: user-level broadcast, no single org context.
   */
  async broadcastMigration(
    env: Env,
    params: {
      userDid: string;
      migratedToDomain: string;
      migratedToUserDid: string;
    },
  ): Promise<void> {
    const config = await federationService.getOrInitConfig(env);
    const domain = env.FEDERATION_DOMAIN ?? 'localhost';

    // Query all active trusted peers with identity.migrate capability
    const peerLimit = 500;
    const peers = await db
      .select({
        instanceUrl: trustedPeers.instanceUrl,
        domain: trustedPeers.domain,
      })
      .from(trustedPeers)
      .where(
        and(
          eq(trustedPeers.status, 'active'),
          sql`granted_capabilities @> '{"identity.migrate": true}'::jsonb`,
        ),
      )
      .limit(peerLimit);

    if (peers.length >= peerLimit) {
      console.warn(
        'Migration broadcast peer limit reached (%d); some peers may not be notified',
        peerLimit,
      );
    }

    // Deduplicate by domain (may be trusted by multiple orgs)
    const uniquePeers = new Map<string, string>();
    for (const p of peers) {
      if (!uniquePeers.has(p.domain)) {
        uniquePeers.set(p.domain, p.instanceUrl);
      }
    }

    const broadcast: MigrationBroadcast = {
      userDid: params.userDid,
      migratedToDomain: params.migratedToDomain,
      migratedToUserDid: params.migratedToUserDid,
      originDomain: domain,
    };

    // Fire-and-forget POST to each peer
    const devMode =
      process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test';
    for (const [peerDomain, instanceUrl] of uniquePeers) {
      // Skip the destination — they already know
      if (peerDomain === params.migratedToDomain) continue;

      const url = `${instanceUrl}/federation/v1/migrations/broadcast`;
      const body = JSON.stringify(broadcast);

      const { headers: signedHeaders } = signFederationRequest({
        method: 'POST',
        url,
        headers: { 'content-type': 'application/json' },
        body,
        privateKey: config.privateKey,
        keyId: `${domain}#main`,
      });

      // Fire-and-forget — SSRF validated before fetch
      void validateOutboundUrl(url, { devMode })
        .then(() =>
          fetch(url, {
            method: 'POST',
            headers: {
              'content-type': 'application/json',
              ...signedHeaders,
            },
            body,
            signal: AbortSignal.timeout(10_000),
          }),
        )
        .catch(() => {
          // Best-effort broadcast
        });
    }

    await auditService.logDirect({
      resource: AuditResources.MIGRATION,
      action: AuditActions.MIGRATION_BROADCAST_SENT,
      newValue: {
        userDid: params.userDid,
        migratedToDomain: params.migratedToDomain,
        peerCount: uniquePeers.size,
      },
    });
  },

  // ─── File serving ───

  /**
   * Verify a migration token for file serving.
   *
   * Superuser — pre-auth token validation (same pattern as transfer.service.ts).
   */
  async verifyMigrationToken(
    env: Env,
    token: string,
    migrationId: string,
    submissionId: string,
    fileId: string,
  ): Promise<{ userId: string }> {
    // Look up migration
    const [migration] = await db
      .select({
        id: identityMigrations.id,
        userId: identityMigrations.userId,
        status: identityMigrations.status,
      })
      .from(identityMigrations)
      .where(eq(identityMigrations.id, migrationId))
      .limit(1);

    if (!migration) {
      throw new MigrationTokenError(`Migration not found: ${migrationId}`);
    }

    if (
      migration.status !== 'BUNDLE_SENT' &&
      migration.status !== 'PROCESSING'
    ) {
      throw new MigrationTokenError(
        `Migration in invalid state for file serving: ${migration.status}`,
      );
    }

    // Verify JWT using local instance's public key
    const config = await federationService.getOrInitConfig(env);
    const publicKeyObj = crypto.createPublicKey(config.publicKey);

    let claims: jose.JWTPayload;
    try {
      const { payload } = await jose.jwtVerify(token, publicKeyObj);
      claims = payload;
    } catch (err) {
      throw new MigrationTokenError(
        `Token verification failed: ${err instanceof Error ? err.message : 'invalid'}`,
      );
    }

    // Verify jti matches migrationId
    if (claims.jti !== migrationId) {
      throw new MigrationTokenError('Token jti does not match migration ID');
    }

    // Verify fileId is in the allowed list
    const allowedFileIds = (claims as Record<string, unknown>).fileIds as
      | string[]
      | undefined;
    if (!allowedFileIds || !allowedFileIds.includes(fileId)) {
      throw new MigrationTokenError('File ID not in migration allowlist');
    }

    // Defense-in-depth: verify submissionId belongs to migration user
    const [sub] = await db
      .select({ id: submissions.id })
      .from(submissions)
      .where(
        and(
          eq(submissions.id, submissionId),
          eq(submissions.submitterId, migration.userId),
        ),
      )
      .limit(1);

    if (!sub) {
      throw new MigrationTokenError(
        'Submission does not belong to migration user',
      );
    }

    return { userId: migration.userId };
  },

  /**
   * Stream a file for a verified migration file serve request.
   */
  async getFileStream(
    _env: Env,
    fileId: string,
  ): Promise<{
    stream: Readable;
    filename: string;
    mimeType: string;
    size: number;
  }> {
    // Look up file (superuser — pre-auth file serving)
    const [file] = await db
      .select({
        id: files.id,
        filename: files.filename,
        mimeType: files.mimeType,
        size: files.size,
        storageKey: files.storageKey,
        scanStatus: files.scanStatus,
      })
      .from(files)
      .where(eq(files.id, fileId))
      .limit(1);

    if (!file || file.scanStatus !== 'CLEAN') {
      throw new MigrationTokenError(`File not found or not clean: ${fileId}`);
    }

    const storage = getGlobalRegistry().resolve<S3StorageAdapter>('storage');
    const stream = await storage.downloadFromBucket(
      storage.defaultBucket,
      file.storageKey,
    );

    return {
      stream,
      filename: file.filename,
      mimeType: file.mimeType,
      size: Number(file.size),
    };
  },

  // ─── Query methods (user-scoped RLS) ───

  async getMigrationById(
    userId: string,
    migrationId: string,
  ): Promise<IdentityMigration> {
    const [migration] = await withRls({ userId }, async (tx) => {
      return tx
        .select()
        .from(identityMigrations)
        .where(eq(identityMigrations.id, migrationId))
        .limit(1);
    });

    if (!migration) {
      throw new MigrationNotFoundError(migrationId);
    }

    return migration as IdentityMigration;
  },

  async listMigrationsForUser(
    userId: string,
    query: MigrationListQuery,
  ): Promise<{ migrations: IdentityMigration[]; total: number }> {
    const { page, limit, direction, status } = query;
    const offset = (page - 1) * limit;

    return withRls({ userId }, async (tx) => {
      const conditions = [eq(identityMigrations.userId, userId)];
      if (direction) {
        conditions.push(eq(identityMigrations.direction, direction));
      }
      if (status) {
        conditions.push(eq(identityMigrations.status, status));
      }

      const where = and(...conditions);

      const [rows, countResult] = await Promise.all([
        tx
          .select()
          .from(identityMigrations)
          .where(where)
          .orderBy(sql`created_at DESC`)
          .limit(limit)
          .offset(offset),
        tx.select({ count: count() }).from(identityMigrations).where(where),
      ]);

      return {
        migrations: rows as IdentityMigration[],
        total: countResult[0]?.count ?? 0,
      };
    });
  },

  async getPendingApprovalForUser(
    userId: string,
  ): Promise<IdentityMigration[]> {
    return withRls({ userId }, async (tx) => {
      const rows = await tx
        .select()
        .from(identityMigrations)
        .where(
          and(
            eq(identityMigrations.userId, userId),
            eq(identityMigrations.status, 'PENDING_APPROVAL'),
            eq(identityMigrations.direction, 'outbound'),
          ),
        )
        .orderBy(sql`${identityMigrations.createdAt} DESC`)
        .limit(100);
      return rows as IdentityMigration[];
    });
  },

  async cancelMigration(userId: string, migrationId: string): Promise<void> {
    const [migration] = await withRls({ userId }, async (tx) => {
      return tx
        .select()
        .from(identityMigrations)
        .where(eq(identityMigrations.id, migrationId))
        .limit(1);
    });

    if (!migration) {
      throw new MigrationNotFoundError(migrationId);
    }

    if ((TERMINAL_STATUSES as readonly string[]).includes(migration.status)) {
      throw new MigrationInvalidStateError(
        `Cannot cancel migration in ${migration.status} state`,
      );
    }

    await withRls({ userId }, async (tx) => {
      await tx
        .update(identityMigrations)
        .set({ status: 'CANCELLED', updatedAt: new Date() })
        .where(eq(identityMigrations.id, migrationId));
    });

    await auditService.logDirect({
      resource: AuditResources.MIGRATION,
      action: AuditActions.MIGRATION_CANCELLED,
      resourceId: migrationId,
      actorId: userId,
    });
  },
};
