import {
  createPublicationSchema,
  updatePublicationSchema,
  listPublicationsSchema,
  publicationSchema,
  idParamSchema,
  paginatedResponseSchema,
} from '@colophony/types';
import {
  orgProcedure,
  adminProcedure,
  createRouter,
  requireScopes,
} from '../init.js';
import {
  publicationService,
  PublicationNotFoundError,
} from '../../services/publication.service.js';
import { toServiceContext } from '../../services/context.js';
import { mapServiceError } from '../error-mapper.js';

export const publicationsRouter = createRouter({
  /** List publications in the org. */
  list: orgProcedure
    .use(requireScopes('publications:read'))
    .input(listPublicationsSchema)
    .output(paginatedResponseSchema(publicationSchema))
    .query(async ({ ctx, input }) => {
      return publicationService.list(ctx.dbTx, input);
    }),

  /** Get publication by ID. */
  getById: orgProcedure
    .use(requireScopes('publications:read'))
    .input(idParamSchema)
    .output(publicationSchema)
    .query(async ({ ctx, input }) => {
      try {
        const publication = await publicationService.getById(
          ctx.dbTx,
          input.id,
        );
        if (!publication) throw new PublicationNotFoundError(input.id);
        return publication;
      } catch (e) {
        mapServiceError(e);
      }
    }),

  /** Create a new publication (admin only). */
  create: adminProcedure
    .use(requireScopes('publications:write'))
    .input(createPublicationSchema)
    .output(publicationSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        return await publicationService.createWithAudit(
          toServiceContext(ctx),
          input,
        );
      } catch (e) {
        mapServiceError(e);
      }
    }),

  /** Update a publication (admin only). */
  update: adminProcedure
    .use(requireScopes('publications:write'))
    .input(idParamSchema.merge(updatePublicationSchema))
    .output(publicationSchema)
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      try {
        return await publicationService.updateWithAudit(
          toServiceContext(ctx),
          id,
          data,
        );
      } catch (e) {
        mapServiceError(e);
      }
    }),

  /** Archive a publication (admin only). */
  archive: adminProcedure
    .use(requireScopes('publications:write'))
    .input(idParamSchema)
    .output(publicationSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        return await publicationService.archiveWithAudit(
          toServiceContext(ctx),
          input.id,
        );
      } catch (e) {
        mapServiceError(e);
      }
    }),
});
