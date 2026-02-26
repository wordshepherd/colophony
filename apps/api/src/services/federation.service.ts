import crypto from 'node:crypto';
import {
  db,
  federationConfig,
  publications,
  organizations,
  users,
  userKeys,
} from '@colophony/db';
import { eq, and, isNull, count } from 'drizzle-orm';
import {
  AuditActions,
  AuditResources,
  type FederationMetadata,
  type WebFingerResponse,
  type DidDocument,
} from '@colophony/types';
import type { Env } from '../config/env.js';
import { auditService } from './audit.service.js';

// ---------------------------------------------------------------------------
// Error classes
// ---------------------------------------------------------------------------

export class FederationDisabledError extends Error {
  override name = 'FederationDisabledError' as const;
  constructor() {
    super('Federation is not enabled on this instance');
  }
}

export class FederationNotConfiguredError extends Error {
  override name = 'FederationNotConfiguredError' as const;
  constructor() {
    super('Federation is not yet configured');
  }
}

export class WebFingerUserNotFoundError extends Error {
  override name = 'WebFingerUserNotFoundError' as const;
  constructor(resource: string) {
    super(`User not found: ${resource}`);
  }
}

export class WebFingerDomainMismatchError extends Error {
  override name = 'WebFingerDomainMismatchError' as const;
  constructor(domain: string) {
    super(`Domain mismatch: ${domain} is not served by this instance`);
  }
}

export class UserDidNotFoundError extends Error {
  override name = 'UserDidNotFoundError' as const;
  constructor(localPart: string) {
    super(`User not found for DID resolution: ${localPart}`);
  }
}

