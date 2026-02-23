import type { ContractTemplate, Contract } from '@colophony/types';
import {
  listContractTemplatesSchema,
  listContractsSchema,
  createContractTemplateSchema,
  updateContractTemplateSchema,
  generateContractSchema,
  idParamSchema,
} from '@colophony/types';
import { builder } from '../builder.js';
import { requireOrgContext, requireScopes } from '../guards.js';
import { toServiceContext } from '../../services/context.js';
import {
  contractTemplateService,
  ContractTemplateNotFoundError,
} from '../../services/contract-template.service.js';
import {
  contractService,
  ContractNotFoundError,
} from '../../services/contract.service.js';
import { mapServiceError } from '../error-mapper.js';
import { ContractTemplateType, ContractType } from '../types/index.js';

// ---------------------------------------------------------------------------
// Paginated response types
// ---------------------------------------------------------------------------

const PaginatedContractTemplates = builder
  .objectRef<{
    items: ContractTemplate[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }>('PaginatedContractTemplates')
  .implement({
    fields: (t) => ({
      items: t.field({
        type: [ContractTemplateType],
        resolve: (r) => r.items,
      }),
      total: t.exposeInt('total'),
      page: t.exposeInt('page'),
      limit: t.exposeInt('limit'),
      totalPages: t.exposeInt('totalPages'),
    }),
  });

const PaginatedContracts = builder
  .objectRef<{
    items: Contract[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }>('PaginatedContracts')
  .implement({
    fields: (t) => ({
      items: t.field({
        type: [ContractType],
        resolve: (r) => r.items,
      }),
      total: t.exposeInt('total'),
      page: t.exposeInt('page'),
      limit: t.exposeInt('limit'),
      totalPages: t.exposeInt('totalPages'),
    }),
  });

// ---------------------------------------------------------------------------
// Query fields
// ---------------------------------------------------------------------------

builder.queryFields((t) => ({
  /** List contract templates in the org. */
  contractTemplates: t.field({
    type: PaginatedContractTemplates,
    description: 'List contract templates in the organization.',
    args: {
      search: t.arg.string({
        required: false,
        description: 'Search by name.',
      }),
      page: t.arg.int({
        required: false,
        defaultValue: 1,
        description: 'Page number (1-based).',
      }),
      limit: t.arg.int({
        required: false,
        defaultValue: 20,
        description: 'Items per page (1-100).',
      }),
    },
    resolve: async (_root, args, ctx) => {
      const orgCtx = requireOrgContext(ctx);
      await requireScopes(ctx, 'contracts:read');
      const input = listContractTemplatesSchema.parse({
        search: args.search ?? undefined,
        page: args.page,
        limit: args.limit,
      });
      return contractTemplateService.list(orgCtx.dbTx, input);
    },
  }),

  /** Get a contract template by ID. */
  contractTemplate: t.field({
    type: ContractTemplateType,
    nullable: true,
    description: 'Get a contract template by ID.',
    args: {
      id: t.arg.string({ required: true, description: 'Template ID.' }),
    },
    resolve: async (_root, args, ctx) => {
      const orgCtx = requireOrgContext(ctx);
      await requireScopes(ctx, 'contracts:read');
      const { id } = idParamSchema.parse({ id: args.id });
      try {
        const template = await contractTemplateService.getById(orgCtx.dbTx, id);
        if (!template) throw new ContractTemplateNotFoundError(id);
        return template;
      } catch (e) {
        mapServiceError(e);
      }
    },
  }),

  /** List contracts in the org. */
  contracts: t.field({
    type: PaginatedContracts,
    description: 'List contracts in the organization.',
    args: {
      status: t.arg.string({
        required: false,
        description: 'Filter by contract status.',
      }),
      pipelineItemId: t.arg.string({
        required: false,
        description: 'Filter by pipeline item.',
      }),
      page: t.arg.int({
        required: false,
        defaultValue: 1,
        description: 'Page number (1-based).',
      }),
      limit: t.arg.int({
        required: false,
        defaultValue: 20,
        description: 'Items per page (1-100).',
      }),
    },
    resolve: async (_root, args, ctx) => {
      const orgCtx = requireOrgContext(ctx);
      await requireScopes(ctx, 'contracts:read');
      const input = listContractsSchema.parse({
        status: args.status ?? undefined,
        pipelineItemId: args.pipelineItemId ?? undefined,
        page: args.page,
        limit: args.limit,
      });
      return contractService.list(orgCtx.dbTx, input);
    },
  }),

  /** Get a contract by ID. */
  contract: t.field({
    type: ContractType,
    nullable: true,
    description: 'Get a contract by ID.',
    args: {
      id: t.arg.string({ required: true, description: 'Contract ID.' }),
    },
    resolve: async (_root, args, ctx) => {
      const orgCtx = requireOrgContext(ctx);
      await requireScopes(ctx, 'contracts:read');
      const { id } = idParamSchema.parse({ id: args.id });
      try {
        const contract = await contractService.getById(orgCtx.dbTx, id);
        if (!contract) throw new ContractNotFoundError(id);
        return contract;
      } catch (e) {
        mapServiceError(e);
      }
    },
  }),
}));

// ---------------------------------------------------------------------------
// Mutation fields
// ---------------------------------------------------------------------------

builder.mutationFields((t) => ({
  /** Create a contract template. */
  createContractTemplate: t.field({
    type: ContractTemplateType,
    description: 'Create a new contract template.',
    args: {
      name: t.arg.string({ required: true, description: 'Template name.' }),
      body: t.arg.string({
        required: true,
        description: 'Template body with {{merge_field}} placeholders.',
      }),
      description: t.arg.string({
        required: false,
        description: 'Template description.',
      }),
      isDefault: t.arg.boolean({
        required: false,
        description: 'Set as default template.',
      }),
    },
    resolve: async (_root, args, ctx) => {
      const orgCtx = requireOrgContext(ctx);
      await requireScopes(ctx, 'contracts:write');
      const input = createContractTemplateSchema.parse({
        name: args.name,
        body: args.body,
        description: args.description ?? undefined,
        isDefault: args.isDefault ?? undefined,
      });
      try {
        return await contractTemplateService.createWithAudit(
          toServiceContext(orgCtx),
          input,
        );
      } catch (e) {
        mapServiceError(e);
      }
    },
  }),

  /** Update a contract template. */
  updateContractTemplate: t.field({
    type: ContractTemplateType,
    description: 'Update an existing contract template.',
    args: {
      id: t.arg.string({ required: true, description: 'Template ID.' }),
      name: t.arg.string({ required: false, description: 'New name.' }),
      body: t.arg.string({ required: false, description: 'New body.' }),
      description: t.arg.string({
        required: false,
        description: 'New description.',
      }),
      isDefault: t.arg.boolean({
        required: false,
        description: 'Set as default.',
      }),
    },
    resolve: async (_root, args, ctx) => {
      const orgCtx = requireOrgContext(ctx);
      await requireScopes(ctx, 'contracts:write');
      const { id } = idParamSchema.parse({ id: args.id });
      const data = updateContractTemplateSchema.parse({
        name: args.name ?? undefined,
        body: args.body ?? undefined,
        description: args.description ?? undefined,
        isDefault: args.isDefault ?? undefined,
      });
      try {
        return await contractTemplateService.updateWithAudit(
          toServiceContext(orgCtx),
          id,
          data,
        );
      } catch (e) {
        mapServiceError(e);
      }
    },
  }),

  /** Delete a contract template. */
  deleteContractTemplate: t.field({
    type: ContractTemplateType,
    description: 'Delete a contract template.',
    args: {
      id: t.arg.string({ required: true, description: 'Template ID.' }),
    },
    resolve: async (_root, args, ctx) => {
      const orgCtx = requireOrgContext(ctx);
      await requireScopes(ctx, 'contracts:write');
      const { id } = idParamSchema.parse({ id: args.id });
      try {
        return await contractTemplateService.deleteWithAudit(
          toServiceContext(orgCtx),
          id,
        );
      } catch (e) {
        mapServiceError(e);
      }
    },
  }),

  /** Generate a contract from a template. */
  generateContract: t.field({
    type: ContractType,
    description: 'Generate a contract from a template with merge data.',
    args: {
      pipelineItemId: t.arg.string({
        required: true,
        description: 'Pipeline item ID.',
      }),
      contractTemplateId: t.arg.string({
        required: true,
        description: 'Contract template ID.',
      }),
    },
    resolve: async (_root, args, ctx) => {
      const orgCtx = requireOrgContext(ctx);
      await requireScopes(ctx, 'contracts:write');
      const input = generateContractSchema.parse({
        pipelineItemId: args.pipelineItemId,
        contractTemplateId: args.contractTemplateId,
      });
      try {
        return await contractService.generateWithAudit(
          toServiceContext(orgCtx),
          input,
        );
      } catch (e) {
        mapServiceError(e);
      }
    },
  }),

  /** Send a contract for signing. */
  sendContract: t.field({
    type: ContractType,
    description: 'Send a draft contract for signing.',
    args: {
      id: t.arg.string({ required: true, description: 'Contract ID.' }),
    },
    resolve: async (_root, args, ctx) => {
      const orgCtx = requireOrgContext(ctx);
      await requireScopes(ctx, 'contracts:write');
      const { id } = idParamSchema.parse({ id: args.id });
      try {
        return await contractService.sendWithAudit(
          toServiceContext(orgCtx),
          id,
        );
      } catch (e) {
        mapServiceError(e);
      }
    },
  }),

  /** Void a contract. */
  voidContract: t.field({
    type: ContractType,
    description: 'Void a contract, cancelling it permanently.',
    args: {
      id: t.arg.string({ required: true, description: 'Contract ID.' }),
    },
    resolve: async (_root, args, ctx) => {
      const orgCtx = requireOrgContext(ctx);
      await requireScopes(ctx, 'contracts:write');
      const { id } = idParamSchema.parse({ id: args.id });
      try {
        return await contractService.voidWithAudit(
          toServiceContext(orgCtx),
          id,
        );
      } catch (e) {
        mapServiceError(e);
      }
    },
  }),
}));
