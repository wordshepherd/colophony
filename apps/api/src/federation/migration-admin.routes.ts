import { z } from 'zod';
import type { FastifyInstance } from 'fastify';
import {
  requestMigrationInputSchema,
  migrationListQuerySchema,
} from '@colophony/types';
import type { Env } from '../config/env.js';
import {
  migrationService,
  MigrationNotFoundError,
  MigrationInvalidStateError,
  MigrationCapabilityError,
  MigrationAlreadyActiveError,
} from '../services/migration.service.js';
import { validateEnv } from '../config/env.js';

/**
 * Migration management endpoints for authenticated users.
 *
 * No ADMIN role requirement — any authenticated user manages their own migrations.
 * User-scoped RLS provides isolation.
 */
export async function registerMigrationAdminRoutes(
  app: FastifyInstance,
  _opts: { env: Env },
): Promise<void> {
  /**
   * GET /federation/migrations
   *
   * List user's own migrations.
   */
  app.get('/federation/migrations', async (request, reply) => {
    if (!request.authContext) {
      return reply.status(401).send({ error: 'unauthorized' });
    }

    const parsed = migrationListQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.status(400).send({
        error: 'invalid_query',
        details: parsed.error.issues,
      });
    }

    const result = await migrationService.listMigrationsForUser(
      request.authContext.userId,
      parsed.data,
    );

    return reply.send(result);
  });

  /**
   * GET /federation/migrations/pending
   *
   * Get pending approval migrations for the user (outbound, awaiting user action).
   */
  app.get('/federation/migrations/pending', async (request, reply) => {
    if (!request.authContext) {
      return reply.status(401).send({ error: 'unauthorized' });
    }

    const result = await migrationService.getPendingApprovalForUser(
      request.authContext.userId,
    );

    return reply.send({ migrations: result });
  });

  /**
   * GET /federation/migrations/:id
   *
   * Get a single migration by ID.
   */
  app.get('/federation/migrations/:id', async (request, reply) => {
    if (!request.authContext) {
      return reply.status(401).send({ error: 'unauthorized' });
    }

    const { id } = request.params as { id: string };
    const idSchema = z.string().uuid();
    const parsed = idSchema.safeParse(id);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'invalid_id' });
    }

    try {
      const migration = await migrationService.getMigrationById(
        request.authContext.userId,
        id,
      );
      return reply.send(migration);
    } catch (err) {
      if (err instanceof MigrationNotFoundError) {
        return reply.status(404).send({ error: err.message });
      }
      throw err;
    }
  });

  /**
   * POST /federation/migrations/request
   *
   * Initiate a migration request from destination side.
   */
  app.post('/federation/migrations/request', async (request, reply) => {
    if (!request.authContext) {
      return reply.status(401).send({ error: 'unauthorized' });
    }

    const parsed = requestMigrationInputSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: 'invalid_request',
        details: parsed.error.issues,
      });
    }

    try {
      const env = validateEnv();
      const result = await migrationService.requestMigration(env, {
        userId: request.authContext.userId,
        organizationId: parsed.data.organizationId,
        originDomain: parsed.data.originDomain,
        originEmail: parsed.data.originEmail,
      });
      return reply.status(202).send(result);
    } catch (err) {
      if (err instanceof MigrationCapabilityError) {
        return reply.status(403).send({ error: err.message });
      }
      if (err instanceof MigrationAlreadyActiveError) {
        return reply.status(409).send({ error: err.message });
      }
      if (err instanceof MigrationInvalidStateError) {
        return reply.status(409).send({ error: err.message });
      }
      throw err;
    }
  });

  /**
   * POST /federation/migrations/:id/approve
   *
   * User approves a pending outbound migration.
   */
  app.post('/federation/migrations/:id/approve', async (request, reply) => {
    if (!request.authContext) {
      return reply.status(401).send({ error: 'unauthorized' });
    }

    const { id } = request.params as { id: string };
    const idSchema = z.string().uuid();
    const parsed = idSchema.safeParse(id);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'invalid_id' });
    }

    try {
      const env = validateEnv();
      await migrationService.approveMigration(env, {
        userId: request.authContext.userId,
        migrationId: id,
      });
      return reply.send({ status: 'approved' });
    } catch (err) {
      if (err instanceof MigrationNotFoundError) {
        return reply.status(404).send({ error: err.message });
      }
      if (err instanceof MigrationInvalidStateError) {
        return reply.status(409).send({ error: err.message });
      }
      throw err;
    }
  });

  /**
   * POST /federation/migrations/:id/reject
   *
   * User rejects a pending outbound migration.
   */
  app.post('/federation/migrations/:id/reject', async (request, reply) => {
    if (!request.authContext) {
      return reply.status(401).send({ error: 'unauthorized' });
    }

    const { id } = request.params as { id: string };
    const idSchema = z.string().uuid();
    const parsed = idSchema.safeParse(id);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'invalid_id' });
    }

    try {
      const env = validateEnv();
      await migrationService.rejectMigration(env, {
        userId: request.authContext.userId,
        migrationId: id,
      });
      return reply.send({ status: 'rejected' });
    } catch (err) {
      if (err instanceof MigrationNotFoundError) {
        return reply.status(404).send({ error: err.message });
      }
      if (err instanceof MigrationInvalidStateError) {
        return reply.status(409).send({ error: err.message });
      }
      throw err;
    }
  });

  /**
   * POST /federation/migrations/:id/cancel
   *
   * Cancel a migration.
   */
  app.post('/federation/migrations/:id/cancel', async (request, reply) => {
    if (!request.authContext) {
      return reply.status(401).send({ error: 'unauthorized' });
    }

    const { id } = request.params as { id: string };
    const idSchema = z.string().uuid();
    const parsed = idSchema.safeParse(id);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'invalid_id' });
    }

    try {
      await migrationService.cancelMigration(request.authContext.userId, id);
      return reply.send({ status: 'cancelled' });
    } catch (err) {
      if (err instanceof MigrationNotFoundError) {
        return reply.status(404).send({ error: err.message });
      }
      if (err instanceof MigrationInvalidStateError) {
        return reply.status(409).send({ error: err.message });
      }
      throw err;
    }
  });
}
