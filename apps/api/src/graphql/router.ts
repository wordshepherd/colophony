import type { FastifyInstance } from 'fastify';
import { createGraphQLYoga } from './yoga.js';

/**
 * Fastify plugin that mounts GraphQL Yoga at `/graphql`.
 *
 * `/graphql` is NOT in PUBLIC_EXACT — the auth hook runs normally, so
 * unauthenticated requests get a 401. GraphiQL (dev only) requires a
 * Bearer token, same as REST `/v1/docs` "Try it" requiring auth.
 *
 * Registered as a child scope of the main app so it inherits all
 * app-level hooks (rate-limit, auth, org-context, db-context, audit).
 */
export async function registerGraphQLRoutes(
  app: FastifyInstance,
): Promise<void> {
  const yoga = createGraphQLYoga();

  // Yoga handles body parsing itself — remove Fastify's content-type parsers
  // in this scoped plugin to avoid conflicts.
  app.removeAllContentTypeParsers();
  app.addContentTypeParser('*', (_req, _payload, done) => {
    done(null, undefined);
  });

  app.route({
    url: '/graphql',
    method: ['GET', 'POST', 'OPTIONS'],
    handler: async (req, reply) => {
      const response = await yoga.handleNodeRequestAndResponse(req, reply, {
        req,
        reply,
      });

      response.headers.forEach((value, key) => {
        void reply.header(key, value);
      });

      reply.status(response.status);
      reply.send(response.body);
      return reply;
    },
  });
}
