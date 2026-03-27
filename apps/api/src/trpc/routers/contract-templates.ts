import {
  createContractTemplateSchema,
  updateContractTemplateSchema,
  listContractTemplatesSchema,
  contractTemplateSchema,
  idParamSchema,
  paginatedResponseSchema,
} from '@colophony/types';
import {
  orgProcedure,
  productionProcedure,
  createRouter,
  requireScopes,
} from '../init.js';
import {
  contractTemplateService,
  ContractTemplateNotFoundError,
} from '../../services/contract-template.service.js';
import { toServiceContext } from '../../services/context.js';
import { mapServiceError } from '../error-mapper.js';

export const contractTemplatesRouter = createRouter({
  /** List contract templates in the org. */
  list: orgProcedure
    .use(requireScopes('contracts:read'))
    .input(listContractTemplatesSchema)
    .output(paginatedResponseSchema(contractTemplateSchema))
    .query(async ({ ctx, input }) => {
      return contractTemplateService.list(ctx.dbTx, input);
    }),

  /** Get contract template by ID. */
  getById: orgProcedure
    .use(requireScopes('contracts:read'))
    .input(idParamSchema)
    .output(contractTemplateSchema)
    .query(async ({ ctx, input }) => {
      try {
        const template = await contractTemplateService.getById(
          ctx.dbTx,
          input.id,
        );
        if (!template) throw new ContractTemplateNotFoundError(input.id);
        return template;
      } catch (e) {
        mapServiceError(e);
      }
    }),

  /** Create a contract template (admin only). */
  create: productionProcedure
    .use(requireScopes('contracts:write'))
    .input(createContractTemplateSchema)
    .output(contractTemplateSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        return await contractTemplateService.createWithAudit(
          toServiceContext(ctx),
          input,
        );
      } catch (e) {
        mapServiceError(e);
      }
    }),

  /** Update a contract template (admin only). */
  update: productionProcedure
    .use(requireScopes('contracts:write'))
    .input(idParamSchema.merge(updateContractTemplateSchema))
    .output(contractTemplateSchema)
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      try {
        return await contractTemplateService.updateWithAudit(
          toServiceContext(ctx),
          id,
          data,
        );
      } catch (e) {
        mapServiceError(e);
      }
    }),

  /** Delete a contract template (admin only). */
  delete: productionProcedure
    .use(requireScopes('contracts:write'))
    .input(idParamSchema)
    .output(contractTemplateSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        return await contractTemplateService.deleteWithAudit(
          toServiceContext(ctx),
          input.id,
        );
      } catch (e) {
        mapServiceError(e);
      }
    }),
});
