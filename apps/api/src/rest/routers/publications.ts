import {
  listPublicationsSchema,
  createPublicationSchema,
  updatePublicationSchema,
  idParamSchema,
  publicationSchema,
  paginatedResponseSchema,
} from '@colophony/types';
import { restPaginationQuery } from '@colophony/api-contracts';
import {
  publicationService,
  PublicationNotFoundError,
} from '../../services/publication.service.js';
import { toServiceContext } from '../../services/context.js';
import { mapServiceError } from '../error-mapper.js';
import {
  orgProcedure,
  productionProcedure,
  requireScopes,
} from '../context.js';

// ---------------------------------------------------------------------------
// Query schemas — override page/limit with z.coerce for REST query strings
// ---------------------------------------------------------------------------

const paginatedPublicationsSchema = paginatedResponseSchema(publicationSchema);

const restListPublicationsQuery = listPublicationsSchema
  .omit({ page: true, limit: true })
  .merge(restPaginationQuery);

// ---------------------------------------------------------------------------
// Publication routes
// ---------------------------------------------------------------------------

const list = orgProcedure
  .use(requireScopes('publications:read'))
  .route({
    method: 'GET',
    path: '/publications',
    summary: 'List publications',
    description:
      'Returns a paginated list of publications in the organization.',
    operationId: 'listPublications',
    tags: ['Publications'],
  })
  .input(restListPublicationsQuery)
  .output(paginatedPublicationsSchema)
  .handler(async ({ input, context }) => {
    return publicationService.list(context.dbTx, input);
  });

const create = productionProcedure
  .use(requireScopes('publications:write'))
  .route({
    method: 'POST',
    path: '/publications',
    successStatus: 201,
    summary: 'Create a publication',
    description:
      'Create a new publication — a named publishing venue within the organization.',
    operationId: 'createPublication',
    tags: ['Publications'],
  })
  .input(createPublicationSchema)
  .output(publicationSchema)
  .handler(async ({ input, context }) => {
    try {
      return await publicationService.createWithAudit(
        toServiceContext(context),
        input,
      );
    } catch (e) {
      mapServiceError(e);
    }
  });

const get = orgProcedure
  .use(requireScopes('publications:read'))
  .route({
    method: 'GET',
    path: '/publications/{id}',
    summary: 'Get a publication',
    description: 'Retrieve a publication by ID.',
    operationId: 'getPublication',
    tags: ['Publications'],
  })
  .input(idParamSchema)
  .output(publicationSchema)
  .handler(async ({ input, context }) => {
    try {
      const publication = await publicationService.getById(
        context.dbTx,
        input.id,
      );
      if (!publication) throw new PublicationNotFoundError(input.id);
      return publication;
    } catch (e) {
      mapServiceError(e);
    }
  });

const update = productionProcedure
  .use(requireScopes('publications:write'))
  .route({
    method: 'PATCH',
    path: '/publications/{id}',
    summary: 'Update a publication',
    description: 'Update a publication by ID.',
    operationId: 'updatePublication',
    tags: ['Publications'],
  })
  .input(idParamSchema.merge(updatePublicationSchema))
  .output(publicationSchema)
  .handler(async ({ input, context }) => {
    const { id, ...data } = input;
    try {
      return await publicationService.updateWithAudit(
        toServiceContext(context),
        id,
        data,
      );
    } catch (e) {
      mapServiceError(e);
    }
  });

const archive = productionProcedure
  .use(requireScopes('publications:write'))
  .route({
    method: 'POST',
    path: '/publications/{id}/archive',
    summary: 'Archive a publication',
    description: 'Archive a publication by ID.',
    operationId: 'archivePublication',
    tags: ['Publications'],
  })
  .input(idParamSchema)
  .output(publicationSchema)
  .handler(async ({ input, context }) => {
    try {
      return await publicationService.archiveWithAudit(
        toServiceContext(context),
        input.id,
      );
    } catch (e) {
      mapServiceError(e);
    }
  });

// ---------------------------------------------------------------------------
// Assembled router
// ---------------------------------------------------------------------------

export const publicationsRouter = {
  list,
  create,
  get,
  update,
  archive,
};
