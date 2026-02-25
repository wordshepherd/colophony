import type { FastifyInstance } from 'fastify';
import {
  domainParamSchema,
  initiateTrustSchema,
  peerActionSchema,
  idParamSchema,
} from '@colophony/types';
import type { Env } from '../config/env.js';
import {
  trustService,
  TrustPeerNotFoundError,
  TrustPeerAlreadyExistsError,
  TrustPeerInvalidStateError,
  RemoteMetadataFetchError,
} from '../services/trust.service.js';

/**
 * Admin federation trust management endpoints.
 * Behind normal auth hook chain — requires authenticated user with ADMIN role.
 */
export async function registerFederationTrustAdminRoutes(
  app: FastifyInstance,
  opts: { env: Env },
): Promise<void> {
  const { env } = opts;

  // preHandler: require ADMIN role
  app.addHook('preHandler', async (request, reply) => {
    if (!request.authContext?.role || request.authContext.role !== 'ADMIN') {
      return reply.status(403).send({
        error: 'forbidden',
        message: 'ADMIN role required',
      });
    }
  });

  /**
   * GET /federation/metadata/:domain — Preview remote instance metadata.
   */
  app.get('/federation/metadata/:domain', async (request, reply) => {
    const params = domainParamSchema.safeParse(request.params);
    if (!params.success) {
      return reply.status(400).send({
        error: 'invalid_domain',
        details: params.error.issues,
      });
    }

    try {
      const preview = await trustService.fetchRemoteMetadata(
        params.data.domain,
      );
      return reply.send(preview);
    } catch (err) {
      if (err instanceof RemoteMetadataFetchError) {
        return reply.status(502).send({
          error: 'remote_fetch_failed',
          message: err.message,
        });
      }
      throw err;
    }
  });

  /**
   * POST /federation/peers/initiate — Initiate trust with a remote instance.
   */
  app.post('/federation/peers/initiate', async (request, reply) => {
    const parsed = initiateTrustSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: 'invalid_request',
        details: parsed.error.issues,
      });
    }

    try {
      const peer = await trustService.initiateTrust(
        env,
        request.authContext!.orgId!,
        parsed.data,
        request.authContext!.userId,
      );
      return reply.status(201).send(peer);
    } catch (err) {
      if (err instanceof TrustPeerAlreadyExistsError) {
        return reply.status(409).send({
          error: 'peer_already_exists',
          message: err.message,
        });
      }
      if (err instanceof RemoteMetadataFetchError) {
        return reply.status(502).send({
          error: 'remote_fetch_failed',
          message: err.message,
        });
      }
      throw err;
    }
  });

  /**
   * GET /federation/peers — List all trusted peers.
   */
  app.get('/federation/peers', async (request, reply) => {
    const peers = await trustService.listPeers(request.authContext!.orgId!);
    return reply.send(peers);
  });

  /**
   * GET /federation/peers/:id — Get a specific trusted peer.
   */
  app.get('/federation/peers/:id', async (request, reply) => {
    const params = idParamSchema.safeParse(request.params);
    if (!params.success) {
      return reply.status(400).send({
        error: 'invalid_id',
        details: params.error.issues,
      });
    }

    try {
      const peer = await trustService.getPeerById(
        request.authContext!.orgId!,
        params.data.id,
      );
      return reply.send(peer);
    } catch (err) {
      if (err instanceof TrustPeerNotFoundError) {
        return reply.status(404).send({
          error: 'peer_not_found',
          message: err.message,
        });
      }
      throw err;
    }
  });

  /**
   * POST /federation/peers/:id/accept — Accept a pending inbound trust request.
   */
  app.post('/federation/peers/:id/accept', async (request, reply) => {
    const params = idParamSchema.safeParse(request.params);
    if (!params.success) {
      return reply.status(400).send({
        error: 'invalid_id',
        details: params.error.issues,
      });
    }

    const body = peerActionSchema.safeParse(request.body ?? {});
    if (!body.success) {
      return reply.status(400).send({
        error: 'invalid_request',
        details: body.error.issues,
      });
    }

    try {
      const peer = await trustService.acceptInboundTrust(
        env,
        request.authContext!.orgId!,
        params.data.id,
        body.data,
        request.authContext!.userId,
      );
      return reply.send(peer);
    } catch (err) {
      if (err instanceof TrustPeerNotFoundError) {
        return reply.status(404).send({
          error: 'peer_not_found',
          message: err.message,
        });
      }
      if (err instanceof TrustPeerInvalidStateError) {
        return reply.status(409).send({
          error: 'invalid_peer_state',
          message: err.message,
        });
      }
      throw err;
    }
  });

  /**
   * POST /federation/peers/:id/reject — Reject a pending inbound trust request.
   */
  app.post('/federation/peers/:id/reject', async (request, reply) => {
    const params = idParamSchema.safeParse(request.params);
    if (!params.success) {
      return reply.status(400).send({
        error: 'invalid_id',
        details: params.error.issues,
      });
    }

    try {
      const peer = await trustService.rejectTrust(
        request.authContext!.orgId!,
        params.data.id,
        request.authContext!.userId,
      );
      return reply.send(peer);
    } catch (err) {
      if (err instanceof TrustPeerNotFoundError) {
        return reply.status(404).send({
          error: 'peer_not_found',
          message: err.message,
        });
      }
      if (err instanceof TrustPeerInvalidStateError) {
        return reply.status(409).send({
          error: 'invalid_peer_state',
          message: err.message,
        });
      }
      throw err;
    }
  });

  /**
   * POST /federation/peers/:id/revoke — Revoke an active trust relationship.
   */
  app.post('/federation/peers/:id/revoke', async (request, reply) => {
    const params = idParamSchema.safeParse(request.params);
    if (!params.success) {
      return reply.status(400).send({
        error: 'invalid_id',
        details: params.error.issues,
      });
    }

    try {
      const peer = await trustService.revokeTrust(
        request.authContext!.orgId!,
        params.data.id,
        request.authContext!.userId,
      );
      return reply.send(peer);
    } catch (err) {
      if (err instanceof TrustPeerNotFoundError) {
        return reply.status(404).send({
          error: 'peer_not_found',
          message: err.message,
        });
      }
      if (err instanceof TrustPeerInvalidStateError) {
        return reply.status(409).send({
          error: 'invalid_peer_state',
          message: err.message,
        });
      }
      throw err;
    }
  });
}
