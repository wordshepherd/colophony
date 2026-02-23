import {
  listCmsConnectionsSchema,
  createCmsConnectionSchema,
  updateCmsConnectionSchema,
  idParamSchema,
} from '@colophony/types';
import { restPaginationQuery } from '@colophony/api-contracts';
import {
  cmsConnectionService,
  CmsConnectionNotFoundError,
} from '../../services/cms-connection.service.js';
import { toServiceContext } from '../../services/context.js';
import { mapServiceError } from '../error-mapper.js';
import { orgProcedure, requireScopes } from '../context.js';

// ---------------------------------------------------------------------------
// Query schemas — override page/limit with z.coerce for REST query strings
// ---------------------------------------------------------------------------

const restListCmsConnectionsQuery = listCmsConnectionsSchema
  .omit({ page: true, limit: true })
  .merge(restPaginationQuery);

// ---------------------------------------------------------------------------
// CMS Connection routes
// ---------------------------------------------------------------------------

const list = orgProcedure
  .use(requireScopes('cms:read'))
  .route({
    method: 'GET',
    path: '/cms-connections',
    summary: 'List CMS connections',
    description:
      'Returns a paginated list of CMS connections in the organization.',
    operationId: 'listCmsConnections',
    tags: ['CMS Connections'],
  })
  .input(restListCmsConnectionsQuery)
  .handler(async ({ input, context }) => {
    return cmsConnectionService.list(context.dbTx, input);
  });

const create = orgProcedure
  .use(requireScopes('cms:write'))
  .route({
    method: 'POST',
    path: '/cms-connections',
    successStatus: 201,
    summary: 'Create a CMS connection',
    description:
      'Create a new CMS connection (WordPress or Ghost) for the organization.',
    operationId: 'createCmsConnection',
    tags: ['CMS Connections'],
  })
  .input(createCmsConnectionSchema)
  .handler(async ({ input, context }) => {
    try {
      return await cmsConnectionService.createWithAudit(
        toServiceContext(context),
        input,
      );
    } catch (e) {
      mapServiceError(e);
    }
  });

const get = orgProcedure
  .use(requireScopes('cms:read'))
  .route({
    method: 'GET',
    path: '/cms-connections/{id}',
    summary: 'Get a CMS connection',
    description: 'Retrieve a CMS connection by ID.',
    operationId: 'getCmsConnection',
    tags: ['CMS Connections'],
  })
  .input(idParamSchema)
  .handler(async ({ input, context }) => {
    try {
      const connection = await cmsConnectionService.getById(
        context.dbTx,
        input.id,
      );
      if (!connection) throw new CmsConnectionNotFoundError(input.id);
      return connection;
    } catch (e) {
      mapServiceError(e);
    }
  });

const update = orgProcedure
  .use(requireScopes('cms:write'))
  .route({
    method: 'PATCH',
    path: '/cms-connections/{id}',
    summary: 'Update a CMS connection',
    description: 'Update a CMS connection by ID.',
    operationId: 'updateCmsConnection',
    tags: ['CMS Connections'],
  })
  .input(idParamSchema.merge(updateCmsConnectionSchema))
  .handler(async ({ input, context }) => {
    const { id, ...data } = input;
    try {
      return await cmsConnectionService.updateWithAudit(
        toServiceContext(context),
        id,
        data,
      );
    } catch (e) {
      mapServiceError(e);
    }
  });

const del = orgProcedure
  .use(requireScopes('cms:write'))
  .route({
    method: 'DELETE',
    path: '/cms-connections/{id}',
    summary: 'Delete a CMS connection',
    description: 'Delete a CMS connection by ID.',
    operationId: 'deleteCmsConnection',
    tags: ['CMS Connections'],
  })
  .input(idParamSchema)
  .handler(async ({ input, context }) => {
    try {
      return await cmsConnectionService.deleteWithAudit(
        toServiceContext(context),
        input.id,
      );
    } catch (e) {
      mapServiceError(e);
    }
  });

const test = orgProcedure
  .use(requireScopes('cms:read'))
  .route({
    method: 'POST',
    path: '/cms-connections/{id}/test',
    summary: 'Test a CMS connection',
    description:
      'Test the configuration of a CMS connection by attempting to connect.',
    operationId: 'testCmsConnection',
    tags: ['CMS Connections'],
  })
  .input(idParamSchema)
  .handler(async ({ input, context }) => {
    try {
      return await cmsConnectionService.testConnection(context.dbTx, input.id);
    } catch (e) {
      mapServiceError(e);
    }
  });

// ---------------------------------------------------------------------------
// Assembled router
// ---------------------------------------------------------------------------

export const cmsConnectionsRouter = {
  list,
  create,
  get,
  update,
  del,
  test,
};
