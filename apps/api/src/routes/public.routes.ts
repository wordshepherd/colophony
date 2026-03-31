import type { FastifyInstance } from 'fastify';
import { db, organizations } from '@colophony/db';
import { eq } from 'drizzle-orm';
import { slugSchema } from '@colophony/types';
import { responseTimeTransparencyService } from '../services/response-time-transparency.service.js';

export async function registerPublicRoutes(app: FastifyInstance) {
  // ---------------------------------------------------------------------------
  // GET /v1/public/orgs/:slug/response-time — public response time stats
  // ---------------------------------------------------------------------------
  app.get<{ Params: { slug: string } }>(
    '/v1/public/orgs/:slug/response-time',
    async (request, reply) => {
      const parsed = slugSchema.safeParse(request.params.slug);
      if (!parsed.success) {
        return reply.status(400).send({ error: 'Invalid slug' });
      }

      const org = await db.query.organizations.findFirst({
        where: eq(organizations.slug, parsed.data),
        columns: { id: true },
      });
      if (!org) {
        return reply.status(404).send({ error: 'Organization not found' });
      }

      const stats = await responseTimeTransparencyService.getPublicStats(
        org.id,
      );

      void reply.header('Cache-Control', 'public, max-age=300');
      return { responseTimeStats: stats };
    },
  );
}
