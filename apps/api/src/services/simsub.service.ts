import {
  db,
  withRls,
  manuscriptVersions,
  submissions,
  submissionPeriods,
  publications,
  users,
  simSubChecks,
  eq,
  and,
  isNull,
  inArray,
  sql,
} from '@colophony/db';
import {
  AuditActions,
  AuditResources,
  simSubCheckResponseSchema,
  type SimSubConflict,
  type SimSubRemoteResult,
  type SimSubFullCheckResult,
  type SimSubCheckResponse,
} from '@colophony/types';
import type { Env } from '../config/env.js';
import { auditService } from './audit.service.js';
import { federationService, domainToDid } from './federation.service.js';
import { fingerprintService } from './fingerprint.service.js';
import { signFederationRequest } from '../federation/http-signatures.js';
import { hubClientService } from './hub-client.service.js';

// ---------------------------------------------------------------------------
// Error classes
// ---------------------------------------------------------------------------

export class SimSubConflictError extends Error {
  override name = 'SimSubConflictError' as const;
  conflicts: SimSubConflict[];
  remoteResults: SimSubRemoteResult[];

  constructor(
    conflicts: SimSubConflict[],
    remoteResults: SimSubRemoteResult[],
  ) {
    super(
      `Simultaneous submission conflict: ${conflicts.length} active submission(s) found`,
    );
    this.conflicts = conflicts;
    this.remoteResults = remoteResults;
  }
}

// ---------------------------------------------------------------------------
// Active submission statuses for sim-sub conflict detection
// ---------------------------------------------------------------------------

