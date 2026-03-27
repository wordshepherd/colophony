import { z } from 'zod';
import type { FastifyInstance } from 'fastify';
import { withRls, simSubChecks, eq } from '@colophony/db';
import { desc } from 'drizzle-orm';
import type { Env } from '../config/env.js';
import { simsubService } from '../services/simsub.service.js';

const submissionIdParamSchema = z.object({
  submissionId: z.string().uuid(),
});

/**
 * Admin sim-sub management endpoints.
 * Behind normal auth hook chain — requires authenticated user with ADMIN role.
 */
export async function registerSimSubAdminRoutes(
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
   * GET /federation/sim-sub/checks/:submissionId
   *
   * List sim-sub check history for a submission.
   */
  app.get(
    '/federation/sim-sub/checks/:submissionId',
    async (request, reply) => {
      const params = submissionIdParamSchema.safeParse(request.params);
      if (!params.success) {
        return reply.status(400).send({
          error: 'invalid_params',
          details: params.error.issues,
        });
      }

      const orgId = request.authContext!.orgId!;
      const checks = await withRls({ orgId }, async (tx) => {
        return tx
          .select()
          .from(simSubChecks)
          .where(eq(simSubChecks.submissionId, params.data.submissionId))
          .orderBy(desc(simSubChecks.createdAt));
      });

      return reply.send(checks);
    },
  );

  /**
   * POST /federation/sim-sub/override/:submissionId
   *
   * Grant an admin override on a sim-sub conflict.
   */
  app.post(
    '/federation/sim-sub/override/:submissionId',
    async (request, reply) => {
      const params = submissionIdParamSchema.safeParse(request.params);
      if (!params.success) {
        return reply.status(400).send({
          error: 'invalid_params',
          details: params.error.issues,
        });
      }

      const orgId = request.authContext!.orgId!;
      const adminUserId = request.authContext!.userId;

      await simsubService.grantOverride(
        orgId,
        params.data.submissionId,
        adminUserId,
      );

      return reply.send({ status: 'override_granted' });
    },
  );
}
