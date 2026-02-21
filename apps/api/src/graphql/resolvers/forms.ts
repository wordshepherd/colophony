import type { FormDefinition } from '@colophony/db';
import {
  listFormDefinitionsSchema,
  createFormDefinitionSchema,
  updateFormDefinitionSchema,
  createFormFieldSchema,
  updateFormFieldSchema,
  reorderFormFieldsSchema,
  idParamSchema,
  type ConditionalRule,
} from '@colophony/types';
import { builder } from '../builder.js';
import { requireOrgContext, requireScopes } from '../guards.js';
import { toServiceContext } from '../../services/context.js';
import { formService, FormNotFoundError } from '../../services/form.service.js';
import { mapServiceError } from '../error-mapper.js';
import { FormDefinitionType, FormFieldObjectType } from '../types/index.js';
import { SuccessPayload } from '../types/payloads.js';

// ---------------------------------------------------------------------------
// Paginated response type
// ---------------------------------------------------------------------------

const PaginatedFormDefinitions = builder
  .objectRef<{
    items: FormDefinition[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }>('PaginatedFormDefinitions')
  .implement({
    fields: (t) => ({
      items: t.field({
        type: [FormDefinitionType],
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
  /** List form definitions in the org. */
  formDefinitions: t.field({
    type: PaginatedFormDefinitions,
    description: 'List form definitions in the organization.',
    args: {
      status: t.arg.string({
        required: false,
        description: 'Filter by form status (DRAFT, PUBLISHED, ARCHIVED).',
      }),
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
      await requireScopes(ctx, 'forms:read');
      const input = listFormDefinitionsSchema.parse({
        status: args.status ?? undefined,
        search: args.search ?? undefined,
        page: args.page,
        limit: args.limit,
      });
      return formService.list(orgCtx.dbTx, input);
    },
  }),

  /** Get a single form definition by ID. */
  formDefinition: t.field({
    type: FormDefinitionType,
    nullable: true,
    description: 'Get a form definition by ID, including its fields.',
    args: {
      id: t.arg.string({
        required: true,
        description: 'Form definition ID.',
      }),
    },
    resolve: async (_root, args, ctx) => {
      const orgCtx = requireOrgContext(ctx);
      await requireScopes(ctx, 'forms:read');
      const { id } = idParamSchema.parse({ id: args.id });
      try {
        const form = await formService.getById(orgCtx.dbTx, id);
        if (!form) throw new FormNotFoundError(id);
        return form;
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
  /** Create a new form definition in DRAFT status. */
  createFormDefinition: t.field({
    type: FormDefinitionType,
    description: 'Create a new form definition in DRAFT status.',
    args: {
      name: t.arg.string({
        required: true,
        description: 'Display name for the form.',
      }),
      description: t.arg.string({
        required: false,
        description: 'Description of the form.',
      }),
    },
    resolve: async (_root, args, ctx) => {
      const orgCtx = requireOrgContext(ctx);
      await requireScopes(ctx, 'forms:write');
      const input = createFormDefinitionSchema.parse({
        name: args.name,
        description: args.description ?? undefined,
      });
      try {
        return await formService.createWithAudit(
          toServiceContext(orgCtx),
          input,
        );
      } catch (e) {
        mapServiceError(e);
      }
    },
  }),

  /** Update a DRAFT form definition. */
  updateFormDefinition: t.field({
    type: FormDefinitionType,
    description: 'Update a DRAFT form definition.',
    args: {
      id: t.arg.string({ required: true, description: 'Form ID.' }),
      name: t.arg.string({ required: false, description: 'New name.' }),
      description: t.arg.string({
        required: false,
        description: 'New description.',
      }),
    },
    resolve: async (_root, args, ctx) => {
      const orgCtx = requireOrgContext(ctx);
      await requireScopes(ctx, 'forms:write');
      const { id } = idParamSchema.parse({ id: args.id });
      const data = updateFormDefinitionSchema.parse({
        name: args.name ?? undefined,
        description: args.description ?? undefined,
      });
      try {
        return await formService.updateWithAudit(
          toServiceContext(orgCtx),
          id,
          data,
        );
      } catch (e) {
        mapServiceError(e);
      }
    },
  }),

  /** Publish a DRAFT form (DRAFT → PUBLISHED). */
  publishFormDefinition: t.field({
    type: FormDefinitionType,
    description: 'Publish a DRAFT form. Requires at least one field.',
    args: {
      id: t.arg.string({ required: true, description: 'Form ID.' }),
    },
    resolve: async (_root, args, ctx) => {
      const orgCtx = requireOrgContext(ctx);
      await requireScopes(ctx, 'forms:write');
      const { id } = idParamSchema.parse({ id: args.id });
      try {
        return await formService.publishWithAudit(toServiceContext(orgCtx), id);
      } catch (e) {
        mapServiceError(e);
      }
    },
  }),

  /** Archive a PUBLISHED form (PUBLISHED → ARCHIVED). */
  archiveFormDefinition: t.field({
    type: FormDefinitionType,
    description: 'Archive a PUBLISHED form.',
    args: {
      id: t.arg.string({ required: true, description: 'Form ID.' }),
    },
    resolve: async (_root, args, ctx) => {
      const orgCtx = requireOrgContext(ctx);
      await requireScopes(ctx, 'forms:write');
      const { id } = idParamSchema.parse({ id: args.id });
      try {
        return await formService.archiveWithAudit(toServiceContext(orgCtx), id);
      } catch (e) {
        mapServiceError(e);
      }
    },
  }),

  /** Duplicate a form as a new DRAFT. */
  duplicateFormDefinition: t.field({
    type: FormDefinitionType,
    description:
      'Create a copy of a form (including all fields) as a new DRAFT.',
    args: {
      id: t.arg.string({ required: true, description: 'Form ID to copy.' }),
    },
    resolve: async (_root, args, ctx) => {
      const orgCtx = requireOrgContext(ctx);
      await requireScopes(ctx, 'forms:write');
      const { id } = idParamSchema.parse({ id: args.id });
      try {
        const result = await formService.duplicateWithAudit(
          toServiceContext(orgCtx),
          id,
        );
        return result;
      } catch (e) {
        mapServiceError(e);
      }
    },
  }),

  /** Delete a DRAFT form. */
  deleteFormDefinition: t.field({
    type: SuccessPayload,
    description:
      'Delete a DRAFT form. Fails if referenced by periods or submissions.',
    args: {
      id: t.arg.string({ required: true, description: 'Form ID.' }),
    },
    resolve: async (_root, args, ctx) => {
      const orgCtx = requireOrgContext(ctx);
      await requireScopes(ctx, 'forms:write');
      const { id } = idParamSchema.parse({ id: args.id });
      try {
        return await formService.deleteWithAudit(toServiceContext(orgCtx), id);
      } catch (e) {
        mapServiceError(e);
      }
    },
  }),

  /** Add a field to a DRAFT form. */
  addFormField: t.field({
    type: FormFieldObjectType,
    description: 'Add a new field to a DRAFT form definition.',
    args: {
      formId: t.arg.string({
        required: true,
        description: 'Form definition ID.',
      }),
      fieldKey: t.arg.string({
        required: true,
        description: 'Machine name for the field.',
      }),
      fieldType: t.arg.string({
        required: true,
        description: 'Field type (text, textarea, select, etc.).',
      }),
      label: t.arg.string({
        required: true,
        description: 'Human-readable label.',
      }),
      description: t.arg.string({ required: false, description: 'Help text.' }),
      placeholder: t.arg.string({
        required: false,
        description: 'Placeholder text.',
      }),
      required: t.arg.boolean({
        required: false,
        defaultValue: false,
        description: 'Whether the field is required.',
      }),
      sortOrder: t.arg.int({
        required: false,
        description: 'Display order (auto-assigned if omitted).',
      }),
      config: t.arg({
        type: 'JSON',
        required: false,
        description: 'Type-specific configuration.',
      }),
    },
    resolve: async (_root, args, ctx) => {
      const orgCtx = requireOrgContext(ctx);
      await requireScopes(ctx, 'forms:write');
      const input = createFormFieldSchema.parse({
        fieldKey: args.fieldKey,
        fieldType: args.fieldType,
        label: args.label,
        description: args.description ?? undefined,
        placeholder: args.placeholder ?? undefined,
        required: args.required ?? false,
        sortOrder: args.sortOrder ?? undefined,
        config: (args.config as Record<string, unknown>) ?? undefined,
      });
      const { id: formId } = idParamSchema.parse({ id: args.formId });
      try {
        return await formService.addFieldWithAudit(
          toServiceContext(orgCtx),
          formId,
          input,
        );
      } catch (e) {
        mapServiceError(e);
      }
    },
  }),

  /** Update a field in a DRAFT form. */
  updateFormField: t.field({
    type: FormFieldObjectType,
    description: 'Update a field in a DRAFT form definition.',
    args: {
      formId: t.arg.string({
        required: true,
        description: 'Form definition ID.',
      }),
      fieldId: t.arg.string({ required: true, description: 'Field ID.' }),
      label: t.arg.string({ required: false, description: 'New label.' }),
      description: t.arg.string({
        required: false,
        description: 'New help text.',
      }),
      placeholder: t.arg.string({
        required: false,
        description: 'New placeholder.',
      }),
      required: t.arg.boolean({
        required: false,
        description: 'New required state.',
      }),
      config: t.arg({
        type: 'JSON',
        required: false,
        description: 'New configuration.',
      }),
      conditionalRules: t.arg({
        type: 'JSON',
        required: false,
        description: 'Conditional display rules.',
      }),
    },
    resolve: async (_root, args, ctx) => {
      const orgCtx = requireOrgContext(ctx);
      await requireScopes(ctx, 'forms:write');
      const data = updateFormFieldSchema.parse({
        label: args.label ?? undefined,
        description: args.description ?? undefined,
        placeholder: args.placeholder ?? undefined,
        required: args.required ?? undefined,
        config: (args.config as Record<string, unknown>) ?? undefined,
        conditionalRules:
          args.conditionalRules !== undefined
            ? (args.conditionalRules as ConditionalRule[] | null)
            : undefined,
      });
      const { id: formId } = idParamSchema.parse({ id: args.formId });
      const { id: fieldId } = idParamSchema.parse({ id: args.fieldId });
      try {
        return await formService.updateFieldWithAudit(
          toServiceContext(orgCtx),
          formId,
          fieldId,
          data,
        );
      } catch (e) {
        mapServiceError(e);
      }
    },
  }),

  /** Remove a field from a DRAFT form. */
  removeFormField: t.field({
    type: FormFieldObjectType,
    description: 'Remove a field from a DRAFT form definition.',
    args: {
      formId: t.arg.string({
        required: true,
        description: 'Form definition ID.',
      }),
      fieldId: t.arg.string({ required: true, description: 'Field ID.' }),
    },
    resolve: async (_root, args, ctx) => {
      const orgCtx = requireOrgContext(ctx);
      await requireScopes(ctx, 'forms:write');
      const { id: formId } = idParamSchema.parse({ id: args.formId });
      const { id: fieldId } = idParamSchema.parse({ id: args.fieldId });
      try {
        return await formService.removeFieldWithAudit(
          toServiceContext(orgCtx),
          formId,
          fieldId,
        );
      } catch (e) {
        mapServiceError(e);
      }
    },
  }),

  /** Reorder fields in a DRAFT form. */
  reorderFormFields: t.field({
    type: [FormFieldObjectType],
    description: 'Set the display order of fields in a DRAFT form.',
    args: {
      formId: t.arg.string({
        required: true,
        description: 'Form definition ID.',
      }),
      fieldIds: t.arg.stringList({
        required: true,
        description: 'Ordered list of field IDs.',
      }),
    },
    resolve: async (_root, args, ctx) => {
      const orgCtx = requireOrgContext(ctx);
      await requireScopes(ctx, 'forms:write');
      const input = reorderFormFieldsSchema.parse({
        fieldIds: args.fieldIds,
      });
      const { id: formId } = idParamSchema.parse({ id: args.formId });
      try {
        return await formService.reorderFieldsWithAudit(
          toServiceContext(orgCtx),
          formId,
          input,
        );
      } catch (e) {
        mapServiceError(e);
      }
    },
  }),
}));
