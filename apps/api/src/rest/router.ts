import type { FastifyInstance } from 'fastify';
import { OpenAPIHandler } from '@orpc/openapi/fastify';
import { OpenAPIReferencePlugin } from '@orpc/openapi/plugins';
import { organizationsRouter } from './routers/organizations.js';
import { submissionsRouter } from './routers/submissions.js';
import { filesRouter } from './routers/files.js';
import { usersRouter } from './routers/users.js';
import { apiKeysRouter } from './routers/api-keys.js';
import type { RestContext } from './context.js';

const restRouter = {
  organizations: organizationsRouter,
  submissions: submissionsRouter,
  files: filesRouter,
  users: usersRouter,
  apiKeys: apiKeysRouter,
};

const openApiHandler = new OpenAPIHandler<RestContext>(restRouter, {
  plugins: [
    new OpenAPIReferencePlugin({
      specPath: '/openapi.json',
      docsPath: '/docs',
      specGenerateOptions: {
        info: {
          title: 'Colophony API',
          version: '2.0.0',
          description: 'REST API for the Colophony literary magazine platform.',
        },
        servers: [{ url: '/v1' }],
      },
    }),
  ],
});

/**
 * Fastify plugin that registers the oRPC REST API surface at `/v1/*`.
 *
 * Registered as a child scope of the main app so it inherits all app-level
 * hooks (auth, rate-limit, org-context, db-context, audit). The wildcard
 * content-type parser is scoped to this plugin to avoid conflicts with
 * tRPC and webhook routes.
 */
export async function registerRestRoutes(app: FastifyInstance): Promise<void> {
  // Scope the wildcard content-type parser to this plugin only.
  // oRPC needs to handle body parsing itself for all content types.
  app.removeAllContentTypeParsers();
  app.addContentTypeParser('*', (_req, _payload, done) => {
    done(null, undefined);
  });

  app.all('/v1/*', async (req, reply) => {
    const { matched } = await openApiHandler.handle(req, reply, {
      prefix: '/v1',
      context: {
        authContext: req.authContext,
        dbTx: req.dbTx,
        audit: req.audit,
      },
    });

    if (!matched) {
      reply.status(404).send({
        error: 'not_found',
        message: 'Route not found',
      });
    }
  });
}
