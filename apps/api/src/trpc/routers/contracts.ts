import { z } from 'zod';
import {
  generateContractSchema,
  listContractsSchema,
  contractSchema,
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
  contractService,
  ContractNotFoundError,
} from '../../services/contract.service.js';
import { toServiceContext } from '../../services/context.js';
import { mapServiceError } from '../error-mapper.js';

export const contractsRouter = createRouter({
  /** List contracts in the org. */
  list: orgProcedure
    .use(requireScopes('contracts:read'))
    .input(listContractsSchema)
    .output(paginatedResponseSchema(contractSchema))
    .query(async ({ ctx, input }) => {
      return contractService.list(ctx.dbTx, input);
    }),

  /** Get contract by ID. */
  getById: orgProcedure
    .use(requireScopes('contracts:read'))
    .input(idParamSchema)
    .output(contractSchema)
    .query(async ({ ctx, input }) => {
      try {
        const contract = await contractService.getById(ctx.dbTx, input.id);
        if (!contract) throw new ContractNotFoundError(input.id);
        return contract;
      } catch (e) {
        mapServiceError(e);
      }
    }),

  /** List contracts for a pipeline item. */
  listByPipelineItem: orgProcedure
    .use(requireScopes('contracts:read'))
    .input(z.object({ pipelineItemId: z.string().uuid() }))
    .output(z.array(contractSchema))
    .query(async ({ ctx, input }) => {
      return contractService.getByPipelineItemId(
        ctx.dbTx,
        input.pipelineItemId,
      );
    }),

  /** Generate a contract from a template (admin only). */
  generate: adminProcedure
    .use(requireScopes('contracts:write'))
    .input(generateContractSchema)
    .output(contractSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        return await contractService.generateWithAudit(
          toServiceContext(ctx),
          input,
        );
      } catch (e) {
        mapServiceError(e);
      }
    }),

  /** Send a contract (admin only). */
  send: adminProcedure
    .use(requireScopes('contracts:write'))
    .input(idParamSchema)
    .output(contractSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        return await contractService.sendWithAudit(
          toServiceContext(ctx),
          input.id,
        );
      } catch (e) {
        mapServiceError(e);
      }
    }),

  /** Void a contract (admin only). */
  void: adminProcedure
    .use(requireScopes('contracts:write'))
    .input(idParamSchema)
    .output(contractSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        return await contractService.voidWithAudit(
          toServiceContext(ctx),
          input.id,
        );
      } catch (e) {
        mapServiceError(e);
      }
    }),
});
