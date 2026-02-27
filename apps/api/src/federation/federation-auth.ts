import fp from 'fastify-plugin';
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { db, trustedPeers, eq, and } from '@colophony/db';
import { verifyFederationSignature } from './http-signatures.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface FederationPeerContext {
  /** Verified remote domain extracted from the signature keyId */
  domain: string;
  /** The keyId from the verified signature */
  keyId: string;
}

declare module 'fastify' {
  interface FastifyRequest {
    federationPeer: FederationPeerContext | null;
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Extract the remote domain from a federation keyId.
 *
 * Supported formats:
 *  - Instance key: `example.com#main` or `localhost:4000#main`
 *  - Instance DID key: `did:web:example.com#main` or `did:web:localhost%3A4000#main`
 *  - User DID key: `did:web:example.com:users:alice#key-1` or `did:web:localhost%3A4000:users:bob#key-1`
 */
export function extractDomainFromKeyId(keyId: string): string | null {
  // DID-based keyId: did:web:<encoded-domain>[:path...]#fragment
  if (keyId.startsWith('did:web:')) {
    const withoutPrefix = keyId.slice('did:web:'.length);
    // Strip the fragment (#key-1, #main, etc.)
    const hashIndex = withoutPrefix.indexOf('#');
    const pathPart =
      hashIndex >= 0 ? withoutPrefix.slice(0, hashIndex) : withoutPrefix;
    // Domain is the first path segment (before any `:` path separator)
    const colonIndex = pathPart.indexOf(':');
    const encodedDomain =
      colonIndex >= 0 ? pathPart.slice(0, colonIndex) : pathPart;
    if (!encodedDomain) return null;
    // Decode percent-encoded colons (e.g., localhost%3A4000 → localhost:4000)
    try {
      return decodeURIComponent(encodedDomain);
    } catch {
      return null;
    }
  }

  // Instance key: domain#fragment (e.g., example.com#main, localhost:4000#main)
  const hashIndex = keyId.indexOf('#');
  if (hashIndex > 0) {
    const domain = keyId.slice(0, hashIndex);
    // Basic validation: must contain at least one dot or colon (port)
    if (domain.includes('.') || domain.includes(':')) {
      return domain;
    }
  }

  return null;
}

// ---------------------------------------------------------------------------
// Plugin
// ---------------------------------------------------------------------------

export default fp(
  async function federationAuthPlugin(app: FastifyInstance) {
    // Register raw body plugin for signature verification (scoped)
    const rawBodyPlugin = await import('fastify-raw-body');
    await app.register(rawBodyPlugin.default, {
      field: 'rawBody',
      global: true,
      encoding: 'utf8',
      runFirst: true,
    });

    // Decorate requests with federationPeer
    app.decorateRequest('federationPeer', null);

    // Pre-handler: verify HTTP signature on every request in this scope
    app.addHook(
      'preHandler',
      async (request: FastifyRequest, reply: FastifyReply) => {
        const signatureHeader = request.headers['signature'] as
          | string
          | undefined;
        const signatureInputHeader = request.headers['signature-input'] as
          | string
          | undefined;

        if (!signatureHeader || !signatureInputHeader) {
          return reply.status(401).send({ error: 'missing_signature' });
        }

        // Parse keyId from Signature-Input
        const keyIdMatch = signatureInputHeader.match(/keyid="([^"]+)"/);
        if (!keyIdMatch) {
          return reply.status(401).send({ error: 'invalid_signature_input' });
        }
        const keyId = keyIdMatch[1];

        // Extract domain from keyId
        const domain = extractDomainFromKeyId(keyId);
        if (!domain) {
          return reply.status(401).send({ error: 'invalid_key_id' });
        }

        // Look up active trusted peers for this domain across all orgs.
        // Uses superuser db — justified: this is a pre-auth S2S lookup with no
        // org context available. Only reads domain, publicKey, keyId, and status.
        // Same pattern as trust.service.ts handleInboundTrustAccept.
        const activePeers = await db
          .select({
            publicKey: trustedPeers.publicKey,
            keyId: trustedPeers.keyId,
          })
          .from(trustedPeers)
          .where(
            and(
              eq(trustedPeers.domain, domain),
              eq(trustedPeers.keyId, keyId),
              eq(trustedPeers.status, 'active'),
            ),
          )
          .limit(1);

        if (activePeers.length === 0) {
          return reply.status(401).send({ error: 'untrusted_peer' });
        }

        const peer = activePeers[0];

        // Build key lookup using stored public key (keyId already matched by DB query)
        const keyLookup = async (
          lookupKeyId: string,
        ): Promise<string | null> => {
          if (lookupKeyId === keyId) {
            return peer.publicKey;
          }
          return null;
        };

        // Reconstruct full URL for signature verification.
        // Use request.host (not hostname) to preserve the port for non-default ports.
        const fullUrl = `${request.protocol}://${request.host}${request.url}`;
        const rawBody = request.rawBody;

        try {
          const result = await verifyFederationSignature(
            { keyLookup },
            {
              method: request.method,
              url: fullUrl,
              headers: request.headers as Record<string, string>,
              body: rawBody,
            },
          );

          if (!result.valid) {
            return reply.status(401).send({ error: 'signature_invalid' });
          }
        } catch {
          return reply
            .status(401)
            .send({ error: 'signature_verification_error' });
        }

        // Decorate request with verified peer info
        request.federationPeer = { domain, keyId };
      },
    );
  },
  {
    name: 'federation-auth',
    fastify: '5.x',
  },
);
