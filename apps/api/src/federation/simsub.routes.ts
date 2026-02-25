import type { FastifyInstance } from 'fastify';
import { simSubCheckRequestSchema } from '@colophony/types';
import { AuditActions, AuditResources } from '@colophony/types';
import type { Env } from '../config/env.js';
import { simsubService } from '../services/simsub.service.js';
import { auditService } from '../services/audit.service.js';
import federationAuthPlugin from './federation-auth.js';

/**
 * S2S sim-sub check endpoint.
 * Signature-verified via federation-auth plugin. Must be registered
 * in an isolated Fastify scope.
 */
export async function registerSimSubRoutes(
  app: FastifyInstance,
  opts: { env: Env },
): Promise<void> {
  const { env } = opts;

  // Federation signature verification (scoped — includes raw body plugin)
  await app.register(federationAuthPlugin);

  /**
   * POST /federation/v1/sim-sub/check
   *
   * Inbound S2S sim-sub fingerprint check from a trusted peer.
   */
  app.post('/federation/v1/sim-sub/check', async (request, reply) => {
    if (!env.FEDERATION_ENABLED) {
      return reply.status(503).send({ error: 'federation_disabled' });
    }

    if (!request.federationPeer) {
      return reply.status(401).send({ error: 'no_federation_peer' });
    }

    const parsed = simSubCheckRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: 'invalid_request',
        details: parsed.error.issues,
      });
    }

    const result = await simsubService.handleInboundCheck(
      env,
      parsed.data.submitterDid,
      parsed.data.fingerprint,
    );

    // Audit: log inbound check (no org context — logDirect)
    await auditService.logDirect({
      resource: AuditResources.SIMSUB,
      action: AuditActions.SIMSUB_INBOUND_CHECK,
      newValue: {
        requestingDomain: parsed.data.requestingDomain,
        submitterDid: parsed.data.submitterDid,
        found: result.found,
      },
    });

    return reply.send(result);
  });
}
