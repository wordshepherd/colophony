import type { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import type { Env } from '../config/env.js';
import {
  federationService,
  FederationDisabledError,
  FederationNotConfiguredError,
  UserDidNotFoundError,
} from '../services/federation.service.js';

export async function registerFederationDidRoutes(
  app: FastifyInstance,
  opts: { env: Env },
): Promise<void> {
  const { env } = opts;

  // Permissive CORS — DID documents must be accessible from any origin.
  // Guard: skip if another scope already registered @fastify/cors (the
  // plugin decorates the root instance with 'corsPreflightEnabled').
  if (!app.hasRequestDecorator('corsPreflightEnabled')) {
    await app.register(cors, { origin: true, credentials: false });
  }

  // Instance DID document: did:web:<domain> → GET /.well-known/did.json
  app.get('/.well-known/did.json', async (_request, reply) => {
    try {
      const doc = await federationService.getInstanceDidDocument(env);
      return reply
        .header('content-type', 'application/did+json')
        .header('cache-control', 'public, max-age=3600')
        .send(doc);
    } catch (err) {
      if (
        err instanceof FederationDisabledError ||
        err instanceof FederationNotConfiguredError
      ) {
        return reply.status(503).send({ error: 'federation_unavailable' });
      }
      throw err;
    }
  });

  // User DID document: did:web:<domain>:users:<localPart> → GET /users/:localPart/did.json
  app.get('/users/:localPart/did.json', async (request, reply) => {
    const { localPart } = request.params as { localPart: string };

    // Sanitize: only allow alphanumeric, dots, hyphens, underscores
    if (!/^[\w.+-]+$/.test(localPart)) {
      return reply.status(400).send({ error: 'invalid_local_part' });
    }

    try {
      const doc = await federationService.getUserDidDocument(env, localPart);
      return reply
        .header('content-type', 'application/did+json')
        .header('cache-control', 'public, max-age=300')
        .send(doc);
    } catch (err) {
      if (
        err instanceof FederationDisabledError ||
        err instanceof FederationNotConfiguredError
      ) {
        return reply.status(503).send({ error: 'federation_unavailable' });
      }
      if (err instanceof UserDidNotFoundError) {
        return reply.status(404).send({ error: 'not_found' });
      }
      throw err;
    }
  });
}
