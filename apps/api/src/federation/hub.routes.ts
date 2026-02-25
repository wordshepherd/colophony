import type { FastifyInstance } from 'fastify';
import {
  hubRegistrationRequestSchema,
  hubFingerprintRegisterSchema,
  hubFingerprintQuerySchema,
} from '@colophony/types';
import type { Env } from '../config/env.js';
import {
  hubService,
  HubNotEnabledError,
  HubInvalidRegistrationTokenError,
  HubInstanceAlreadyRegisteredError,
  HubInstanceSuspendedError,
} from '../services/hub.service.js';
import hubAuthPlugin from './hub-auth.js';

/**
 * Hub S2S routes — registration (bearer token) + authenticated hub operations.
 * Must be registered in an isolated Fastify scope.
 */
export async function registerHubRoutes(
  app: FastifyInstance,
  opts: { env: Env },
): Promise<void> {
  const { env } = opts;

  /**
   * POST /federation/v1/hub/register — Register a new managed instance.
   * Auth: Bearer token (HUB_REGISTRATION_TOKEN).
   */
  app.post('/federation/v1/hub/register', async (request, reply) => {
    try {
      await hubService.assertHubMode(env);
    } catch (err) {
      if (err instanceof HubNotEnabledError) {
        return reply.status(404).send({ error: 'hub_not_enabled' });
      }
      throw err;
    }

    const parsed = hubRegistrationRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: 'invalid_request',
        details: parsed.error.issues,
      });
    }

    try {
      const result = await hubService.registerInstance(env, parsed.data);
      return reply.status(200).send(result);
    } catch (err) {
      if (err instanceof HubInvalidRegistrationTokenError) {
        return reply.status(401).send({ error: 'invalid_registration_token' });
      }
      if (err instanceof HubInstanceAlreadyRegisteredError) {
        return reply.status(409).send({ error: 'instance_already_registered' });
      }
      throw err;
    }
  });

  // Authenticated hub routes — HTTP signature via hubAuthPlugin
  await app.register(async (scope) => {
    await scope.register(hubAuthPlugin);

    /**
     * POST /federation/v1/hub/refresh — Refresh attestation.
     */
    scope.post('/federation/v1/hub/refresh', async (request, reply) => {
      try {
        await hubService.assertHubMode(env);
      } catch (err) {
        if (err instanceof HubNotEnabledError) {
          return reply.status(404).send({ error: 'hub_not_enabled' });
        }
        throw err;
      }

      const domain = request.hubPeer!.domain;

      try {
        const result = await hubService.refreshAttestation(env, domain);
        return reply.status(200).send({
          attestationToken: result.attestationToken,
          expiresAt: result.expiresAt.toISOString(),
        });
      } catch (err) {
        if (err instanceof HubInstanceSuspendedError) {
          return reply.status(403).send({ error: 'instance_suspended' });
        }
        throw err;
      }
    });

    /**
     * POST /federation/v1/hub/fingerprints/register — Register a fingerprint.
     */
    scope.post(
      '/federation/v1/hub/fingerprints/register',
      async (request, reply) => {
        try {
          await hubService.assertHubMode(env);
        } catch (err) {
          if (err instanceof HubNotEnabledError) {
            return reply.status(404).send({ error: 'hub_not_enabled' });
          }
          throw err;
        }

        const parsed = hubFingerprintRegisterSchema.safeParse(request.body);
        if (!parsed.success) {
          return reply.status(400).send({
            error: 'invalid_request',
            details: parsed.error.issues,
          });
        }

        const sourceDomain = request.hubPeer!.domain;
        await hubService.registerFingerprint(sourceDomain, parsed.data);
        return reply.status(200).send({ status: 'registered' });
      },
    );

    /**
     * POST /federation/v1/hub/fingerprints/lookup — Look up a fingerprint.
     */
    scope.post(
      '/federation/v1/hub/fingerprints/lookup',
      async (request, reply) => {
        try {
          await hubService.assertHubMode(env);
        } catch (err) {
          if (err instanceof HubNotEnabledError) {
            return reply.status(404).send({ error: 'hub_not_enabled' });
          }
          throw err;
        }

        const parsed = hubFingerprintQuerySchema.safeParse(request.body);
        if (!parsed.success) {
          return reply.status(400).send({
            error: 'invalid_request',
            details: parsed.error.issues,
          });
        }

        const result = await hubService.lookupFingerprint({
          ...parsed.data,
          requestingDomain: request.hubPeer!.domain,
        });
        return reply.status(200).send(result);
      },
    );
  });
}