export class NoActiveKeyError extends Error {
  override name = 'NoActiveKeyError' as const;
  constructor(userId: string) {
    super(`No active key found for user: ${userId}`);
  }
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface FederationConfigRow {
  id: string;
  publicKey: string;
  privateKey: string;
  keyId: string;
  mode: 'allowlist' | 'open' | 'managed_hub';
  contactEmail: string | null;
  capabilities: string[];
  enabled: boolean;
}

export type FederationPublicConfig = Omit<FederationConfigRow, 'privateKey'>;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const DID_CONTEXT = [
  'https://www.w3.org/ns/did/v1',
  'https://w3id.org/security/suites/jws-2020/v1',
];

/**
 * Convert an Ed25519 PEM public key to JWK format.
 * Uses Node.js native crypto — no external deps.
 */
function pemToJwk(pem: string): {
  kty: 'OKP';
  crv: 'Ed25519';
  x: string;
} {
  const keyObj = crypto.createPublicKey(pem);
  const jwk = keyObj.export({ format: 'jwk' });
  return {
    kty: 'OKP',
    crv: 'Ed25519',
    x: jwk.x as string,
  };
}

/**
 * Encode a domain for did:web — port colons become %3A per spec.
 * "localhost:4000" → "localhost%3A4000"
 */
export function domainToDid(domain: string): string {
  return domain.replace(/:/g, '%3A');
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export const federationService = {
  /**
   * Get or auto-generate the singleton federation config.
   *
   * Priority: env vars > DB row > auto-generate.
   * Uses INSERT ... ON CONFLICT (singleton) DO NOTHING to prevent races.
   */
  async getOrInitConfig(env: Env): Promise<FederationConfigRow> {
    // Check for env var override
    if (env.FEDERATION_PUBLIC_KEY && env.FEDERATION_PRIVATE_KEY) {
      // Still read DB for non-key fields, but override keys
      const [existing] = await db.select().from(federationConfig).limit(1);

      return {
        id: existing?.id ?? 'env-override',
        publicKey: env.FEDERATION_PUBLIC_KEY,
        privateKey: env.FEDERATION_PRIVATE_KEY,
        keyId:
          existing?.keyId ?? `${env.FEDERATION_DOMAIN ?? 'localhost'}#main`,
        mode: existing?.mode ?? 'allowlist',
        contactEmail: env.FEDERATION_CONTACT ?? existing?.contactEmail ?? null,
        capabilities: existing?.capabilities ?? ['identity'],
        enabled: existing?.enabled ?? false,
      };
    }

    // Try to read existing config
    const [existing] = await db.select().from(federationConfig).limit(1);

    if (existing) {
      return {
        id: existing.id,
        publicKey: existing.publicKey,
        privateKey: existing.privateKey,
        keyId: existing.keyId,
        mode: existing.mode,
        contactEmail: env.FEDERATION_CONTACT ?? existing.contactEmail,
        capabilities: existing.capabilities,
        enabled: existing.enabled,
      };
    }

    // Auto-generate keypair
    return this.generateAndStoreKeypair(env);
  },

  /**
   * Get public-only federation config — private key is never loaded into memory.
   *
   * Priority: env vars > DB row > auto-generate (via getOrInitConfig fallback).
   * For the DB path, only public columns are selected.
   */
  async getPublicConfig(env: Env): Promise<FederationPublicConfig> {
    // Env var override path — require both keys to match getOrInitConfig behavior
    if (env.FEDERATION_PUBLIC_KEY && env.FEDERATION_PRIVATE_KEY) {
      // Select only public columns — never load privateKey into memory
      const [existing] = await db
        .select({
          id: federationConfig.id,
          keyId: federationConfig.keyId,
          mode: federationConfig.mode,
          contactEmail: federationConfig.contactEmail,
          capabilities: federationConfig.capabilities,
          enabled: federationConfig.enabled,
        })
        .from(federationConfig)
        .limit(1);

      return {
        id: existing?.id ?? 'env-override',
        publicKey: env.FEDERATION_PUBLIC_KEY,
        keyId:
          existing?.keyId ?? `${env.FEDERATION_DOMAIN ?? 'localhost'}#main`,
        mode: existing?.mode ?? 'allowlist',
        contactEmail: env.FEDERATION_CONTACT ?? existing?.contactEmail ?? null,
        capabilities: existing?.capabilities ?? ['identity'],
        enabled: existing?.enabled ?? false,
      };
    }

    // DB path — select only public columns (privateKey is never loaded)
    const [existing] = await db
      .select({
        id: federationConfig.id,
        publicKey: federationConfig.publicKey,
        keyId: federationConfig.keyId,
        mode: federationConfig.mode,
        contactEmail: federationConfig.contactEmail,
        capabilities: federationConfig.capabilities,
        enabled: federationConfig.enabled,
      })
      .from(federationConfig)
      .limit(1);

    if (existing) {
      return {
        id: existing.id,
        publicKey: existing.publicKey,
        keyId: existing.keyId,
        mode: existing.mode,
        contactEmail: env.FEDERATION_CONTACT ?? existing.contactEmail,
        capabilities: existing.capabilities,
        enabled: existing.enabled,
      };
    }

    // Auto-generate path — must call getOrInitConfig then strip privateKey
    const full = await this.getOrInitConfig(env);
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { privateKey, ...publicConfig } = full;
    return publicConfig;
  },

  /**
   * Generate an Ed25519 keypair, store it, and audit log the event.
   *
   * INSERT ... ON CONFLICT (singleton) DO NOTHING handles concurrent
   * initialization — if another process inserted first, we read back
   * the existing row.
   */
  async generateAndStoreKeypair(env: Env): Promise<FederationConfigRow> {
    const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519', {
      publicKeyEncoding: { type: 'spki', format: 'pem' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    });

    const keyId = `${env.FEDERATION_DOMAIN ?? 'localhost'}#main`;

    await db
      .insert(federationConfig)
      .values({
        publicKey,
        privateKey,
        keyId,
        contactEmail: env.FEDERATION_CONTACT ?? null,
        enabled: true, // Auto-init enables — FEDERATION_ENABLED env var already authorized
      })
      .onConflictDoNothing({ target: federationConfig.singleton });

    // Read back — handles the race condition where another process inserted first
    const [row] = await db.select().from(federationConfig).limit(1);

    if (!row) {
      throw new FederationNotConfiguredError();
    }

    // Audit log key generation (only if we generated the key that's now in DB)
    if (row.publicKey === publicKey) {
      await auditService.logDirect({
        resource: AuditResources.FEDERATION,
        action: AuditActions.FEDERATION_KEY_GENERATED,
        newValue: { keyId, algorithm: 'ed25519' },
      });
    }

    return {
      id: row.id,
      publicKey: row.publicKey,
      privateKey: row.privateKey,
      keyId: row.keyId,
      mode: row.mode,
      contactEmail: env.FEDERATION_CONTACT ?? row.contactEmail,
      capabilities: row.capabilities,
      enabled: row.enabled,
    };
  },

  /**
   * Build the .well-known/colophony instance metadata response.
   *
   * Queries publications via superuser `db` — intentional RLS bypass
   * for cross-org public metadata (same pattern as org-context.ts:78).
   */
  async getInstanceMetadata(env: Env): Promise<FederationMetadata> {
    const config = await this.getPublicConfig(env);

    if (!config.enabled) {
      throw new FederationDisabledError();
    }

    // Query active publications from non-opted-out orgs via superuser pool
    const pubs = await db
      .select({
        id: publications.id,
        name: publications.name,
        slug: publications.slug,
        organizationSlug: organizations.slug,
      })
      .from(publications)
      .innerJoin(
        organizations,
        eq(publications.organizationId, organizations.id),
      )
      .where(
        and(
          eq(organizations.federationOptedOut, false),
          eq(publications.status, 'ACTIVE'),
        ),
      );

    return {
      software: 'colophony',
      version: '2.0.0-dev',
      domain: env.FEDERATION_DOMAIN ?? 'localhost',
      publicKey: config.publicKey,
      keyId: config.keyId,
      capabilities: [
        ...new Set([...config.capabilities, 'simsub.check', 'simsub.respond']),
      ],
      mode: config.mode,
      contactEmail: config.contactEmail,
      publications: pubs,
    };
  },

  /**
   * Resolve a WebFinger `acct:` URI to a JRD response (RFC 7033).
   *
   * Validates domain against FEDERATION_DOMAIN, looks up user by email
   * via superuser pool, returns JRD with did:web alias.
   */
  async resolveWebFinger(
    env: Env,
    resource: string,
  ): Promise<WebFingerResponse> {
    const config = await this.getPublicConfig(env);

    if (!config.enabled) {
      throw new FederationDisabledError();
    }

    // Parse acct: URI
    const acctMatch = resource.match(/^acct:(.+)@(.+)$/);
    if (!acctMatch) {
      throw new WebFingerUserNotFoundError(resource);
    }

    const [, localPart, domain] = acctMatch;
    const expectedDomain = env.FEDERATION_DOMAIN ?? 'localhost';

    if (domain !== expectedDomain) {
      throw new WebFingerDomainMismatchError(domain);
    }

    const email = `${localPart}@${domain}`;

    // Look up user by email via superuser pool
    const [user] = await db
      .select({ id: users.id, email: users.email })
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (!user) {
      throw new WebFingerUserNotFoundError(resource);
    }

    return {
      subject: resource,
      aliases: [`did:web:${domain}:users:${localPart}`],
      links: [
        {
          rel: 'self',
          type: 'application/activity+json',
          href: `https://${domain}/users/${localPart}`,
        },
        {
          rel: 'http://webfinger.net/rel/profile-page',
          type: 'text/html',
          href: `https://${domain}/@${localPart}`,
        },
      ],
    };
  },

  /**
   * Build the instance DID document (did:web:<domain>).
   * Resolved at GET /.well-known/did.json
   */
  async getInstanceDidDocument(env: Env): Promise<DidDocument> {
    const config = await this.getPublicConfig(env);

    if (!config.enabled) {
      throw new FederationDisabledError();
    }

    const domain = env.FEDERATION_DOMAIN ?? 'localhost';
    const didId = `did:web:${domainToDid(domain)}`;
    const keyRef = `${didId}#main`;

    return {
      '@context': DID_CONTEXT,
      id: didId,
      verificationMethod: [
        {
          id: keyRef,
          type: 'JsonWebKey2020',
          controller: didId,
          publicKeyJwk: pemToJwk(config.publicKey),
        },
      ],
      authentication: [keyRef],
      assertionMethod: [keyRef],
      service: [
        {
          id: `${didId}#federation`,
          type: 'ColophonyFederation',
          serviceEndpoint: `https://${domain}/.well-known/colophony`,
        },
      ],
    };
  },

  /**
   * Build a user DID document (did:web:<domain>:users:<localPart>).
   * Resolved at GET /users/:localPart/did.json
   *
   * Lazily generates an Ed25519 keypair on first request.
   * Never returns private key material.
   */
  async getUserDidDocument(env: Env, localPart: string): Promise<DidDocument> {
    const config = await this.getPublicConfig(env);

    if (!config.enabled) {
      throw new FederationDisabledError();
    }

    const domain = env.FEDERATION_DOMAIN ?? 'localhost';

    // Look up user by email local part — must be non-deleted, non-guest
    // Strip port from domain for email matching (did:web encodes port as %3A)
    const emailDomain = domain.replace(/:\d+$/, '');
    const email = `${localPart}@${emailDomain}`;
    const [user] = await db
      .select({
        id: users.id,
        deletedAt: users.deletedAt,
        isGuest: users.isGuest,
        migratedToDid: users.migratedToDid,
      })
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
      throw new UserDidNotFoundError(localPart);
    }

    // Get all active keys; if none, lazily generate one
    let activeKeys = (await this.getAllUserKeys(user.id)).filter(
      (k) => k.status === 'active',
    );

    if (activeKeys.length === 0) {
      const keypair = await this.getOrCreateUserKeypair(
        user.id,
        domain,
        localPart,
      );
      activeKeys = [
        {
          publicKey: keypair.publicKey,
          keyId: keypair.keyId,
          status: 'active',
          createdAt: new Date(),
        },
      ];
    }

    const didId = `did:web:${domainToDid(domain)}:users:${localPart}`;

    const verificationMethod = activeKeys.map((key) => ({
      id: key.keyId,
      type: 'JsonWebKey2020' as const,
      controller: didId,
      publicKeyJwk: pemToJwk(key.publicKey),
    }));

    const keyRefs = activeKeys.map((k) => k.keyId);

    return {
      '@context': DID_CONTEXT,
      id: didId,
      ...(user.migratedToDid ? { alsoKnownAs: [user.migratedToDid] } : {}),
      verificationMethod,
      authentication: keyRefs,
      assertionMethod: keyRefs,
      service: [
        {
          id: `${didId}#submitter`,
          type: 'ColophonySubmitter',
          serviceEndpoint: `https://${domain}/users/${localPart}`,
        },
      ],
    };
  },

