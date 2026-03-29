import { z } from 'zod';
import {
  contributorSchema,
  contributorPublicationSchema,
  createContributorSchema,
  updateContributorSchema,
  listContributorsSchema,
  addContributorPublicationSchema,
  removeContributorPublicationSchema,
  idParamSchema,
  paginatedResponseSchema,
} from '@colophony/types';
import { businessOpsProcedure, createRouter, requireScopes } from '../init.js';
import { contributorService } from '../../services/contributor.service.js';
import { toServiceContext } from '../../services/context.js';
import { mapServiceError } from '../error-mapper.js';

export const contributorsRouter = createRouter({
  /** List contributors for the current org. */
  list: businessOpsProcedure
    .use(requireScopes('contributors:read'))
    .input(listContributorsSchema)
    .output(paginatedResponseSchema(contributorSchema))
    .query(async ({ ctx, input }) => {
      return contributorService.list(ctx.dbTx, input, ctx.authContext.orgId);
    }),

  /** Get a contributor by ID. */
  getById: businessOpsProcedure
    .use(requireScopes('contributors:read'))
    .input(idParamSchema)
    .output(contributorSchema)
    .query(async ({ ctx, input }) => {
      try {
        const contributor = await contributorService.getById(
          ctx.dbTx,
          input.id,
          ctx.authContext.orgId,
        );
        if (!contributor) {
          const { ContributorNotFoundError } =
            await import('../../services/contributor.service.js');
          throw new ContributorNotFoundError(input.id);
        }
        return contributor;
      } catch (e) {
        mapServiceError(e);
      }
    }),

  /** Create a new contributor. */
  create: businessOpsProcedure
    .use(requireScopes('contributors:write'))
    .input(createContributorSchema)
    .output(contributorSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        return await contributorService.createWithAudit(
          toServiceContext(ctx),
          input,
        );
      } catch (e) {
        mapServiceError(e);
      }
    }),

  /** Update an existing contributor. */
  update: businessOpsProcedure
    .use(requireScopes('contributors:write'))
    .input(updateContributorSchema)
    .output(contributorSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        return await contributorService.updateWithAudit(
          toServiceContext(ctx),
          input,
        );
      } catch (e) {
        mapServiceError(e);
      }
    }),

  /** Delete a contributor. */
  delete: businessOpsProcedure
    .use(requireScopes('contributors:write'))
    .input(idParamSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        await contributorService.deleteWithAudit(
          toServiceContext(ctx),
          input.id,
        );
        return { success: true };
      } catch (e) {
        mapServiceError(e);
      }
    }),

  /** Add a publication credit for a contributor. */
  addPublication: businessOpsProcedure
    .use(requireScopes('contributors:write'))
    .input(addContributorPublicationSchema)
    .output(contributorPublicationSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        return await contributorService.addPublicationWithAudit(
          toServiceContext(ctx),
          input,
        );
      } catch (e) {
        mapServiceError(e);
      }
    }),

  /** Remove a publication credit from a contributor. */
  removePublication: businessOpsProcedure
    .use(requireScopes('contributors:write'))
    .input(removeContributorPublicationSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        await contributorService.removePublicationWithAudit(
          toServiceContext(ctx),
          input,
        );
        return { success: true };
      } catch (e) {
        mapServiceError(e);
      }
    }),

  /** List publication credits for a contributor. */
  listPublications: businessOpsProcedure
    .use(requireScopes('contributors:read'))
    .input(z.object({ contributorId: z.string().uuid() }))
    .output(z.array(contributorPublicationSchema))
    .query(async ({ ctx, input }) => {
      return contributorService.listPublications(ctx.dbTx, input.contributorId);
    }),
});
