import fp from 'fastify-plugin';
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { drizzle } from 'drizzle-orm/node-postgres';
import { appPool, type DrizzleDb } from '@colophony/db';
import type { PoolClient } from 'pg';

declare module 'fastify' {
  interface FastifyRequest {
    dbTx: DrizzleDb | null;
  }
}

// Store pg client on request to manage transaction lifecycle
const clientMap = new WeakMap<FastifyRequest, PoolClient>();

async function releaseClient(
  request: FastifyRequest,
  action: 'COMMIT' | 'ROLLBACK',
): Promise<void> {
  const client = clientMap.get(request);
  if (!client) return;

  try {
    await client.query(action);
  } finally {
    client.release();
    clientMap.delete(request);
    request.dbTx = null;
  }
}

export default fp(
  async function dbContextPlugin(app: FastifyInstance) {
    app.decorateRequest('dbTx', null);

    app.addHook(
      'onRequest',
      async function dbContextOnRequest(request: FastifyRequest) {
        // Only set up transaction if we have an authenticated user
        if (!request.authContext?.userId) return;

        const client = await appPool.connect();
        clientMap.set(request, client);

        await client.query('BEGIN');

        // Set user context (always available if authenticated)
        await client.query('SELECT set_config($1, $2, true)', [
          'app.user_id',
          request.authContext.userId,
        ]);

        // Set org context if resolved by org-context hook
        if (request.authContext.orgId) {
          await client.query('SELECT set_config($1, $2, true)', [
            'app.current_org',
            request.authContext.orgId,
          ]);
        }

        request.dbTx = drizzle(client);
      },
    );

    app.addHook(
      'onResponse',
      async function dbContextOnResponse(request: FastifyRequest) {
        await releaseClient(request, 'COMMIT');
      },
    );

    app.addHook(
      'onError',
      async function dbContextOnError(
        request: FastifyRequest,
        _reply: FastifyReply,
        _error: Error,
      ) {
        await releaseClient(request, 'ROLLBACK');
      },
    );
  },
  {
    name: 'colophony-db-context',
    dependencies: ['colophony-org-context'],
    fastify: '5.x',
  },
);
