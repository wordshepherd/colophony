import {
  db,
  withRls,
  trustedPeers,
  organizations,
  eq,
  and,
} from '@colophony/db';
import {
  AuditActions,
  AuditResources,
  federationMetadataSchema,
  type TrustRequest,
  type TrustAccept,
  type InitiateTrustInput,
  type PeerActionInput,
  type TrustedPeer,
  type RemoteMetadataPreview,
} from '@colophony/types';
import type { Env } from '../config/env.js';
import { auditService } from './audit.service.js';
import { federationService } from './federation.service.js';
import {
  signFederationRequest,
  verifyFederationSignature,
} from '../federation/http-signatures.js';

// ---------------------------------------------------------------------------
// Error classes
// ---------------------------------------------------------------------------

export class TrustPeerNotFoundError extends Error {
  override name = 'TrustPeerNotFoundError' as const;
  constructor(id: string) {
    super(`Trusted peer not found: ${id}`);
  }
}

export class TrustPeerAlreadyExistsError extends Error {
  override name = 'TrustPeerAlreadyExistsError' as const;
  constructor(domain: string) {
    super(`Trusted peer already exists for domain: ${domain}`);
  }
}

export class TrustPeerInvalidStateError extends Error {
  override name = 'TrustPeerInvalidStateError' as const;
  constructor(expected: string, actual: string) {
    super(`Invalid peer state: expected ${expected}, got ${actual}`);
  }
}

export class RemoteMetadataFetchError extends Error {
  override name = 'RemoteMetadataFetchError' as const;
  constructor(domain: string, cause?: unknown) {
    super(`Failed to fetch metadata from ${domain}`);
    if (cause) this.cause = cause;
  }
}

