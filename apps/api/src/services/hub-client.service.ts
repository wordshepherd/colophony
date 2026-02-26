import { db, withRls, federationConfig, trustedPeers, eq } from '@colophony/db';
import {
  AuditActions,
  AuditResources,
  hubRegistrationResponseSchema,
  hubFingerprintResultSchema,
  type HubFingerprintResult,
  type TrustedPeer,
} from '@colophony/types';
import type { Env } from '../config/env.js';
import { federationService } from './federation.service.js';
import { auditService } from './audit.service.js';
import { signFederationRequest } from '../federation/http-signatures.js';

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export const hubClientService = {
  /**
   * Register this instance with the hub.
   * Called on startup if HUB_DOMAIN + HUB_REGISTRATION_TOKEN are set.
   */
  async registerWithHub(env: Env): Promise<void> {
    const config = await federationService.getPublicConfig(env);
    const localDomain = env.FEDERATION_DOMAIN ?? 'localhost';

    const body = JSON.stringify({
      domain: localDomain,
      instanceUrl: `https://${localDomain}`,
      publicKey: config.publicKey,
      keyId: config.keyId,
      registrationToken: env.HUB_REGISTRATION_TOKEN,
      protocolVersion: '1.0',
    });

    const response = await fetch(
      `https://${env.HUB_DOMAIN}/federation/v1/hub/register`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body,
        signal: AbortSignal.timeout(10_000),
      },
    );

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      throw new Error(
        `Hub registration failed: HTTP ${response.status} — ${text}`,
      );
    }

    const json = await response.json();
    const parsed = hubRegistrationResponseSchema.parse(json);

    // Store attestation in federation_config
    const [existing] = await db.select().from(federationConfig).limit(1);
    if (existing) {
      await db
        .update(federationConfig)
        .set({
          hubAttestationToken: parsed.attestationToken,
          hubAttestationExpiresAt: new Date(parsed.attestationExpiresAt),
          hubDomain: parsed.hubDomain,
          updatedAt: new Date(),
        })
        .where(eq(federationConfig.id, existing.id));
    }
  },

  /**
   * Push a fingerprint to the hub's centralized index. Fire-and-forget.
   */
  async pushFingerprint(
    env: Env,
    input: {
      fingerprint: string;
      submitterDid: string;
      publicationName?: string;
      submittedAt?: string;
    },
  ): Promise<void> {
    const config = await federationService.getOrInitConfig(env);

    const body = JSON.stringify({
      fingerprint: input.fingerprint,
      submitterDid: input.submitterDid,
      publicationName: input.publicationName,
      submittedAt: input.submittedAt,
    });

    const url = `https://${env.HUB_DOMAIN}/federation/v1/hub/fingerprints/register`;
    const { headers } = signFederationRequest({
      method: 'POST',
      url,
      headers: { 'content-type': 'application/json' },
      body,
      privateKey: config.privateKey,
      keyId: config.keyId,
    });

    await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...headers },
      body,
      signal: AbortSignal.timeout(5_000),
    });
  },

  /**
   * Query the hub's fingerprint index.
   * Returns conflicts or null if hub unreachable.
   */
  async queryHubFingerprints(
    env: Env,
    fingerprint: string,
    submitterDid: string,
  ): Promise<HubFingerprintResult | null> {
    const config = await federationService.getOrInitConfig(env);
    const localDomain = env.FEDERATION_DOMAIN ?? 'localhost';

    const body = JSON.stringify({
      fingerprint,
      submitterDid,
      requestingDomain: localDomain,
    });

    const url = `https://${env.HUB_DOMAIN}/federation/v1/hub/fingerprints/lookup`;
    const { headers } = signFederationRequest({
      method: 'POST',
      url,
      headers: { 'content-type': 'application/json' },
      body,
      privateKey: config.privateKey,
      keyId: config.keyId,
    });

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...headers },
        body,
        signal: AbortSignal.timeout(3_000),
      });

      if (!response.ok) {
        return null;
      }

      const json = await response.json();
      const parsed = hubFingerprintResultSchema.safeParse(json);
      return parsed.success ? parsed.data : null;
    } catch {
      return null; // Hub unreachable — graceful degradation
    }
  },

  /**
   * Initiate hub-attested trust with a peer.
   * Sends attestation token with trust request.
   */
  async initiateHubAttestedTrust(
    env: Env,
    orgId: string,
    targetDomain: string,
    actorId: string,
  ): Promise<TrustedPeer> {
    const config = await federationService.getOrInitConfig(env);
    const localDomain = env.FEDERATION_DOMAIN ?? 'localhost';

    // Read attestation from federation_config
    const [fedConfig] = await db.select().from(federationConfig).limit(1);
    if (!fedConfig?.hubAttestationToken || !fedConfig.hubDomain) {
      throw new Error('No hub attestation — register with hub first');
    }

    const body = JSON.stringify({
      instanceUrl: `https://${localDomain}`,
      domain: localDomain,
      publicKey: config.publicKey,
      keyId: config.keyId,
      attestationToken: fedConfig.hubAttestationToken,
      hubDomain: fedConfig.hubDomain,
      requestedCapabilities: {
        'identity.verify': true,
        'simsub.check': true,
        'simsub.respond': true,
        'transfer.initiate': true,
        'transfer.receive': true,
      },
      protocolVersion: '1.0',
    });

    const url = `https://${targetDomain}/federation/trust/hub-attested`;
    const { headers } = signFederationRequest({
      method: 'POST',
      url,
      headers: { 'content-type': 'application/json' },
      body,
      privateKey: config.privateKey,
      keyId: config.keyId,
    });

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...headers },
      body,
      signal: AbortSignal.timeout(10_000),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      throw new Error(
        `Hub-attested trust failed: HTTP ${response.status} — ${text}`,
      );
    }

    // Create local peer row as active (hub-attested)
    const peer = await withRls({ orgId }, async (tx) => {
      const [inserted] = await tx
        .insert(trustedPeers)
        .values({
          organizationId: orgId,
          domain: targetDomain,
          instanceUrl: `https://${targetDomain}`,
          publicKey: config.publicKey,
          keyId: config.keyId,
          grantedCapabilities: {
            'identity.verify': true,
            'simsub.check': true,
            'simsub.respond': true,
            'transfer.initiate': true,
            'transfer.receive': true,
          },
          status: 'active',
          initiatedBy: 'local',
          hubAttested: true,
          lastVerifiedAt: new Date(),
        })
        .returning();

      await auditService.log(tx, {
        resource: AuditResources.HUB,
        action: AuditActions.HUB_AUTO_TRUST_ESTABLISHED,
        resourceId: inserted.id,
        actorId,
        organizationId: orgId,
        newValue: { domain: targetDomain, hubDomain: fedConfig.hubDomain },
      });

      return inserted;
    });

    return {
      id: peer.id,
      organizationId: peer.organizationId,
      domain: peer.domain,
      instanceUrl: peer.instanceUrl,
      publicKey: peer.publicKey,
      keyId: peer.keyId,
      grantedCapabilities: peer.grantedCapabilities,
      status: peer.status,
      initiatedBy: peer.initiatedBy,
      protocolVersion: peer.protocolVersion,
      lastVerifiedAt: peer.lastVerifiedAt,
      createdAt: peer.createdAt,
      updatedAt: peer.updatedAt,
    };
  },
};
