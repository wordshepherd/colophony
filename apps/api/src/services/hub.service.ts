import crypto from 'node:crypto';
import * as jose from 'jose';
import {
  db,
  federationConfig,
  hubRegisteredInstances,
  hubFingerprintIndex,
  eq,
  and,
  ne,
} from '@colophony/db';
import {
  AuditActions,
  AuditResources,
  type HubRegistrationRequest,
  type HubRegistrationResponse,
  type HubFingerprintRegister,
  type HubFingerprintQuery,
  type HubFingerprintResult,
  type HubRegisteredInstance,
} from '@colophony/types';
import type { Env } from '../config/env.js';
import { auditService } from './audit.service.js';

// ---------------------------------------------------------------------------
// Error classes
// ---------------------------------------------------------------------------

export class HubNotEnabledError extends Error {
  override name = 'HubNotEnabledError' as const;
  constructor() {
    super('This instance is not configured as a managed hub');
  }
}

export class HubInvalidRegistrationTokenError extends Error {
  override name = 'HubInvalidRegistrationTokenError' as const;
  constructor() {
    super('Invalid registration token');
  }
}

export class HubInstanceAlreadyRegisteredError extends Error {
  override name = 'HubInstanceAlreadyRegisteredError' as const;
  constructor(domain: string) {
    super(`Instance already registered: ${domain}`);
  }
}

export class HubInstanceNotFoundError extends Error {
  override name = 'HubInstanceNotFoundError' as const;
  constructor(identifier: string) {
    super(`Hub instance not found: ${identifier}`);
  }
}

