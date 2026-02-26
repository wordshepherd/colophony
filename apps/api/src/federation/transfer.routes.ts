import type { FastifyInstance } from 'fastify';
import { transferInitiateRequestSchema } from '@colophony/types';
import { AuditActions, AuditResources } from '@colophony/types';
import type { Env } from '../config/env.js';
import {
  transferService,
  TransferTokenError,
  TransferFileNotFoundError,
  TransferCapabilityError,
} from '../services/transfer.service.js';
import { auditService } from '../services/audit.service.js';
import federationAuthPlugin from './federation-auth.js';
import federationRateLimitPlugin from './federation-rate-limit.js';

/**
 * S2S piece transfer endpoints.
 *
 * Dual-scope design:
 * - Scope 1: /initiate uses federationAuthPlugin (HTTP signature auth)
 * - Scope 2: /files uses JWT bearer auth (no HTTP signature)
 *
 * The federationAuthPlugin rejects requests without signatures (line 98-100),
 * so the file serve endpoint cannot share its scope.
 */
export async function registerTransferRoutes(
  app: FastifyInstance,
  opts: { env: Env },
): Promise<void> {
  const { env } = opts;

  // Scope 1: S2S initiation (HTTP signature auth via federationAuthPlugin)
  await app.register(async (s2s) => {
    await s2s.register(federationAuthPlugin);
    await s2s.register(federationRateLimitPlugin, {
      env,
      capability: 'transfer',
    });

    /**
     * POST /federation/v1/transfers/initiate
     *
     * Inbound S2S transfer initiation from a trusted peer.
     */
    s2s.post('/federation/v1/transfers/initiate', async (request, reply) => {
      if (!env.FEDERATION_ENABLED) {
        return reply.status(503).send({ error: 'federation_disabled' });
      }

      if (!request.federationPeer) {
        return reply.status(401).send({ error: 'no_federation_peer' });
      }

      const parsed = transferInitiateRequestSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          error: 'invalid_request',
          details: parsed.error.issues,
        });
      }

      try {
        const result = await transferService.handleInboundTransfer(
          env,
          request.federationPeer.domain,
          parsed.data,
        );

        return reply.status(202).send(result);
      } catch (err) {
        if (err instanceof TransferCapabilityError) {
          return reply.status(403).send({ error: err.message });
        }
        if (err instanceof TransferTokenError) {
          return reply.status(401).send({ error: err.message });
        }
        throw err;
      }
    });
  });

  // Scope 2: File serving (JWT bearer auth, no HTTP signature)
  /**
   * GET /federation/v1/transfers/:transferId/files/:fileId
   *
   * Serves a file from the origin instance using JWT bearer auth.
   */
  app.get(
    '/federation/v1/transfers/:transferId/files/:fileId',
    async (request, reply) => {
      if (!env.FEDERATION_ENABLED) {
        return reply.status(503).send({ error: 'federation_disabled' });
      }

      // Extract Bearer token
      const authHeader = request.headers['authorization'];
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return reply.status(401).send({ error: 'missing_bearer_token' });
      }
      const token = authHeader.slice(7);

      // Validate params
      const { transferId, fileId } = request.params as {
        transferId: string;
        fileId: string;
      };

      const uuidRegex =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(transferId) || !uuidRegex.test(fileId)) {
        return reply.status(400).send({ error: 'invalid_params' });
      }

      try {
        // Verify token and get context
        await transferService.verifyTransferToken(
          env,
          token,
          transferId,
          fileId,
        );

        // Get file stream
        const { stream, filename, mimeType, size } =
          await transferService.getFileStream(env, transferId, fileId);

        // Audit: log file serve (no org context in this scope — logDirect)
        await auditService.logDirect({
          resource: AuditResources.TRANSFER,
          action: AuditActions.TRANSFER_FILE_SERVED,
          newValue: { transferId, fileId },
        });

        return reply
          .header('content-type', mimeType)
          .header('content-length', size)
          .header(
            'content-disposition',
            `attachment; filename="${encodeURIComponent(filename)}"`,
          )
          .send(stream);
      } catch (err) {
        if (err instanceof TransferTokenError) {
          return reply.status(401).send({ error: err.message });
        }
        if (err instanceof TransferFileNotFoundError) {
          return reply.status(404).send({ error: err.message });
        }
        throw err;
      }
    },
  );
}
