import { createYoga } from 'graphql-yoga';
import type { FastifyRequest, FastifyReply } from 'fastify';
import { schema } from './schema.js';
import { buildGraphQLContext } from './context.js';

export function createGraphQLYoga() {
  return createYoga<{
    req: FastifyRequest;
    reply: FastifyReply;
  }>({
    schema,
    context: ({ req }) => buildGraphQLContext(req),
    // GraphiQL is behind auth (the route is not in PUBLIC_EXACT),
    // so it's safe to enable in dev — users must provide a Bearer token.
    graphiql: process.env.NODE_ENV !== 'production',
    logging: false, // Fastify handles logging
  });
}