export class HubInstanceSuspendedError extends Error {
  override name = 'HubInstanceSuspendedError' as const;
  constructor(domain: string) {
    super(`Instance is suspended: ${domain}`);
  }
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ATTESTATION_DURATION_DAYS = 30;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mapInstanceRow(
  row: typeof hubRegisteredInstances.$inferSelect,
): HubRegisteredInstance {
  return {
    id: row.id,
    domain: row.domain,
    instanceUrl: row.instanceUrl,
    status: row.status as 'active' | 'suspended' | 'revoked',
    lastSeenAt: row.lastSeenAt,
    metadata: row.metadata,
    createdAt: row.createdAt,
  };
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export const hubService = {
  /**
   * Validate hub mode is active. Throws HubNotEnabledError if not.
   */
  async assertHubMode(env: Env): Promise<void> {
    if (!env.FEDERATION_ENABLED) {
      throw new HubNotEnabledError();
    }

    const [config] = await db.select().from(federationConfig).limit(1);
    if (!config || config.mode !== 'managed_hub') {
      throw new HubNotEnabledError();
    }
  },

  /**
   * Register a new managed instance. Validates token, stores instance,
   * issues attestation JWT.
   */
  async registerInstance(
    env: Env,
    request: HubRegistrationRequest,
  ): Promise<HubRegistrationResponse> {
    await this.assertHubMode(env);

    // Validate registration token (length check before timingSafeEqual to avoid throw)
    if (!env.HUB_REGISTRATION_TOKEN) {
      throw new HubInvalidRegistrationTokenError();
    }
    const provided = Buffer.from(request.registrationToken);
    const expected = Buffer.from(env.HUB_REGISTRATION_TOKEN);
    if (
      provided.length !== expected.length ||
      !crypto.timingSafeEqual(provided, expected)
    ) {
      throw new HubInvalidRegistrationTokenError();
    }

    // Check for existing instance
    const [existing] = await db
      .select()
      .from(hubRegisteredInstances)
      .where(eq(hubRegisteredInstances.domain, request.domain))
      .limit(1);

    if (existing) {
      throw new HubInstanceAlreadyRegisteredError(request.domain);
    }

    // Issue attestation
    const { token, expiresAt } = await this.issueAttestation(env, {
      domain: request.domain,
      publicKey: request.publicKey,
      keyId: request.keyId,
    });

    // Insert instance
    const [instance] = await db
      .insert(hubRegisteredInstances)
      .values({
        domain: request.domain,
        instanceUrl: request.instanceUrl,
        publicKey: request.publicKey,
        keyId: request.keyId,
        attestationToken: token,
        attestationExpiresAt: expiresAt,
        status: 'active',
        lastSeenAt: new Date(),
        metadata: {},
      })
      .returning();

    // Get hub config for public key
    const [config] = await db.select().from(federationConfig).limit(1);
    const hubDomain = env.FEDERATION_DOMAIN ?? 'localhost';

    // Audit
    await auditService.logDirect({
      resource: AuditResources.HUB,
      action: AuditActions.HUB_INSTANCE_REGISTERED,
      resourceId: instance.id,
      newValue: { domain: request.domain },
    });

    return {
      instanceId: instance.id,
      attestationToken: token,
      attestationExpiresAt: expiresAt.toISOString(),
      hubDomain,
      hubPublicKey: config.publicKey,
    };
  },

  /**
   * Refresh attestation for an already-registered instance.
   */
  async refreshAttestation(
    env: Env,
    domain: string,
  ): Promise<{ attestationToken: string; expiresAt: Date }> {
    await this.assertHubMode(env);

    const [instance] = await db
      .select()
      .from(hubRegisteredInstances)
      .where(eq(hubRegisteredInstances.domain, domain))
      .limit(1);

    if (!instance) {
      throw new HubInstanceNotFoundError(domain);
    }
    if (instance.status === 'suspended') {
      throw new HubInstanceSuspendedError(domain);
    }

    const { token, expiresAt } = await this.issueAttestation(env, {
      domain: instance.domain,
      publicKey: instance.publicKey,
      keyId: instance.keyId,
    });

    await db
      .update(hubRegisteredInstances)
      .set({
        attestationToken: token,
        attestationExpiresAt: expiresAt,
        lastSeenAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(hubRegisteredInstances.id, instance.id));

    return { attestationToken: token, expiresAt };
  },

  /**
   * Issue an Ed25519-signed JWT attestation for an instance.
   */
  async issueAttestation(
    env: Env,
    instance: { domain: string; publicKey: string; keyId: string },
  ): Promise<{ token: string; expiresAt: Date }> {
    const [config] = await db.select().from(federationConfig).limit(1);
    if (!config) {
      throw new HubNotEnabledError();
    }

    const hubDomain = env.FEDERATION_DOMAIN ?? 'localhost';
    const privateKey = crypto.createPrivateKey(config.privateKey);
    const expiresAt = new Date(
      Date.now() + ATTESTATION_DURATION_DAYS * 24 * 60 * 60 * 1000,
    );

    const token = await new jose.SignJWT({
      instancePublicKey: instance.publicKey,
      instanceKeyId: instance.keyId,
    })
      .setProtectedHeader({ alg: 'EdDSA' })
      .setIssuer(hubDomain)
      .setSubject(instance.domain)
      .setAudience('colophony:managed-hub')
      .setIssuedAt()
      .setExpirationTime(expiresAt)
      .setJti(crypto.randomUUID())
      .sign(privateKey);

    return { token, expiresAt };
  },

  /**
   * Register a fingerprint in the centralized index.
   * Idempotent on (source_domain, submitter_did, fingerprint).
   */
  async registerFingerprint(
    sourceDomain: string,
    input: HubFingerprintRegister,
  ): Promise<void> {
    await db
      .insert(hubFingerprintIndex)
      .values({
        fingerprint: input.fingerprint,
        sourceDomain,
        submitterDid: input.submitterDid,
        publicationName: input.publicationName,
        submittedAt: input.submittedAt ? new Date(input.submittedAt) : null,
      })
      .onConflictDoNothing({
        target: [
          hubFingerprintIndex.sourceDomain,
          hubFingerprintIndex.submitterDid,
          hubFingerprintIndex.fingerprint,
        ],
      });
  },

  /**
   * Look up a fingerprint in the centralized index.
   * Excludes requesting domain AND requesting submitter from results.
   */
  async lookupFingerprint(
    query: HubFingerprintQuery,
  ): Promise<HubFingerprintResult> {
    const rows = await db
      .select({
        sourceDomain: hubFingerprintIndex.sourceDomain,
        publicationName: hubFingerprintIndex.publicationName,
        submittedAt: hubFingerprintIndex.submittedAt,
      })
      .from(hubFingerprintIndex)
      .where(
        and(
          eq(hubFingerprintIndex.fingerprint, query.fingerprint),
          ne(hubFingerprintIndex.sourceDomain, query.requestingDomain),
          ne(hubFingerprintIndex.submitterDid, query.submitterDid),
        ),
      );

    return {
      found: rows.length > 0,
      conflicts: rows.map((r) => ({
        sourceDomain: r.sourceDomain,
        publicationName: r.publicationName,
        submittedAt: r.submittedAt?.toISOString() ?? null,
      })),
    };
  },

  /**
   * List registered instances (admin).
   */
  async listInstances(filter?: {
    status?: string;
  }): Promise<HubRegisteredInstance[]> {
    const query = filter?.status
      ? db
          .select()
          .from(hubRegisteredInstances)
          .where(eq(hubRegisteredInstances.status, filter.status))
      : db.select().from(hubRegisteredInstances);

    const rows = await query;
    return rows.map(mapInstanceRow);
  },

  /**
   * Get instance by domain.
   */
  async getInstanceByDomain(
    domain: string,
  ): Promise<HubRegisteredInstance | null> {
    const [row] = await db
      .select()
      .from(hubRegisteredInstances)
      .where(eq(hubRegisteredInstances.domain, domain))
      .limit(1);

    return row ? mapInstanceRow(row) : null;
  },

  /**
   * Get instance by ID.
   */
  async getInstanceById(id: string): Promise<HubRegisteredInstance | null> {
    const [row] = await db
      .select()
      .from(hubRegisteredInstances)
      .where(eq(hubRegisteredInstances.id, id))
      .limit(1);

    return row ? mapInstanceRow(row) : null;
  },

  /**
   * Suspend an instance (admin).
   */
  async suspendInstance(instanceId: string, actorId: string): Promise<void> {
    const [instance] = await db
      .select()
      .from(hubRegisteredInstances)
      .where(eq(hubRegisteredInstances.id, instanceId))
      .limit(1);

    if (!instance) {
      throw new HubInstanceNotFoundError(instanceId);
    }

    await db
      .update(hubRegisteredInstances)
      .set({ status: 'suspended', updatedAt: new Date() })
      .where(eq(hubRegisteredInstances.id, instanceId));

    await auditService.logDirect({
      resource: AuditResources.HUB,
      action: AuditActions.HUB_INSTANCE_SUSPENDED,
      resourceId: instanceId,
      actorId,
      newValue: { domain: instance.domain },
    });
  },

  /**
   * Revoke an instance (admin).
   */
  async revokeInstance(instanceId: string, actorId: string): Promise<void> {
    const [instance] = await db
      .select()
      .from(hubRegisteredInstances)
      .where(eq(hubRegisteredInstances.id, instanceId))
      .limit(1);

    if (!instance) {
      throw new HubInstanceNotFoundError(instanceId);
    }

    await db
      .update(hubRegisteredInstances)
      .set({ status: 'revoked', updatedAt: new Date() })
      .where(eq(hubRegisteredInstances.id, instanceId));

    await auditService.logDirect({
      resource: AuditResources.HUB,
      action: AuditActions.HUB_INSTANCE_REVOKED,
      resourceId: instanceId,
      actorId,
      newValue: { domain: instance.domain },
    });
  },
};
