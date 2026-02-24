import crypto from 'node:crypto';
import {
  db,
  federationConfig,
  publications,
  organizations,
  users,
} from '@colophony/db';
import { eq, and } from 'drizzle-orm';
import {
  AuditActions,
  AuditResources,
  type FederationMetadata,
  type WebFingerResponse,
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
    const config = await this.getOrInitConfig(env);

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
      capabilities: config.capabilities,
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
    const config = await this.getOrInitConfig(env);

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
};