  /**
   * Get or lazily create an Ed25519 keypair for a user.
   * INSERT ON CONFLICT handles concurrent generation races.
   * Returns only the public key and keyId — never exposes private key.
   */
  async getOrCreateUserKeypair(
    userId: string,
    domain: string,
    localPart: string,
  ): Promise<{ publicKey: string; keyId: string }> {
    // Check for existing active keypair
    const [existing] = await db
      .select({
        publicKey: userKeys.publicKey,
        keyId: userKeys.keyId,
      })
      .from(userKeys)
      .where(and(eq(userKeys.userId, userId), eq(userKeys.status, 'active')))
      .limit(1);

    if (existing) {
      return existing;
    }

    // Generate new Ed25519 keypair
    const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519', {
      publicKeyEncoding: { type: 'spki', format: 'pem' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    });

    const keyId = `did:web:${domainToDid(domain)}:users:${localPart}#key-1`;

    // INSERT ON CONFLICT handles race condition
    await db
      .insert(userKeys)
      .values({
        userId,
        publicKey,
        privateKey,
        keyId,
        algorithm: 'Ed25519',
      })
      .onConflictDoNothing();

    // Read back (handles race where another process inserted first)
    const [row] = await db
      .select({
        publicKey: userKeys.publicKey,
        keyId: userKeys.keyId,
      })
      .from(userKeys)
      .where(eq(userKeys.userId, userId))
      .limit(1);

