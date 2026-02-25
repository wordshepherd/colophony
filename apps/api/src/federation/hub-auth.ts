import fp from 'fastify-plugin';
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { db, hubRegisteredInstances, eq, and } from '@colophony/db';
import { verifyFederationSignature } from './http-signatures.js';
import { extractDomainFromKeyId } from './federation-auth.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface HubPeerContext {
  /** Verified remote domain extracted from the signature keyId */
  domain: string;
  /** The keyId from the verified signature */
  keyId: string;
  /** Hub-registered instance ID */
  instanceId: string;
}

declare module 'fastify' {
  interface FastifyRequest {
    hubPeer: HubPeerContext | null;
  }
}

// ---------------------------------------------------------------------------
// Plugin
// ---------------------------------------------------------------------------

export default fp(
  async function hubAuthPlugin(app: FastifyInstance) {
    // Register raw body plugin for signature verification (scoped)
    const rawBodyPlugin = await import('fastify-raw-body');
    await app.register(rawBodyPlugin.default, {
      field: 'rawBody',
      global: true,
      encoding: 'utf8',
      runFirst: true,
    });

    // Decorate requests with hubPeer
    app.decorateRequest('hubPeer', null);

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

        // Look up active registered instance for this domain.
        // Uses superuser db — justified: hub S2S pre-auth lookup with no
        // org context. Only reads domain, publicKey, keyId, and status.
        const [instance] = await db
          .select({
            id: hubRegisteredInstances.id,
            publicKey: hubRegisteredInstances.publicKey,
            keyId: hubRegisteredInstances.keyId,
          })
          .from(hubRegisteredInstances)
          .where(
            and(
              eq(hubRegisteredInstances.domain, domain),
              eq(hubRegisteredInstances.keyId, keyId),
              eq(hubRegisteredInstances.status, 'active'),
            ),
          )
          .limit(1);

        if (!instance) {
          return reply.status(401).send({ error: 'unregistered_instance' });
        }

        // Build key lookup using stored public key
        const keyLookup = async (
          lookupKeyId: string,
        ): Promise<string | null> => {
          if (lookupKeyId === keyId) {
            return instance.publicKey;
          }
          return null;
        };

        // Reconstruct full URL for signature verification
        const fullUrl = `${request.protocol}://${request.host}${request.url}`;
        const rawBody = (request as any).rawBody as string | undefined;

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

        // Decorate request with verified hub peer info
        request.hubPeer = { domain, keyId, instanceId: instance.id };
      },
    );
  },
  {
    name: 'hub-auth',
    fastify: '5.x',
  },
);
