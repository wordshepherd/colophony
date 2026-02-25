import type { FastifyInstance } from 'fastify';
import {
  trustRequestSchema,
  trustAcceptSchema,
  hubAttestationTrustRequestSchema,
} from '@colophony/types';
import type { Env } from '../config/env.js';
import {
  trustService,
  TrustSignatureVerificationError,
} from '../services/trust.service.js';

/**
 * Public server-to-server federation trust endpoints.
 * Signature-verified (not OIDC). Must be registered in an isolated Fastify scope.
 */
export async function registerFederationTrustRoutes(
  app: FastifyInstance,
  opts: { env: Env },
): Promise<void> {
  const { env } = opts;

  // Register raw body plugin for signature verification (scoped)
  const rawBodyPlugin = await import('fastify-raw-body');
  await app.register(rawBodyPlugin.default, {
    field: 'rawBody',
    global: true,
    encoding: 'utf8',
    runFirst: true,
  });

  /**
   * POST /federation/trust — Inbound trust request from a remote instance.
   * Signature-verified via HTTP Message Signatures.
   */
  app.post('/federation/trust', async (request, reply) => {
    if (!env.FEDERATION_ENABLED) {
      return reply.status(503).send({ error: 'federation_disabled' });
    }

    const parsed = trustRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: 'invalid_request',
        details: parsed.error.issues,
      });
    }

    try {
      const rawBody = (request as any).rawBody as string;
      const result = await trustService.handleInboundTrustRequest(
        env,
        parsed.data,
        request.headers as Record<string, string>,
        request.method,
        `${request.protocol}://${request.hostname}${request.url}`,
        rawBody,
      );

      return reply.status(202).send({
        status: 'pending',
        orgCount: result.orgIds.length,
      });
    } catch (err) {
      if (err instanceof TrustSignatureVerificationError) {
        return reply.status(401).send({ error: 'signature_invalid' });
      }
      throw err;
    }
  });

  /**
   * POST /federation/trust/accept — Inbound trust accept from a remote instance.
   * Signature-verified via HTTP Message Signatures.
   */
  app.post('/federation/trust/accept', async (request, reply) => {
    if (!env.FEDERATION_ENABLED) {
      return reply.status(503).send({ error: 'federation_disabled' });
    }

    const parsed = trustAcceptSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: 'invalid_request',
        details: parsed.error.issues,
      });
    }

    try {
      const rawBody = (request as any).rawBody as string;
      await trustService.handleInboundTrustAccept(
        env,
        parsed.data,
        request.headers as Record<string, string>,
        request.method,
        `${request.protocol}://${request.hostname}${request.url}`,
        rawBody,
      );

      return reply.status(200).send({ status: 'accepted' });
    } catch (err) {
      if (err instanceof TrustSignatureVerificationError) {
        return reply.status(401).send({ error: 'signature_invalid' });
      }
      throw err;
    }
  });

  /**
   * POST /federation/trust/hub-attested — Hub-attested auto-trust.
   * No bilateral flow — creates active peers directly if attestation is valid.
   */
  app.post('/federation/trust/hub-attested', async (request, reply) => {
    if (!env.FEDERATION_ENABLED) {
      return reply.status(503).send({ error: 'federation_disabled' });
    }

    // Verify HTTP signature (same as other trust routes — proves possession of attested key)
    if (!request.federationPeer) {
      return reply.status(401).send({ error: 'signature_required' });
    }

    const parsed = hubAttestationTrustRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: 'invalid_request',
        details: parsed.error.issues,
      });
    }

    // Ensure the authenticated peer matches the request body domain
    if (request.federationPeer.domain !== parsed.data.domain) {
      return reply.status(403).send({ error: 'domain_mismatch' });
    }

    try {
      const result = await trustService.handleHubAttestedTrust(
        env,
        parsed.data,
      );

      return reply.status(200).send({
        status: 'trusted',
        orgCount: result.orgIds.length,
      });
    } catch (err) {
      if (err instanceof TrustSignatureVerificationError) {
        return reply.status(401).send({ error: 'attestation_invalid' });
      }
      throw err;
    }
  });
}