const ACTIVE_STATUSES = ['SUBMITTED', 'UNDER_REVIEW', 'HOLD'] as const;

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export const simsubService = {
  /**
   * Check local submissions for sim-sub conflicts.
   *
   * Two-phase query (RLS + justified superuser):
   * 1. User-scoped RLS: find manuscript versions with matching fingerprint
   *    that the submitter owns. Confirms fingerprint ownership.
   * 2. Superuser: cross-org join from those versions → submissions → periods
   *    to find active submissions at no-sim-sub publications. Justified:
   *    ownership confirmed in phase 1; narrow read-only cross-org query.
   *    Same pattern as trust.service.ts superuser queries.
   */
  async checkLocal(
    submitterUserId: string,
    fingerprint: string,
    excludeSubmissionId?: string,
  ): Promise<SimSubConflict[]> {
    // Phase 1: User-scoped RLS — find versions with matching fingerprint
    const matchingVersionIds = await withRls(
      { userId: submitterUserId },
      async (tx) => {
        const rows = await tx
          .select({ id: manuscriptVersions.id })
          .from(manuscriptVersions)
          .where(eq(manuscriptVersions.contentFingerprint, fingerprint));
        return rows.map((r) => r.id);
      },
    );

    if (matchingVersionIds.length === 0) {
      return [];
    }

    // Phase 2: Superuser — cross-org join to find active submissions.
    // Justified: fingerprint ownership confirmed via user-scoped RLS above.
    // This is a narrow, read-only cross-org query. Same pattern as
    // trust.service.ts handleInboundTrustRequest superuser queries.
    const conflicts = await db
      .select({
        submissionId: submissions.id,
        publicationName: publications.name,
        submittedAt: submissions.submittedAt,
        periodName: submissionPeriods.name,
      })
      .from(submissions)
      .innerJoin(
        submissionPeriods,
        eq(submissions.submissionPeriodId, submissionPeriods.id),
      )
      .leftJoin(
        publications,
        eq(submissionPeriods.publicationId, publications.id),
      )
      .where(
        and(
          inArray(submissions.manuscriptVersionId, matchingVersionIds),
          inArray(submissions.status, [...ACTIVE_STATUSES]),
          eq(submissionPeriods.simSubProhibited, true),
          ...(excludeSubmissionId
            ? [sql`${submissions.id} != ${excludeSubmissionId}`]
            : []),
        ),
      );

    return conflicts.map((c) => ({
      publicationName: c.publicationName ?? 'Unknown Publication',
      submittedAt: c.submittedAt?.toISOString() ?? new Date().toISOString(),
      periodName: c.periodName,
    }));
  },

  /**
   * Handle an inbound S2S sim-sub check from a federated instance.
   *
   * Resolves the submitter DID to a local user, then delegates to checkLocal.
   */
  async handleInboundCheck(
    _env: Env,
    submitterDid: string,
    fingerprint: string,
  ): Promise<SimSubCheckResponse> {
    // Parse DID: did:web:<domain>:users:<localPart>
    const didMatch = submitterDid.match(/^did:web:([^:]+):users:([^#]+)$/);
    if (!didMatch) {
      return { found: false, conflicts: [] };
    }

    const [, encodedDomain, localPart] = didMatch;
    let domain: string;
    try {
      domain = decodeURIComponent(encodedDomain);
    } catch {
      return { found: false, conflicts: [] };
    }

    // Resolve to local user via exact email match
    // Strip port from domain for email matching (same as getUserDidDocument)
    const emailDomain = domain.replace(/:\d+$/, '');
    const email = `${localPart}@${emailDomain}`;

    // Superuser query — justified: cross-org user lookup, same as getUserDidDocument
    const [user] = await db
      .select({ id: users.id })
      .from(users)
      .where(
        and(
          eq(users.email, email),
          isNull(users.deletedAt),
          eq(users.isGuest, false),
        ),
      )
      .limit(1);

    if (!user) {
      return { found: false, conflicts: [] };
    }

    const conflicts = await this.checkLocal(user.id, fingerprint);
    return { found: conflicts.length > 0, conflicts };
  },

  /**
   * Fan out sim-sub checks to trusted federated peers.
   */
  async checkRemote(
    env: Env,
    fingerprint: string,
    submitterDid: string,
    orgId: string,
  ): Promise<SimSubRemoteResult[]> {
    if (!env.FEDERATION_ENABLED) {
      return [];
    }

    const config = await federationService.getOrInitConfig(env);
    if (!config.enabled) {
      return [];
    }

    const domain = env.FEDERATION_DOMAIN ?? 'localhost';

    // Hub-first path: if HUB_DOMAIN is set, query centralized index
    let hubResults: SimSubRemoteResult[] = [];
    let hubResponded = false;
    if (env.HUB_DOMAIN) {
      const hubResult = await hubClientService.queryHubFingerprints(
        env,
        fingerprint,
        submitterDid,
      );
      if (hubResult) {
        hubResponded = true;
        hubResults = hubResult.conflicts.map((c) => ({
          domain: c.sourceDomain,
          status: 'checked' as const,
          found: true,
          conflicts: [
            {
              publicationName: c.publicationName ?? 'Unknown',
              submittedAt: c.submittedAt ?? new Date().toISOString(),
            },
          ],
          durationMs: 0,
        }));
      }
    }

    // Query active trusted peers with simsub.respond capability.
    // If hub responded, skip hub-attested peers (they're covered by the hub index).
    // Self-hosted peers (hub_attested = false) still get direct fan-out.
    const peerFilter = hubResponded
      ? sql`status = 'active' AND granted_capabilities @> '{"simsub.respond": true}'::jsonb AND hub_attested = false`
      : sql`status = 'active' AND granted_capabilities @> '{"simsub.respond": true}'::jsonb`;

    const peers = await withRls({ orgId }, async (tx) => {
      return tx
        .select({
          peerDomain: sql<string>`DISTINCT ON (domain) domain`,
          instanceUrl: sql<string>`instance_url`,
        })
        .from(sql`trusted_peers`)
        .where(peerFilter);
    });

    if (peers.length === 0 && hubResults.length === 0) {
      return hubResults;
    }

    if (peers.length === 0) {
      return hubResults;
    }

    const results: SimSubRemoteResult[] = [...hubResults];
    const body = JSON.stringify({
      fingerprint,
      submitterDid,
      requestingDomain: domain,
      protocolVersion: '1.0',
    });

    const checkPromises = peers.map(async (peer) => {
      const url = `${peer.instanceUrl}/federation/v1/sim-sub/check`;
      const start = Date.now();

      try {
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
          headers: {
            'content-type': 'application/json',
            ...signedHeaders,
          },
          body,
          signal: AbortSignal.timeout(2000),
        });

        const durationMs = Date.now() - start;

        if (!response.ok) {
          return {
            domain: peer.peerDomain,
            status: 'error' as const,
            durationMs,
          };
        }

        const json = await response.json();
        const parsed = simSubCheckResponseSchema.safeParse(json);
        if (!parsed.success) {
          return {
            domain: peer.peerDomain,
            status: 'error' as const,
            durationMs,
          };
        }

        return {
          domain: peer.peerDomain,
          status: 'checked' as const,
          found: parsed.data.found,
          conflicts: parsed.data.conflicts,
          durationMs,
        };
      } catch (err) {
        const durationMs = Date.now() - start;
        if (err instanceof DOMException && err.name === 'TimeoutError') {
          return {
            domain: peer.peerDomain,
            status: 'timeout' as const,
            durationMs,
          };
        }
        return {
          domain: peer.peerDomain,
          status: 'unreachable' as const,
          durationMs,
        };
      }
    });

    const settled = await Promise.all(checkPromises);
    results.push(...settled);
    return results;
  },

  /**
   * Perform a full sim-sub check: local + remote, record result.
   *
   * Runs outside the caller's DB transaction (uses its own withRls calls).
   * The request-scoped dbContext transaction is still open but this HTTP
   * fanout has a 2s timeout cap and the platform is low-traffic.
   */
  async performFullCheck(
    env: Env,
    submissionId: string,
    manuscriptVersionId: string,
    submitterUserId: string,
    orgId: string,
  ): Promise<SimSubFullCheckResult> {
    // Compute fingerprint (uses withRls internally via caller's tx or own)
    const fingerprint = await withRls(
      { userId: submitterUserId },
      async (tx) => {
        return fingerprintService.getOrCompute(tx, manuscriptVersionId);
      },
    );

    // Build submitter DID (encode port-bearing domains per did:web spec)
    const rawDomain = env.FEDERATION_DOMAIN ?? 'localhost';
    const encodedDomain = domainToDid(rawDomain);
    const [user] = await db
      .select({ email: users.email })
      .from(users)
      .where(eq(users.id, submitterUserId))
      .limit(1);

    const emailLocal = user?.email?.split('@')[0] ?? submitterUserId;
    const submitterDid = `did:web:${encodedDomain}:users:${emailLocal}`;

    // Run local + remote checks in parallel
    const [localConflicts, remoteResults] = await Promise.all([
      this.checkLocal(submitterUserId, fingerprint, submissionId),
      this.checkRemote(env, fingerprint, submitterDid, orgId),
    ]);

    // Aggregate result
    const allConflicts = [
      ...localConflicts,
      ...remoteResults.flatMap((r) => r.conflicts ?? []),
    ];
    const hasUnreachable = remoteResults.some(
      (r) =>
        r.status === 'unreachable' ||
        r.status === 'timeout' ||
        r.status === 'error',
    );

    let result: 'CLEAR' | 'CONFLICT' | 'PARTIAL';
    if (allConflicts.length > 0) {
      result = 'CONFLICT';
    } else if (hasUnreachable) {
      result = 'PARTIAL';
    } else {
      result = 'CLEAR';
    }

    // Record check in sim_sub_checks and update submission
    await withRls({ orgId }, async (tx) => {
      await tx.insert(simSubChecks).values({
        submissionId,
        fingerprint,
        submitterDid,
        result,
        localConflicts,
        remoteResults,
      });

      await tx
        .update(submissions)
        .set({
          simSubCheckResult: result,
          simSubCheckedAt: new Date(),
        })
        .where(eq(submissions.id, submissionId));

      // Audit
      const auditAction =
        result === 'CONFLICT'
          ? AuditActions.SIMSUB_CONFLICT_FOUND
          : AuditActions.SIMSUB_CHECK_PERFORMED;
      await auditService.log(tx, {
        resource: AuditResources.SIMSUB,
        action: auditAction,
        resourceId: submissionId,
        organizationId: orgId,
        actorId: submitterUserId,
        newValue: { result, fingerprint, localConflicts, remoteResults },
      });
    });

    // Push fingerprint to hub (fire-and-forget, after local recording)
    if (env.HUB_DOMAIN) {
      hubClientService
        .pushFingerprint(env, {
          fingerprint,
          submitterDid,
          submittedAt: new Date().toISOString(),
        })
        .catch(() => {
          /* best-effort */
        });
    }

    return { result, fingerprint, localConflicts, remoteResults };
  },

  /**
   * Pre-submit sim-sub check. Call before `submitAsOwner`.
   *
   * Reads the submission's metadata from the request-scoped transaction,
   * then runs the full check outside it (own withRls calls).
   * Throws SimSubConflictError if conflicts are found.
   */
  async preSubmitCheck(
    env: Env,
    tx: import('@colophony/db').DrizzleDb,
    submissionId: string,
    submitterId: string,
    orgId: string,
  ): Promise<void> {
    // Read submission to get relevant fields
    const [submission] = await tx
      .select({
        manuscriptVersionId: submissions.manuscriptVersionId,
        submissionPeriodId: submissions.submissionPeriodId,
        simSubOverride: submissions.simSubOverride,
      })
      .from(submissions)
      .where(eq(submissions.id, submissionId))
      .limit(1);

    if (
      !submission?.manuscriptVersionId ||
      !submission.submissionPeriodId ||
      submission.simSubOverride
    ) {
      return; // No manuscript, no period, or already overridden — skip
    }

    // Check if the period prohibits sim-sub
    const [period] = await tx
      .select({ simSubProhibited: submissionPeriods.simSubProhibited })
      .from(submissionPeriods)
      .where(eq(submissionPeriods.id, submission.submissionPeriodId))
      .limit(1);

    if (!period?.simSubProhibited) {
      return; // Period allows sim-sub
    }

    // Run full check (outside svc.tx — uses own withRls calls)
    const result = await this.performFullCheck(
      env,
      submissionId,
      submission.manuscriptVersionId,
      submitterId,
      orgId,
    );

    if (result.result === 'CONFLICT') {
      throw new SimSubConflictError(
        result.localConflicts,
        result.remoteResults,
      );
    }
  },

  /**
   * Grant an admin override on a sim-sub conflict.
   */
  async grantOverride(
    orgId: string,
    submissionId: string,
    adminUserId: string,
  ): Promise<void> {
    await withRls({ orgId }, async (tx) => {
      // Set override on submission
      await tx
        .update(submissions)
        .set({ simSubOverride: true })
        .where(eq(submissions.id, submissionId));

      // Update latest check with override info
      const [latestCheck] = await tx
        .select({ id: simSubChecks.id })
        .from(simSubChecks)
        .where(eq(simSubChecks.submissionId, submissionId))
        .orderBy(sql`created_at DESC`)
        .limit(1);

      if (latestCheck) {
        await tx
          .update(simSubChecks)
          .set({
            overriddenBy: adminUserId,
            overriddenAt: new Date(),
          })
          .where(eq(simSubChecks.id, latestCheck.id));
      }

      // Audit
      await auditService.log(tx, {
        resource: AuditResources.SIMSUB,
        action: AuditActions.SIMSUB_OVERRIDE_GRANTED,
        resourceId: submissionId,
        organizationId: orgId,
        actorId: adminUserId,
      });
    });
  },
};