    // Audit log if we generated the key now in DB
    if (row && row.publicKey === publicKey) {
      await auditService.logDirect({
        resource: AuditResources.FEDERATION,
        action: AuditActions.FEDERATION_USER_KEY_GENERATED,
        actorId: userId,
        newValue: { keyId, algorithm: 'Ed25519' },
      });
    }

    // row is guaranteed to exist — either we inserted or another process did
    return { publicKey: row.publicKey, keyId: row.keyId };
  },

  /**
   * Get all user keys (active + revoked) for DID document resolution.
   * Uses superuser `db` pool — justified: cross-user public key lookup
   * for DID docs (same justification as instance DID doc resolution).
   */
  async getAllUserKeys(userId: string): Promise<
    Array<{
      publicKey: string;
      keyId: string;
      status: string;
      createdAt: Date;
    }>
  > {
    return db
      .select({
        publicKey: userKeys.publicKey,
        keyId: userKeys.keyId,
        status: userKeys.status,
        createdAt: userKeys.createdAt,
      })
      .from(userKeys)
      .where(eq(userKeys.userId, userId));
  },

  /**
   * Rotate a user's keypair: revoke current active key, generate new one.
   * Uses superuser `db` pool in a transaction to ensure atomicity.
   */
  async rotateUserKey(
    userId: string,
    domain: string,
    localPart: string,
    reason?: string,
  ): Promise<{ newKeyId: string; previousKeyId: string }> {
    // Find current active key
    const [activeKey] = await db
      .select({
        id: userKeys.id,
        keyId: userKeys.keyId,
      })
      .from(userKeys)
      .where(and(eq(userKeys.userId, userId), eq(userKeys.status, 'active')))
      .limit(1);

    if (!activeKey) {
      throw new NoActiveKeyError(userId);
    }

    // Count total keys to determine the next key suffix
    const [keyCount] = await db
      .select({ total: count() })
      .from(userKeys)
      .where(eq(userKeys.userId, userId));

    const nextKeyNum = (keyCount?.total ?? 0) + 1;

    // Generate new Ed25519 keypair
    const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519', {
      publicKeyEncoding: { type: 'spki', format: 'pem' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    });

    const newKeyId = `did:web:${domainToDid(domain)}:users:${localPart}#key-${nextKeyNum}`;
    const now = new Date();

    // Revoke old key + insert new key atomically
    await db.transaction(async (tx) => {
      await tx
        .update(userKeys)
        .set({
          status: 'revoked',
          revokedAt: now,
          revokedReason: reason ?? 'Key rotation',
          updatedAt: now,
        })
        .where(
          and(eq(userKeys.id, activeKey.id), eq(userKeys.status, 'active')),
        );

      await tx.insert(userKeys).values({
        userId,
        publicKey,
        privateKey,
        keyId: newKeyId,
        algorithm: 'Ed25519',
        status: 'active',
      });
    });

    // Audit log rotation
    await auditService.logDirect({
      resource: AuditResources.FEDERATION,
      action: AuditActions.FEDERATION_USER_KEY_ROTATED,
      actorId: userId,
      newValue: {
        newKeyId,
        previousKeyId: activeKey.keyId,
        reason: reason ?? 'Key rotation',
      },
    });

    return { newKeyId, previousKeyId: activeKey.keyId };
  },
};
