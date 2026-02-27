import { z } from 'zod';
import {
  listContractsSchema,
  generateContractSchema,
  idParamSchema,
  contractSchema,
  paginatedResponseSchema,
} from '@colophony/types';
import { restPaginationQuery } from '@colophony/api-contracts';
import {
  contractService,
  ContractNotFoundError,
} from '../../services/contract.service.js';
import { toServiceContext } from '../../services/context.js';
import { mapServiceError } from '../error-mapper.js';
import { orgProcedure, requireScopes } from '../context.js';

// ---------------------------------------------------------------------------
// Query schemas — override page/limit with z.coerce for REST query strings
// ---------------------------------------------------------------------------

const paginatedContractsSchema = paginatedResponseSchema(contractSchema);

const restListQuery = listContractsSchema
  .omit({ page: true, limit: true })
  .merge(restPaginationQuery);

// ---------------------------------------------------------------------------
// Contract routes
// ---------------------------------------------------------------------------

const list = orgProcedure
  .use(requireScopes('contracts:read'))
  .route({
    method: 'GET',
    path: '/contracts',
    summary: 'List contracts',
    description: 'Returns a paginated list of contracts in the organization.',
    operationId: 'listContracts',
    tags: ['Contracts'],
  })
  .input(restListQuery)
  .output(paginatedContractsSchema)
  .handler(async ({ input, context }) => {
    return contractService.list(context.dbTx, input);
  });

const get = orgProcedure
  .use(requireScopes('contracts:read'))
  .route({
    method: 'GET',
    path: '/contracts/{id}',
    summary: 'Get a contract',
    description: 'Retrieve a contract by ID.',
    operationId: 'getContract',
    tags: ['Contracts'],
  })
  .input(idParamSchema)
  .output(contractSchema)
  .handler(async ({ input, context }) => {
    try {
      const contract = await contractService.getById(context.dbTx, input.id);
      if (!contract) throw new ContractNotFoundError(input.id);
      return contract;
    } catch (e) {
      mapServiceError(e);
    }
  });

const listByPipelineItem = orgProcedure
  .use(requireScopes('contracts:read'))
  .route({
    method: 'GET',
    path: '/pipeline/{pipelineItemId}/contracts',
    summary: 'List contracts for a pipeline item',
    description: 'Retrieve all contracts linked to a pipeline item.',
    operationId: 'listContractsByPipelineItem',
    tags: ['Contracts'],
  })
  .input(z.object({ pipelineItemId: z.string().uuid() }))
  .output(z.array(contractSchema))
  .handler(async ({ input, context }) => {
    return contractService.getByPipelineItemId(
      context.dbTx,
      input.pipelineItemId,
    );
  });

const generate = orgProcedure
  .use(requireScopes('contracts:write'))
  .route({
    method: 'POST',
    path: '/contracts',
    successStatus: 201,
    summary: 'Generate a contract',
    description: 'Generate a contract from a template with merge data.',
    operationId: 'generateContract',
    tags: ['Contracts'],
  })
  .input(generateContractSchema)
  .output(contractSchema)
  .handler(async ({ input, context }) => {
    try {
      return await contractService.generateWithAudit(
        toServiceContext(context),
        input,
      );
    } catch (e) {
      mapServiceError(e);
    }
  });

const send = orgProcedure
  .use(requireScopes('contracts:write'))
  .route({
    method: 'POST',
    path: '/contracts/{id}/send',
    summary: 'Send a contract',
    description: 'Send a draft contract for signing.',
    operationId: 'sendContract',
    tags: ['Contracts'],
  })
  .input(idParamSchema)
  .output(contractSchema)
  .handler(async ({ input, context }) => {
    try {
      return await contractService.sendWithAudit(
        toServiceContext(context),
        input.id,
      );
    } catch (e) {
      mapServiceError(e);
    }
  });

const voidContract = orgProcedure
  .use(requireScopes('contracts:write'))
  .route({
    method: 'POST',
    path: '/contracts/{id}/void',
    summary: 'Void a contract',
    description: 'Void a contract, cancelling it permanently.',
    operationId: 'voidContract',
    tags: ['Contracts'],
  })
  .input(idParamSchema)
  .output(contractSchema)
  .handler(async ({ input, context }) => {
    try {
      return await contractService.voidWithAudit(
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

export const contractsRouter = {
  list,
  get,
  listByPipelineItem,
  generate,
  send,
  void: voidContract,
};
