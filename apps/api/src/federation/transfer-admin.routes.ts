import { z } from 'zod';
import type { FastifyInstance } from 'fastify';
import { transferListQuerySchema } from '@colophony/types';
import type { Env } from '../config/env.js';
import {
  transferService,
  TransferNotFoundError,
  TransferInvalidStateError,
} from '../services/transfer.service.js';

/**
 * Admin transfer management endpoints.
 * Behind normal auth hook chain — requires authenticated user with ADMIN role.
 */
export async function registerTransferAdminRoutes(
  app: FastifyInstance,
  _opts: { env: Env },
): Promise<void> {
  // preHandler: require ADMIN role
  app.addHook('preHandler', async (request, reply) => {
    if (!request.authContext?.roles?.includes('ADMIN')) {
      return reply.status(403).send({
        error: 'forbidden',
        message: 'ADMIN role required',
      });
    }
  });

  /**
   * GET /federation/transfers
   *
   * List all transfers for the current org.
   */
  app.get('/federation/transfers', async (request, reply) => {
    const parsed = transferListQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.status(400).send({
        error: 'invalid_query',
        details: parsed.error.issues,
      });
    }

    const orgId = request.authContext!.orgId!;
    const result = await transferService.listTransfersForOrg(
      orgId,
      parsed.data,
    );

    return reply.send(result);
  });

  /**
   * GET /federation/transfers/:id
   *
   * Get a single transfer by ID.
   */
  app.get('/federation/transfers/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const idSchema = z.string().uuid();
    const parsed = idSchema.safeParse(id);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'invalid_id' });
    }

    const orgId = request.authContext!.orgId!;

    try {
      const transfer = await transferService.getTransferById(orgId, id);
      return reply.send(transfer);
    } catch (err) {
      if (err instanceof TransferNotFoundError) {
        return reply.status(404).send({ error: err.message });
      }
      throw err;
    }
  });

  /**
   * POST /federation/transfers/:id/cancel
   *
   * Cancel a pending transfer.
   */
  app.post('/federation/transfers/:id/cancel', async (request, reply) => {
    const { id } = request.params as { id: string };
    const idSchema = z.string().uuid();
    const parsed = idSchema.safeParse(id);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'invalid_id' });
    }

    const orgId = request.authContext!.orgId!;
    const userId = request.authContext!.userId;

    try {
      await transferService.cancelTransfer(orgId, userId, id);
      return reply.send({ status: 'cancelled' });
    } catch (err) {
      if (err instanceof TransferNotFoundError) {
        return reply.status(404).send({ error: err.message });
      }
      if (err instanceof TransferInvalidStateError) {
        return reply.status(409).send({ error: err.message });
      }
      throw err;
    }
  });
}
