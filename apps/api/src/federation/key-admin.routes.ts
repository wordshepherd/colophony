import type { FastifyInstance } from 'fastify';
import { withRls, userKeys } from '@colophony/db';
import type { DrizzleDb } from '@colophony/db';
import { eq } from 'drizzle-orm';
import {
  userKeyRotationRequestSchema,
  type UserKeyRotationResponse,
  type UserKeyListResponse,
} from '@colophony/types';
import type { Env } from '../config/env.js';
import {
  federationService,
  NoActiveKeyError,
} from '../services/federation.service.js';

/**
 * Key management endpoints for authenticated users.
 *
 * No ADMIN role requirement — users manage their own DID keys.
 * User-scoped RLS provides isolation for the list endpoint.
 */
export async function registerKeyAdminRoutes(
  app: FastifyInstance,
  opts: { env: Env },
): Promise<void> {
  const { env } = opts;

  /**
   * POST /federation/keys/rotate
   *
   * Rotate the current user's DID keypair.
   * Revokes the current active key and generates a new one.
   */
  app.post('/federation/keys/rotate', async (request, reply) => {
    if (!request.authContext) {
      return reply.status(401).send({ error: 'unauthorized' });
    }

    const parsed = userKeyRotationRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: 'invalid_body',
        details: parsed.error.issues,
      });
    }

    const domain = env.FEDERATION_DOMAIN ?? 'localhost';
    const email = request.authContext.email;

    if (!email) {
      return reply.status(400).send({ error: 'user_email_required' });
    }

    // Extract local part from email
    const atIndex = email.indexOf('@');
    if (atIndex === -1) {
      return reply.status(400).send({ error: 'invalid_email_format' });
    }
    const localPart = email.substring(0, atIndex);

    try {
      const result = await federationService.rotateUserKey(
        request.authContext.userId,
        domain,
        localPart,
        parsed.data.reason,
      );

      const response: UserKeyRotationResponse = {
        newKeyId: result.newKeyId,
        previousKeyId: result.previousKeyId,
      };

      return reply.send(response);
    } catch (err) {
      if (err instanceof NoActiveKeyError) {
        return reply.status(404).send({
          error: 'no_active_key',
          message:
            'No active key found. Request your DID document first to generate a key.',
        });
      }
      throw err;
    }
  });

  /**
   * GET /federation/keys
   *
   * List the current user's DID keys (active + revoked).
   * Uses withRls for user-scoped isolation — no private keys exposed.
   */
  app.get('/federation/keys', async (request, reply) => {
    if (!request.authContext) {
      return reply.status(401).send({ error: 'unauthorized' });
    }

    const keys = await withRls(
      { userId: request.authContext.userId },
      async (tx: DrizzleDb) => {
        return tx
          .select({
            keyId: userKeys.keyId,
            status: userKeys.status,
            algorithm: userKeys.algorithm,
            createdAt: userKeys.createdAt,
            revokedAt: userKeys.revokedAt,
          })
          .from(userKeys)
          .where(eq(userKeys.userId, request.authContext!.userId));
      },
    );

    const response: UserKeyListResponse = { keys };
    return reply.send(response);
  });
}
