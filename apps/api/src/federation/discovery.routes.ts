import type { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import { webFingerQuerySchema } from '@colophony/types';
import type { Env } from '../config/env.js';
import {
  federationService,
  FederationDisabledError,
  FederationNotConfiguredError,
  WebFingerUserNotFoundError,
  WebFingerDomainMismatchError,
} from '../services/federation.service.js';

export async function registerFederationDiscoveryRoutes(
  app: FastifyInstance,
  opts: { env: Env },
): Promise<void> {
  const { env } = opts;

  // Override app-level CORS for federation routes — RFC 7033 requires
  // WebFinger to be accessible from any origin
  await app.register(cors, { origin: true, credentials: false });

  app.get('/.well-known/colophony', async (_request, reply) => {
    try {
      const metadata = await federationService.getInstanceMetadata(env);
      return reply
        .header('cache-control', 'public, max-age=3600')
        .header('content-type', 'application/json')
        .send(metadata);
    } catch (err) {
      if (err instanceof FederationDisabledError) {
        return reply.status(503).send({ error: 'federation_disabled' });
      }
      if (err instanceof FederationNotConfiguredError) {
        return reply.status(503).send({ error: 'federation_not_configured' });
      }
      throw err;
    }
  });

  app.get('/.well-known/webfinger', async (request, reply) => {
    const parsed = webFingerQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.status(400).send({
        error: 'invalid_request',
        details: parsed.error.issues,
      });
    }

    try {
      const result = await federationService.resolveWebFinger(
        env,
        parsed.data.resource,
      );
      return reply
        .header('content-type', 'application/jrd+json')
        .header('access-control-allow-origin', '*')
        .send(result);
    } catch (err) {
      if (err instanceof FederationDisabledError) {
        return reply.status(503).send({ error: 'federation_disabled' });
      }
      if (
        err instanceof WebFingerUserNotFoundError ||
        err instanceof WebFingerDomainMismatchError
      ) {
        return reply.status(404).send({ error: 'not_found' });
      }
      throw err;
    }
  });
}
