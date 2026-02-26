import type { FastifyInstance } from 'fastify';
import {
  migrationInitiateRequestSchema,
  migrationBundleDeliverySchema,
  migrationCompleteNotifySchema,
  migrationBroadcastSchema,
  migrationFileParamsSchema,
  AuditActions,
  AuditResources,
} from '@colophony/types';
import type { Env } from '../config/env.js';
import {
  migrationService,
  MigrationTokenError,
  MigrationCapabilityError,
  MigrationAlreadyActiveError,
  MigrationUserNotFoundError,
  MigrationNotFoundError,
  MigrationInvalidStateError,
} from '../services/migration.service.js';
import { auditService } from '../services/audit.service.js';
import federationAuthPlugin from './federation-auth.js';
import federationRateLimitPlugin from './federation-rate-limit.js';

/**
 * S2S identity migration endpoints.
 *
 * Dual-scope design (same as transfer.routes.ts):
 * - Scope 1: HTTP signature auth (via federationAuthPlugin) for S2S endpoints
 * - Scope 2: JWT bearer auth for file serving (no HTTP signature)
 */
export async function registerMigrationRoutes(
  app: FastifyInstance,
  opts: { env: Env },
): Promise<void> {
  const { env } = opts;

  // Scope 1: S2S endpoints (HTTP signature auth via federationAuthPlugin)
  await app.register(async (s2s) => {
    await s2s.register(federationAuthPlugin);
    await s2s.register(federationRateLimitPlugin, {
      env,
      capability: 'migration',
    });

    /**
     * POST /federation/v1/migrations/request
     *
     * Inbound S2S migration request from destination instance.
     */
    s2s.post('/federation/v1/migrations/request', async (request, reply) => {
      if (!env.FEDERATION_ENABLED) {
        return reply.status(503).send({ error: 'federation_disabled' });
      }

      if (!request.federationPeer) {
        return reply.status(401).send({ error: 'no_federation_peer' });
      }

      const parsed = migrationInitiateRequestSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          error: 'invalid_request',
          details: parsed.error.issues,
        });
      }

      try {
        const result = await migrationService.handleMigrationRequest(
          env,
          request.federationPeer.domain,
          parsed.data,
        );
        return reply.status(202).send(result);
      } catch (err) {
        if (err instanceof MigrationUserNotFoundError) {
          return reply.status(404).send({ error: err.message });
        }
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
     * POST /federation/v1/migrations/bundle-delivery
     *
     * Inbound S2S bundle delivery from origin instance.
     */
    s2s.post(
      '/federation/v1/migrations/bundle-delivery',
      async (request, reply) => {
        if (!env.FEDERATION_ENABLED) {
          return reply.status(503).send({ error: 'federation_disabled' });
        }

        if (!request.federationPeer) {
          return reply.status(401).send({ error: 'no_federation_peer' });
        }

        const parsed = migrationBundleDeliverySchema.safeParse(request.body);
        if (!parsed.success) {
          return reply.status(400).send({
            error: 'invalid_request',
            details: parsed.error.issues,
          });
        }

        try {
          const result = await migrationService.handleBundleDelivery(
            env,
            request.federationPeer.domain,
            parsed.data,
          );
          return reply.status(202).send(result);
        } catch (err) {
          if (err instanceof MigrationNotFoundError) {
            return reply.status(404).send({ error: err.message });
          }
          if (err instanceof MigrationInvalidStateError) {
            return reply.status(409).send({ error: err.message });
          }
          throw err;
        }
      },
    );

    /**
     * POST /federation/v1/migrations/complete
     *
     * Inbound S2S completion notification from destination instance.
     */
    s2s.post('/federation/v1/migrations/complete', async (request, reply) => {
      if (!env.FEDERATION_ENABLED) {
        return reply.status(503).send({ error: 'federation_disabled' });
      }

      if (!request.federationPeer) {
        return reply.status(401).send({ error: 'no_federation_peer' });
      }

      const parsed = migrationCompleteNotifySchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          error: 'invalid_request',
          details: parsed.error.issues,
        });
      }

      try {
        await migrationService.handleMigrationComplete(
          env,
          request.federationPeer.domain,
          parsed.data,
        );
        return reply.status(200).send({ status: 'ok' });
      } catch (err) {
        if (err instanceof MigrationNotFoundError) {
          return reply.status(404).send({ error: err.message });
        }
        throw err;
      }
    });

    /**
     * POST /federation/v1/migrations/broadcast
     *
     * Inbound S2S migration broadcast from origin instance.
     */
    s2s.post('/federation/v1/migrations/broadcast', async (request, reply) => {
      if (!env.FEDERATION_ENABLED) {
        return reply.status(503).send({ error: 'federation_disabled' });
      }

      if (!request.federationPeer) {
        return reply.status(401).send({ error: 'no_federation_peer' });
      }

      const parsed = migrationBroadcastSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          error: 'invalid_request',
          details: parsed.error.issues,
        });
      }

      await migrationService.handleMigrationBroadcast(
        env,
        request.federationPeer.domain,
        parsed.data,
      );
      return reply.status(200).send({ status: 'ok' });
    });
  });

  // Scope 2: File serving (JWT bearer auth, no HTTP signature)
  /**
   * GET /federation/v1/migrations/:migrationId/submissions/:submissionId/files/:fileId
   *
   * Serves a file from the origin instance using JWT bearer auth.
   */
  app.get(
    '/federation/v1/migrations/:migrationId/submissions/:submissionId/files/:fileId',
    async (request, reply) => {
      if (!env.FEDERATION_ENABLED) {
        return reply.status(503).send({ error: 'federation_disabled' });
      }

      const paramsParsed = migrationFileParamsSchema.safeParse(request.params);
      if (!paramsParsed.success) {
        return reply.status(400).send({
          error: 'invalid_params',
          details: paramsParsed.error.issues,
        });
      }

      const { migrationId, submissionId, fileId } = paramsParsed.data;

      // Extract JWT from Authorization header
      const authHeader = request.headers.authorization;
      if (!authHeader?.startsWith('Bearer ')) {
        return reply.status(401).send({ error: 'missing_bearer_token' });
      }
      const token = authHeader.slice(7);

      try {
        const { userId } = await migrationService.verifyMigrationToken(
          env,
          token,
          migrationId,
          submissionId,
          fileId,
        );

        const { stream, filename, mimeType, size } =
          await migrationService.getFileStream(env, fileId);

        // Audit (fire-and-forget)
        void auditService
          .logDirect({
            resource: AuditResources.MIGRATION,
            action: AuditActions.MIGRATION_FILE_SERVED,
            resourceId: migrationId,
            actorId: userId,
            newValue: { fileId, filename },
          })
          .catch(() => {});

        void reply.header('content-type', mimeType);
        void reply.header(
          'content-disposition',
          `attachment; filename="${filename}"`,
        );
        void reply.header('content-length', String(size));

        return reply.send(stream);
      } catch (err) {
        if (err instanceof MigrationTokenError) {
          return reply.status(401).send({ error: err.message });
        }
        throw err;
      }
    },
  );
}