export class TrustSignatureVerificationError extends Error {
  override name = 'TrustSignatureVerificationError' as const;
  constructor(reason: string) {
    super(`Signature verification failed: ${reason}`);
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mapPeerRow(row: typeof trustedPeers.$inferSelect): TrustedPeer {
  return {
    id: row.id,
    organizationId: row.organizationId,
    domain: row.domain,
    instanceUrl: row.instanceUrl,
    publicKey: row.publicKey,
    keyId: row.keyId,
    grantedCapabilities: row.grantedCapabilities,
    status: row.status,
    initiatedBy: row.initiatedBy,
    protocolVersion: row.protocolVersion,
    lastVerifiedAt: row.lastVerifiedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export const trustService = {
  /**
   * Fetch and preview remote instance metadata.
   * 10s timeout for SSRF protection.
   */
  async fetchRemoteMetadata(domain: string): Promise<RemoteMetadataPreview> {
    let response: Response;
    try {
      response = await fetch(`https://${domain}/.well-known/colophony`, {
        signal: AbortSignal.timeout(10_000),
        headers: { accept: 'application/json' },
      });
    } catch (err) {
      throw new RemoteMetadataFetchError(domain, err);
    }

    if (!response.ok) {
      throw new RemoteMetadataFetchError(
        domain,
        new Error(`HTTP ${response.status}`),
      );
    }

    let json: unknown;
    try {
      json = await response.json();
    } catch (err) {
      throw new RemoteMetadataFetchError(domain, err);
    }

    const parsed = federationMetadataSchema.safeParse(json);
    if (!parsed.success) {
      throw new RemoteMetadataFetchError(
        domain,
        new Error(`Invalid metadata: ${parsed.error.message}`),
      );
    }

    const metadata = parsed.data;
    return {
      domain: metadata.domain,
      software: metadata.software,
      version: metadata.version,
      publicKey: metadata.publicKey,
      keyId: metadata.keyId,
      capabilities: metadata.capabilities,
      mode: metadata.mode,
      contactEmail: metadata.contactEmail,
      publicationCount: metadata.publications.length,
    };
  },

  /**
   * Initiate a trust relationship with a remote instance.
   * Creates a pending_outbound peer, then POSTs the trust request to the remote.
   */
  async initiateTrust(
    env: Env,
    orgId: string,
    input: InitiateTrustInput,
    actorId: string,
  ): Promise<TrustedPeer> {
    // Fetch remote metadata to get public key and instance URL
    const remoteMetadata = await this.fetchRemoteMetadata(input.domain);
    const config = await federationService.getOrInitConfig(env);
    const localDomain = env.FEDERATION_DOMAIN ?? 'localhost';

    const peer = await withRls({ orgId }, async (tx) => {
      // Check for existing peer
      const [existing] = await tx
        .select()
        .from(trustedPeers)
        .where(eq(trustedPeers.domain, input.domain))
        .limit(1);

      if (existing) {
        throw new TrustPeerAlreadyExistsError(input.domain);
      }

      // Insert pending_outbound peer
      const [inserted] = await tx
        .insert(trustedPeers)
        .values({
          organizationId: orgId,
          domain: input.domain,
          instanceUrl: `https://${input.domain}`,
          publicKey: remoteMetadata.publicKey,
          keyId: remoteMetadata.keyId,
          grantedCapabilities: {},
          status: 'pending_outbound',
          initiatedBy: 'local',
        })
        .returning();

      await auditService.log(tx, {
        resource: AuditResources.FEDERATION,
        action: AuditActions.FEDERATION_TRUST_INITIATED,
        resourceId: inserted.id,
        actorId,
        organizationId: orgId,
        newValue: {
          domain: input.domain,
          capabilities: input.requestedCapabilities,
        },
      });

      return inserted;
    });

    // POST trust request to remote (best-effort — peer stays pending if this fails)
    try {
      const body = JSON.stringify({
        instanceUrl: `https://${localDomain}`,
        domain: localDomain,
        publicKey: config.publicKey,
        keyId: config.keyId,
        requestedCapabilities: input.requestedCapabilities,
        protocolVersion: '1.0',
      });

      const { headers } = signFederationRequest({
        method: 'POST',
        url: `https://${input.domain}/federation/trust`,
        headers: { 'content-type': 'application/json' },
        body,
        privateKey: config.privateKey,
        keyId: config.keyId,
      });

      await fetch(`https://${input.domain}/federation/trust`, {
        method: 'POST',
        headers,
        body,
        signal: AbortSignal.timeout(10_000),
      });
    } catch {
      // Peer stays pending_outbound — admin can retry or remote will process later
    }

    return mapPeerRow(peer);
  },

  /**
   * Handle an inbound trust request from a remote instance.
   * Verifies the HTTP signature, then creates pending_inbound peers
   * for all non-opted-out organizations.
   */
  async handleInboundTrustRequest(
    _env: Env,
    request: TrustRequest,
    sigHeaders: Record<string, string>,
    method: string,
    url: string,
    body: string,
  ): Promise<{ orgIds: string[] }> {
    // Validate that the claimed public key matches the remote's published metadata
    // This prevents domain spoofing — attacker can't claim any domain with a self-signed key
    let remotePublicKey: string;
    try {
      const remoteMetadata = await fetch(
        `https://${request.domain}/.well-known/colophony`,
        { signal: AbortSignal.timeout(10_000) },
      );
      if (!remoteMetadata.ok) {
        throw new Error(
          `Remote metadata fetch failed: ${remoteMetadata.status}`,
        );
      }
      const metadata = federationMetadataSchema.parse(
        await remoteMetadata.json(),
      );
      remotePublicKey = metadata.publicKey;
    } catch (err) {
      throw new TrustSignatureVerificationError(
        `Cannot verify remote identity for ${request.domain}: ${err instanceof Error ? err.message : 'unknown error'}`,
      );
    }

    if (remotePublicKey !== request.publicKey) {
      throw new TrustSignatureVerificationError(
        'Public key in request does not match remote metadata',
      );
    }

    // Verify signature using the validated public key
    const keyLookup = async (keyId: string): Promise<string | null> => {
      if (keyId === request.keyId) return remotePublicKey;
      return null;
    };

    const verification = await verifyFederationSignature(
      { keyLookup },
      { method, url, headers: sigHeaders, body },
    );

    if (!verification.valid) {
      throw new TrustSignatureVerificationError('Invalid signature');
    }

    // Query non-opted-out org IDs via superuser db (read-only, no tenant data)
    const orgs = await db
      .select({ id: organizations.id })
      .from(organizations)
      .where(eq(organizations.federationOptedOut, false));

    const orgIds: string[] = [];

    // For each org, create a pending_inbound peer if not exists
    for (const org of orgs) {
      try {
        await withRls({ orgId: org.id }, async (tx) => {
          // Check if peer already exists for this domain
          const [existing] = await tx
            .select()
            .from(trustedPeers)
            .where(eq(trustedPeers.domain, request.domain))
            .limit(1);

          if (existing) return; // Skip — already have a relationship

          await tx.insert(trustedPeers).values({
            organizationId: org.id,
            domain: request.domain,
            instanceUrl: request.instanceUrl,
            publicKey: request.publicKey,
            keyId: request.keyId,
            grantedCapabilities: {},
            status: 'pending_inbound',
            initiatedBy: 'remote',
            protocolVersion: request.protocolVersion,
          });

          await auditService.log(tx, {
            resource: AuditResources.FEDERATION,
            action: AuditActions.FEDERATION_TRUST_RECEIVED,
            organizationId: org.id,
            newValue: {
              domain: request.domain,
              capabilities: request.requestedCapabilities,
            },
          });

          orgIds.push(org.id);
        });
      } catch (err) {
        // Skip org on unique constraint violation (peer already exists) — expected race condition
        const isUniqueViolation =
          err instanceof Error &&
          'code' in err &&
          (err as { code: string }).code === '23505';
        if (!isUniqueViolation) throw err;
      }
    }

    return { orgIds };
  },

  /**
   * Accept an inbound trust request — transitions pending_inbound → active.
   * Sends a signed accept response to the remote instance.
   */
  async acceptInboundTrust(
    env: Env,
    orgId: string,
    peerId: string,
    input: PeerActionInput,
    actorId: string,
  ): Promise<TrustedPeer> {
    const config = await federationService.getOrInitConfig(env);
    const localDomain = env.FEDERATION_DOMAIN ?? 'localhost';
    const capabilities = (input.grantedCapabilities ?? {}) as Record<
      string,
      boolean
    >;

    const peer = await withRls({ orgId }, async (tx) => {
      const [existing] = await tx
        .select()
        .from(trustedPeers)
        .where(eq(trustedPeers.id, peerId))
        .limit(1);

      if (!existing) {
        throw new TrustPeerNotFoundError(peerId);
      }

      if (existing.status !== 'pending_inbound') {
        throw new TrustPeerInvalidStateError(
          'pending_inbound',
          existing.status,
        );
      }

      const [updated] = await tx
        .update(trustedPeers)
        .set({
          status: 'active',
          grantedCapabilities: capabilities,
          lastVerifiedAt: new Date(),
        })
        .where(eq(trustedPeers.id, peerId))
        .returning();

      await auditService.log(tx, {
        resource: AuditResources.FEDERATION,
        action: AuditActions.FEDERATION_TRUST_ACCEPTED,
        resourceId: peerId,
        actorId,
        organizationId: orgId,
        newValue: {
          domain: existing.domain,
          grantedCapabilities: capabilities,
        },
      });

      return updated;
    });

    // POST accept to remote (best-effort)
    try {
      const body = JSON.stringify({
        instanceUrl: `https://${localDomain}`,
        domain: localDomain,
        grantedCapabilities: capabilities,
        protocolVersion: '1.0',
      });

      const { headers } = signFederationRequest({
        method: 'POST',
        url: `https://${peer.domain}/federation/trust/accept`,
        headers: { 'content-type': 'application/json' },
        body,
        privateKey: config.privateKey,
        keyId: config.keyId,
      });

      await fetch(`https://${peer.domain}/federation/trust/accept`, {
        method: 'POST',
        headers,
        body,
        signal: AbortSignal.timeout(10_000),
      });
    } catch {
      // Accept notification is best-effort
    }

    return mapPeerRow(peer);
  },

  /**
   * Handle an inbound trust accept from a remote instance.
   * Verifies signature and transitions pending_outbound → active.
   */
  async handleInboundTrustAccept(
    _env: Env,
    accept: TrustAccept,
    sigHeaders: Record<string, string>,
    method: string,
    url: string,
    body: string,
  ): Promise<void> {
    // Look up the remote's public key from our stored peer records
    const keyLookup = async (_keyId: string): Promise<string | null> => {
      // Query across orgs via superuser — just checking the key, not returning tenant data
      const rows = await db
        .select({ publicKey: trustedPeers.publicKey })
        .from(trustedPeers)
        .where(
          and(
            eq(trustedPeers.domain, accept.domain),
            eq(trustedPeers.status, 'pending_outbound'),
          ),
        )
        .limit(1);
      if (rows.length === 0) return null;
      return rows[0].publicKey;
    };

    const verification = await verifyFederationSignature(
      { keyLookup },
      { method, url, headers: sigHeaders, body },
    );

    if (!verification.valid) {
      throw new TrustSignatureVerificationError('Invalid signature');
    }

    // Find all orgs with pending_outbound for this domain (read-only via superuser)
    const pendingPeers = await db
      .select({
        id: trustedPeers.id,
        organizationId: trustedPeers.organizationId,
      })
      .from(trustedPeers)
      .where(
        and(
          eq(trustedPeers.domain, accept.domain),
          eq(trustedPeers.status, 'pending_outbound'),
        ),
      );

    // Update each via RLS
    const capabilities = (accept.grantedCapabilities ?? {}) as Record<
      string,
      boolean
    >;
    for (const peerRef of pendingPeers) {
      await withRls({ orgId: peerRef.organizationId }, async (tx) => {
        await tx
          .update(trustedPeers)
          .set({
            status: 'active',
            grantedCapabilities: capabilities,
            lastVerifiedAt: new Date(),
          })
          .where(eq(trustedPeers.id, peerRef.id));

        await auditService.log(tx, {
          resource: AuditResources.FEDERATION,
          action: AuditActions.FEDERATION_TRUST_ACCEPTED,
          resourceId: peerRef.id,
          organizationId: peerRef.organizationId,
          newValue: {
            domain: accept.domain,
            grantedCapabilities: capabilities,
          },
        });
      });
    }
  },

  /**
   * Reject an inbound trust request — pending_inbound → rejected.
   */
  async rejectTrust(
    orgId: string,
    peerId: string,
    actorId: string,
  ): Promise<TrustedPeer> {
    return withRls({ orgId }, async (tx) => {
      const [existing] = await tx
        .select()
        .from(trustedPeers)
        .where(eq(trustedPeers.id, peerId))
        .limit(1);

      if (!existing) {
        throw new TrustPeerNotFoundError(peerId);
      }

      if (existing.status !== 'pending_inbound') {
        throw new TrustPeerInvalidStateError(
          'pending_inbound',
          existing.status,
        );
      }

      const [updated] = await tx
        .update(trustedPeers)
        .set({ status: 'rejected' })
        .where(eq(trustedPeers.id, peerId))
        .returning();

      await auditService.log(tx, {
        resource: AuditResources.FEDERATION,
        action: AuditActions.FEDERATION_TRUST_REJECTED,
        resourceId: peerId,
        actorId,
        organizationId: orgId,
        newValue: { domain: existing.domain },
      });

      return mapPeerRow(updated);
    });
  },

  /**
   * Revoke an active trust relationship — active → revoked.
   */
  async revokeTrust(
    orgId: string,
    peerId: string,
    actorId: string,
  ): Promise<TrustedPeer> {
    return withRls({ orgId }, async (tx) => {
      const [existing] = await tx
        .select()
        .from(trustedPeers)
        .where(eq(trustedPeers.id, peerId))
        .limit(1);

      if (!existing) {
        throw new TrustPeerNotFoundError(peerId);
      }

      if (existing.status !== 'active') {
        throw new TrustPeerInvalidStateError('active', existing.status);
      }

      const [updated] = await tx
        .update(trustedPeers)
        .set({ status: 'revoked' })
        .where(eq(trustedPeers.id, peerId))
        .returning();

      await auditService.log(tx, {
        resource: AuditResources.FEDERATION,
        action: AuditActions.FEDERATION_TRUST_REVOKED,
        resourceId: peerId,
        actorId,
        organizationId: orgId,
        newValue: { domain: existing.domain },
      });

      return mapPeerRow(updated);
    });
  },

  /**
   * List all trusted peers for an organization. RLS scopes to org.
   */
  async listPeers(orgId: string): Promise<TrustedPeer[]> {
    return withRls({ orgId }, async (tx) => {
      const rows = await tx.select().from(trustedPeers);
      return rows.map(mapPeerRow);
    });
  },

  /**
   * Get a trusted peer by ID. RLS scoped.
   */
  async getPeerById(orgId: string, peerId: string): Promise<TrustedPeer> {
    return withRls({ orgId }, async (tx) => {
      const [row] = await tx
        .select()
        .from(trustedPeers)
        .where(eq(trustedPeers.id, peerId))
        .limit(1);

      if (!row) {
        throw new TrustPeerNotFoundError(peerId);
      }

      return mapPeerRow(row);
    });
  },

  /**
   * Get a trusted peer by domain. RLS scoped.
   */
  async getPeerByDomain(
    orgId: string,
    domain: string,
  ): Promise<TrustedPeer | null> {
    return withRls({ orgId }, async (tx) => {
      const [row] = await tx
        .select()
        .from(trustedPeers)
        .where(eq(trustedPeers.domain, domain))
        .limit(1);

      return row ? mapPeerRow(row) : null;
    });
  },
};
