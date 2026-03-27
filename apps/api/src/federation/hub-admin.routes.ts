import type { FastifyInstance } from 'fastify';
import { hubInstanceListQuerySchema } from '@colophony/types';
import { idParamSchema } from '@colophony/types';
import type { Env } from '../config/env.js';
import {
  hubService,
  HubNotEnabledError,
  HubInstanceNotFoundError,
} from '../services/hub.service.js';

/**
 * Hub admin routes — OIDC + ADMIN role required.
 * Only functional when federation_config.mode = 'managed_hub'.
 */
export async function registerHubAdminRoutes(
  app: FastifyInstance,
  opts: { env: Env },
): Promise<void> {
  const { env } = opts;

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
   * GET /federation/hub/instances — List registered instances.
   */
  app.get('/federation/hub/instances', async (request, reply) => {
    try {
      await hubService.assertHubMode(env);
    } catch (err) {
      if (err instanceof HubNotEnabledError) {
        return reply.status(404).send({ error: 'hub_not_enabled' });
      }
      throw err;
    }

    const parsed = hubInstanceListQuerySchema.safeParse(request.query);
    const filter = parsed.success ? parsed.data : undefined;
    const instances = await hubService.listInstances(filter);
    return reply.send(instances);
  });

  /**
   * GET /federation/hub/instances/:id — Get instance details.
   */
  app.get('/federation/hub/instances/:id', async (request, reply) => {
    try {
      await hubService.assertHubMode(env);
    } catch (err) {
      if (err instanceof HubNotEnabledError) {
        return reply.status(404).send({ error: 'hub_not_enabled' });
      }
      throw err;
    }

    const params = idParamSchema.safeParse(request.params);
    if (!params.success) {
      return reply.status(400).send({
        error: 'invalid_id',
        details: params.error.issues,
      });
    }

    const instance = await hubService.getInstanceById(params.data.id);
    if (!instance) {
      return reply.status(404).send({ error: 'instance_not_found' });
    }

    return reply.send(instance);
  });

  /**
   * POST /federation/hub/instances/:id/suspend — Suspend an instance.
   */
  app.post('/federation/hub/instances/:id/suspend', async (request, reply) => {
    try {
      await hubService.assertHubMode(env);
    } catch (err) {
      if (err instanceof HubNotEnabledError) {
        return reply.status(404).send({ error: 'hub_not_enabled' });
      }
      throw err;
    }

    const params = idParamSchema.safeParse(request.params);
    if (!params.success) {
      return reply.status(400).send({
        error: 'invalid_id',
        details: params.error.issues,
      });
    }

    try {
      await hubService.suspendInstance(
        params.data.id,
        request.authContext!.userId,
      );
      return reply.status(200).send({ status: 'suspended' });
    } catch (err) {
      if (err instanceof HubInstanceNotFoundError) {
        return reply.status(404).send({ error: 'instance_not_found' });
      }
      throw err;
    }
  });

  /**
   * POST /federation/hub/instances/:id/revoke — Revoke an instance.
   */
  app.post('/federation/hub/instances/:id/revoke', async (request, reply) => {
    try {
      await hubService.assertHubMode(env);
    } catch (err) {
      if (err instanceof HubNotEnabledError) {
        return reply.status(404).send({ error: 'hub_not_enabled' });
      }
      throw err;
    }

    const params = idParamSchema.safeParse(request.params);
    if (!params.success) {
      return reply.status(400).send({
        error: 'invalid_id',
        details: params.error.issues,
      });
    }

    try {
      await hubService.revokeInstance(
        params.data.id,
        request.authContext!.userId,
      );
      return reply.status(200).send({ status: 'revoked' });
    } catch (err) {
      if (err instanceof HubInstanceNotFoundError) {
        return reply.status(404).send({ error: 'instance_not_found' });
      }
      throw err;
    }
  });
}
