import {
  listContractTemplatesSchema,
  createContractTemplateSchema,
  updateContractTemplateSchema,
  idParamSchema,
  contractTemplateSchema,
  paginatedResponseSchema,
} from '@colophony/types';
import { restPaginationQuery } from '@colophony/api-contracts';
import {
  contractTemplateService,
  ContractTemplateNotFoundError,
} from '../../services/contract-template.service.js';
import { toServiceContext } from '../../services/context.js';
import { mapServiceError } from '../error-mapper.js';
import { orgProcedure, requireScopes } from '../context.js';

// ---------------------------------------------------------------------------
// Query schemas — override page/limit with z.coerce for REST query strings
// ---------------------------------------------------------------------------

const paginatedTemplatesSchema = paginatedResponseSchema(
  contractTemplateSchema,
);

const restListQuery = listContractTemplatesSchema
  .omit({ page: true, limit: true })
  .merge(restPaginationQuery);

// ---------------------------------------------------------------------------
// Contract template routes
// ---------------------------------------------------------------------------

const list = orgProcedure
  .use(requireScopes('contracts:read'))
  .route({
    method: 'GET',
    path: '/contract-templates',
    summary: 'List contract templates',
    description:
      'Returns a paginated list of contract templates in the organization.',
    operationId: 'listContractTemplates',
    tags: ['Contract Templates'],
  })
  .input(restListQuery)
  .output(paginatedTemplatesSchema)
  .handler(async ({ input, context }) => {
    return contractTemplateService.list(context.dbTx, input);
  });

const get = orgProcedure
  .use(requireScopes('contracts:read'))
  .route({
    method: 'GET',
    path: '/contract-templates/{id}',
    summary: 'Get a contract template',
    description: 'Retrieve a contract template by ID.',
    operationId: 'getContractTemplate',
    tags: ['Contract Templates'],
  })
  .input(idParamSchema)
  .output(contractTemplateSchema)
  .handler(async ({ input, context }) => {
    try {
      const template = await contractTemplateService.getById(
        context.dbTx,
        input.id,
      );
      if (!template) throw new ContractTemplateNotFoundError(input.id);
      return template;
    } catch (e) {
      mapServiceError(e);
    }
  });

const create = orgProcedure
  .use(requireScopes('contracts:write'))
  .route({
    method: 'POST',
    path: '/contract-templates',
    successStatus: 201,
    summary: 'Create a contract template',
    description: 'Create a new contract template for the organization.',
    operationId: 'createContractTemplate',
    tags: ['Contract Templates'],
  })
  .input(createContractTemplateSchema)
  .output(contractTemplateSchema)
  .handler(async ({ input, context }) => {
    try {
      return await contractTemplateService.createWithAudit(
        toServiceContext(context),
        input,
      );
    } catch (e) {
      mapServiceError(e);
    }
  });

const update = orgProcedure
  .use(requireScopes('contracts:write'))
  .route({
    method: 'PATCH',
    path: '/contract-templates/{id}',
    summary: 'Update a contract template',
    description: 'Update an existing contract template.',
    operationId: 'updateContractTemplate',
    tags: ['Contract Templates'],
  })
  .input(idParamSchema.merge(updateContractTemplateSchema))
  .output(contractTemplateSchema)
  .handler(async ({ input, context }) => {
    const { id, ...data } = input;
    try {
      return await contractTemplateService.updateWithAudit(
        toServiceContext(context),
        id,
        data,
      );
    } catch (e) {
      mapServiceError(e);
    }
  });

const del = orgProcedure
  .use(requireScopes('contracts:write'))
  .route({
    method: 'DELETE',
    path: '/contract-templates/{id}',
    summary: 'Delete a contract template',
    description: 'Delete a contract template by ID.',
    operationId: 'deleteContractTemplate',
    tags: ['Contract Templates'],
  })
  .input(idParamSchema)
  .output(contractTemplateSchema)
  .handler(async ({ input, context }) => {
    try {
      return await contractTemplateService.deleteWithAudit(
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

export const contractTemplatesRouter = {
  list,
  get,
  create,
  update,
  delete: del,
};
