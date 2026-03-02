import {
  db,
  withRls,
  manuscriptVersions,
  manuscripts,
  submissions,
  submissionPeriods,
  publications,
  users,
  simSubChecks,
  externalSubmissions,
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
  type SimSubPolicy,
  type SimSubPolicyType,
  type SiblingVersionConflict,
  type WriterDisclosedConflict,
} from '@colophony/types';
import type { Env } from '../config/env.js';
import { auditService } from './audit.service.js';
import { federationService, domainToDid } from './federation.service.js';
import { fingerprintService } from './fingerprint.service.js';
import { signFederationRequest } from '../federation/http-signatures.js';
import { hubClientService } from './hub-client.service.js';
import { validateOutboundUrl } from '../lib/url-validation.js';

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
const ACTIVE_CSR_STATUSES = ['sent', 'in_review', 'hold'] as const;

// ---------------------------------------------------------------------------
// Pure function: Policy resolution with genre overrides
// ---------------------------------------------------------------------------

/**
 * Resolve the effective sim-sub policy type, applying genre overrides if any.
 */
export function resolveEffectivePolicy(
  policy: SimSubPolicy,
  primaryGenre: string | null | undefined,
): SimSubPolicyType {
  if (primaryGenre && policy.genreOverrides) {
    const override = policy.genreOverrides.find(
      (o) => o.genre === primaryGenre,
    );
    if (override) {
      return override.type;
    }
  }
  return policy.type;
}

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
   *    to find active submissions. Policy filtering is caller's responsibility.
   *
   * @param column Which fingerprint column to match against (default: 'content')
   */
  async checkLocal(
    submitterUserId: string,
    fingerprint: string,
    excludeSubmissionId?: string,
    column: 'content' | 'federation' = 'content',
  ): Promise<SimSubConflict[]> {
    // Phase 1: User-scoped RLS — find versions with matching fingerprint
    const fingerprintColumn =
      column === 'federation'
        ? manuscriptVersions.federationFingerprint
        : manuscriptVersions.contentFingerprint;

    const matchingVersionIds = await withRls(
      { userId: submitterUserId },
      async (tx) => {
        const rows = await tx
          .select({ id: manuscriptVersions.id })
          .from(manuscriptVersions)
          .where(eq(fingerprintColumn, fingerprint));
        return rows.map((r) => r.id);
      },
    );

    if (matchingVersionIds.length === 0) {
      return [];
    }

    // Phase 2: Superuser — cross-org join to find active submissions.
    // Returns ALL active submissions regardless of period policy.
    // Policy filtering is the caller's responsibility (preSubmitCheck).
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
          ...(excludeSubmissionId
            ? [sql`${submissions.id} != ${excludeSubmissionId}`]
            : []),
        ),
      )
      .limit(100);

    return conflicts.map((c) => ({
      publicationName: c.publicationName ?? 'Unknown Publication',
      submittedAt: c.submittedAt?.toISOString() ?? new Date().toISOString(),
      periodName: c.periodName,
    }));
  },

  /**
   * Check for active submissions on sibling versions of the same manuscript.
   *
   * Two-phase RLS:
   * Phase 1 (user-scoped): find manuscriptId, then all other version IDs
   * Phase 2 (superuser): find active submissions on those versions
   */
  async checkSiblingVersions(
    submitterUserId: string,
    manuscriptVersionId: string,
    excludeSubmissionId?: string,
  ): Promise<SiblingVersionConflict[]> {
    // Phase 1: User-scoped — find manuscript and other versions
    const siblingVersionIds = await withRls(
      { userId: submitterUserId },
      async (tx) => {
        const [version] = await tx
          .select({ manuscriptId: manuscriptVersions.manuscriptId })
          .from(manuscriptVersions)
          .where(eq(manuscriptVersions.id, manuscriptVersionId))
          .limit(1);

        if (!version) return [];

        const siblings = await tx
          .select({
            id: manuscriptVersions.id,
            versionNumber: manuscriptVersions.versionNumber,
          })
          .from(manuscriptVersions)
          .where(
            and(
              eq(manuscriptVersions.manuscriptId, version.manuscriptId),
              sql`${manuscriptVersions.id} != ${manuscriptVersionId}`,
            ),
          )
          .limit(50);

        return siblings;
      },
    );

    if (siblingVersionIds.length === 0) {
      return [];
    }

    // Phase 2: Superuser — find active submissions on sibling versions
    const versionIds = siblingVersionIds.map((v) => v.id);
    const versionMap = new Map(
      siblingVersionIds.map((v) => [v.id, v.versionNumber]),
    );

    const results = await db
      .select({
        submissionId: submissions.id,
        manuscriptVersionId: submissions.manuscriptVersionId,
        publicationName: publications.name,
        status: submissions.status,
        submittedAt: submissions.submittedAt,
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
          inArray(submissions.manuscriptVersionId, versionIds),
          inArray(submissions.status, [...ACTIVE_STATUSES]),
          ...(excludeSubmissionId
            ? [sql`${submissions.id} != ${excludeSubmissionId}`]
            : []),
        ),
      )
      .limit(50);

    return results.map((r) => ({
      versionId: r.manuscriptVersionId!,
      versionNumber: versionMap.get(r.manuscriptVersionId!) ?? 0,
      submissionId: r.submissionId,
      publicationName: r.publicationName ?? 'Unknown Publication',
      status: r.status,
      submittedAt: r.submittedAt?.toISOString() ?? null,
    }));
  },

  /**
   * Check writer-disclosed external submissions for the same manuscript.
   * User-scoped RLS only.
   */
  async checkWriterDisclosed(
    submitterUserId: string,
    manuscriptId: string,
  ): Promise<WriterDisclosedConflict[]> {
    const results = await withRls({ userId: submitterUserId }, async (tx) => {
      return tx
        .select({
          id: externalSubmissions.id,
          journalName: externalSubmissions.journalName,
          status: externalSubmissions.status,
          sentAt: externalSubmissions.sentAt,
        })
        .from(externalSubmissions)
        .where(
          and(
            eq(externalSubmissions.manuscriptId, manuscriptId),
            inArray(externalSubmissions.status, [...ACTIVE_CSR_STATUSES]),
          ),
        )
        .limit(100);
    });

    return results.map((r) => ({
      externalSubmissionId: r.id,
      journalName: r.journalName,
      status: r.status,
      sentAt: r.sentAt?.toISOString() ?? null,
    }));
  },

  /**
   * Handle an inbound S2S sim-sub check from a federated instance.
   *
   * Resolves the submitter DID to a local user, then delegates to checkLocal
   * using the federation fingerprint column.
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

    // Use federation fingerprint column for S2S checks
    const conflicts = await this.checkLocal(
      user.id,
      fingerprint,
      undefined,
      'federation',
    );
    return { found: conflicts.length > 0, conflicts };
  },

  /**
   * Fan out sim-sub checks to trusted federated peers.
   * Validates outbound URLs against SSRF before making requests.
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
    const devMode = env.NODE_ENV !== 'production';

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
        // SSRF validation before outbound fetch
        await validateOutboundUrl(url, { devMode });

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
   * Perform a full sim-sub check: local + remote + version-aware, record result.
   */
  async performFullCheck(
    env: Env,
    submissionId: string,
    manuscriptVersionId: string,
    submitterUserId: string,
    orgId: string,
  ): Promise<SimSubFullCheckResult> {
    // Compute both fingerprints (uses withRls internally)
    const { contentFingerprint, federationFingerprint } = await withRls(
      { userId: submitterUserId },
      async (tx) => {
        return fingerprintService.getOrCompute(tx, manuscriptVersionId);
      },
    );

    // Resolve manuscriptId for version-aware checks
    const manuscriptId = await withRls(
      { userId: submitterUserId },
      async (tx) => {
        const [version] = await tx
          .select({ manuscriptId: manuscriptVersions.manuscriptId })
          .from(manuscriptVersions)
          .where(eq(manuscriptVersions.id, manuscriptVersionId))
          .limit(1);
        return version?.manuscriptId;
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

    // Run all checks in parallel
    const [
      localConflicts,
      remoteResults,
      siblingVersionConflicts,
      writerDisclosedConflicts,
    ] = await Promise.all([
      this.checkLocal(submitterUserId, contentFingerprint, submissionId),
      this.checkRemote(env, federationFingerprint, submitterDid, orgId),
      this.checkSiblingVersions(
        submitterUserId,
        manuscriptVersionId,
        submissionId,
      ),
      manuscriptId
        ? this.checkWriterDisclosed(submitterUserId, manuscriptId)
        : Promise.resolve([]),
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
    if (
      allConflicts.length > 0 ||
      siblingVersionConflicts.length > 0 ||
      writerDisclosedConflicts.length > 0
    ) {
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
        fingerprint: contentFingerprint,
        federationFingerprint,
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
        newValue: {
          result,
          fingerprint: contentFingerprint,
          federationFingerprint,
          localConflicts,
          remoteResults,
          siblingVersionConflicts,
          writerDisclosedConflicts,
        },
      });
    });

    // Push fingerprint to hub (fire-and-forget)
    if (env.HUB_DOMAIN) {
      hubClientService
        .pushFingerprint(env, {
          fingerprint: federationFingerprint,
          submitterDid,
          submittedAt: new Date().toISOString(),
        })
        .catch(() => {
          /* best-effort */
        });
    }

    return {
      result,
      fingerprint: contentFingerprint,
      federationFingerprint,
      localConflicts,
      remoteResults,
      siblingVersionConflicts,
      writerDisclosedConflicts,
    };
  },

  /**
   * Pre-submit sim-sub check. Call before `submitAsOwner`.
   *
   * Uses the period's sim_sub_policy JSONB (replacing the old boolean).
   * Resolves genre overrides via manuscript genre.
   * For 'prohibited' + CONFLICT: throws SimSubConflictError.
   * For 'allowed_notify'/'allowed_withdraw' + CONFLICT: records requirement.
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

    // Load period's policy
    const [period] = await tx
      .select({ simSubPolicy: submissionPeriods.simSubPolicy })
      .from(submissionPeriods)
      .where(eq(submissionPeriods.id, submission.submissionPeriodId))
      .limit(1);

    if (!period?.simSubPolicy) {
      return;
    }

    const policy = period.simSubPolicy as SimSubPolicy;

    // Load manuscript genre for genre override resolution
    const [version] = await tx
      .select({ manuscriptId: manuscriptVersions.manuscriptId })
      .from(manuscriptVersions)
      .where(eq(manuscriptVersions.id, submission.manuscriptVersionId))
      .limit(1);

    let primaryGenre: string | null = null;
    if (version?.manuscriptId) {
      const [manuscript] = await tx
        .select({ genre: manuscripts.genre })
        .from(manuscripts)
        .where(eq(manuscripts.id, version.manuscriptId))
        .limit(1);
      primaryGenre =
        (manuscript?.genre as { primary?: string } | null)?.primary ?? null;
    }

    const effectiveType = resolveEffectivePolicy(policy, primaryGenre);

    if (effectiveType === 'allowed') {
      return; // No sim-sub enforcement
    }

    // Run full check
    const result = await this.performFullCheck(
      env,
      submissionId,
      submission.manuscriptVersionId,
      submitterId,
      orgId,
    );

    if (result.result !== 'CONFLICT') {
      return; // No conflicts found
    }

    if (effectiveType === 'prohibited') {
      throw new SimSubConflictError(
        result.localConflicts,
        result.remoteResults,
      );
    }

    // For allowed_notify / allowed_withdraw: record the requirement
    const requirementType =
      effectiveType === 'allowed_notify' ? 'notify' : 'withdraw';
    const windowHours = policy.notifyWindowHours;
    const dueAt = windowHours
      ? new Date(
          new Date().getTime() + windowHours * 60 * 60 * 1000,
        ).toISOString()
      : undefined;

    await tx
      .update(submissions)
      .set({
        simSubPolicyRequirement: {
          type: requirementType,
          windowHours,
          dueAt,
        },
      })
      .where(eq(submissions.id, submissionId));
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
