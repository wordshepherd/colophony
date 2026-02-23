import type { FastifyInstance } from 'fastify';
import { serve } from 'inngest/fastify';
import { inngest } from './client.js';
import {
  pipelineWorkflow,
  contractWorkflow,
  cmsPublishWorkflow,
} from './functions/index.js';

/**
 * Register the Inngest serve endpoint at `POST /api/inngest`.
 *
 * This endpoint is called by the Inngest dev server (or cloud) to discover
 * and invoke registered functions. It must be accessible from the Inngest
 * container (see Docker Compose `inngest` service).
 */
export async function registerInngestRoutes(
  app: FastifyInstance,
): Promise<void> {
  const handler = serve({
    client: inngest,
    functions: [pipelineWorkflow, contractWorkflow, cmsPublishWorkflow],
  });

  app.route({
    method: ['GET', 'POST', 'PUT'],
    url: '/api/inngest',
    handler,
  });
}
