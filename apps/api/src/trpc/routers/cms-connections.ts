import {
  createCmsConnectionSchema,
  updateCmsConnectionSchema,
  listCmsConnectionsSchema,
  cmsConnectionSchema,
  idParamSchema,
  paginatedResponseSchema,
} from '@colophony/types';
import { z } from 'zod';
import {
  orgProcedure,
  adminProcedure,
  createRouter,
  requireScopes,
} from '../init.js';
import {
  cmsConnectionService,
  CmsConnectionNotFoundError,
} from '../../services/cms-connection.service.js';
import { toServiceContext } from '../../services/context.js';
import { mapServiceError } from '../error-mapper.js';

export const cmsConnectionsRouter = createRouter({
  /** List CMS connections in the org. */
  list: orgProcedure
    .use(requireScopes('cms:read'))
    .input(listCmsConnectionsSchema)
    .output(paginatedResponseSchema(cmsConnectionSchema))
    .query(async ({ ctx, input }) => {
      return cmsConnectionService.list(ctx.dbTx, input);
    }),

  /** Get CMS connection by ID. */
  getById: orgProcedure
    .use(requireScopes('cms:read'))
    .input(idParamSchema)
    .output(cmsConnectionSchema)
    .query(async ({ ctx, input }) => {
      try {
        const connection = await cmsConnectionService.getById(
          ctx.dbTx,
          input.id,
        );
        if (!connection) throw new CmsConnectionNotFoundError(input.id);
        return connection;
      } catch (e) {
        mapServiceError(e);
      }
    }),

  /** Create a new CMS connection (admin only). */
  create: adminProcedure
    .use(requireScopes('cms:write'))
    .input(createCmsConnectionSchema)
    .output(cmsConnectionSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        return await cmsConnectionService.createWithAudit(
          toServiceContext(ctx),
          input,
        );
      } catch (e) {
        mapServiceError(e);
      }
    }),

  /** Update a CMS connection (admin only). */
  update: adminProcedure
    .use(requireScopes('cms:write'))
    .input(idParamSchema.merge(updateCmsConnectionSchema))
    .output(cmsConnectionSchema)
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      try {
        return await cmsConnectionService.updateWithAudit(
          toServiceContext(ctx),
          id,
          data,
        );
      } catch (e) {
        mapServiceError(e);
      }
    }),

  /** Delete a CMS connection (admin only). */
  delete: adminProcedure
    .use(requireScopes('cms:write'))
    .input(idParamSchema)
    .output(cmsConnectionSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        return await cmsConnectionService.deleteWithAudit(
          toServiceContext(ctx),
          input.id,
        );
      } catch (e) {
        mapServiceError(e);
      }
    }),

  /** Test a CMS connection's config. */
  test: orgProcedure
    .use(requireScopes('cms:read'))
    .input(idParamSchema)
    .output(z.object({ success: z.boolean(), error: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      try {
        return await cmsConnectionService.testConnection(ctx.dbTx, input.id);
      } catch (e) {
        mapServiceError(e);
      }
    }),
});
