import { z } from 'zod';
import {
  createFormDefinitionSchema,
  updateFormDefinitionSchema,
  createFormFieldSchema,
  updateFormFieldSchema,
  reorderFormFieldsSchema,
  listFormDefinitionsSchema,
  formDefinitionSchema,
  formDefinitionDetailSchema,
  formFieldSchema,
  idParamSchema,
  successResponseSchema,
  paginatedResponseSchema,
} from '@colophony/types';
import { orgProcedure, createRouter, requireScopes } from '../init.js';
import { formService } from '../../services/form.service.js';
import { toServiceContext } from '../../services/context.js';
import { mapServiceError } from '../error-mapper.js';

const formIdFieldIdSchema = z.object({
  id: z.string().uuid(),
  fieldId: z.string().uuid(),
});

export const formsRouter = createRouter({
  /** List form definitions in the org. */
  list: orgProcedure
    .use(requireScopes('forms:read'))
    .input(listFormDefinitionsSchema)
    .output(paginatedResponseSchema(formDefinitionSchema))
    .query(async ({ ctx, input }) => {
      return formService.list(ctx.dbTx, input);
    }),

  /** Get form definition by ID with fields. */
  getById: orgProcedure
    .use(requireScopes('forms:read'))
    .input(idParamSchema)
    .output(formDefinitionDetailSchema)
    .query(async ({ ctx, input }) => {
      try {
        const form = await formService.getById(ctx.dbTx, input.id);
        if (!form) {
          const { FormNotFoundError } =
            await import('../../services/form.service.js');
          throw new FormNotFoundError(input.id);
        }
        return form;
      } catch (e) {
        mapServiceError(e);
      }
    }),

  /** Create a new DRAFT form definition. */
  create: orgProcedure
    .use(requireScopes('forms:write'))
    .input(createFormDefinitionSchema)
    .output(formDefinitionSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        return await formService.createWithAudit(toServiceContext(ctx), input);
      } catch (e) {
        mapServiceError(e);
      }
    }),

  /** Update a DRAFT form definition. */
  update: orgProcedure
    .use(requireScopes('forms:write'))
    .input(idParamSchema.merge(updateFormDefinitionSchema))
    .output(formDefinitionSchema)
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      try {
        return await formService.updateWithAudit(
          toServiceContext(ctx),
          id,
          data,
        );
      } catch (e) {
        mapServiceError(e);
      }
    }),

  /** Publish a DRAFT form (DRAFT → PUBLISHED). */
  publish: orgProcedure
    .use(requireScopes('forms:write'))
    .input(idParamSchema)
    .output(formDefinitionSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        return await formService.publishWithAudit(
          toServiceContext(ctx),
          input.id,
        );
      } catch (e) {
        mapServiceError(e);
      }
    }),

  /** Archive a PUBLISHED form (PUBLISHED → ARCHIVED). */
  archive: orgProcedure
    .use(requireScopes('forms:write'))
    .input(idParamSchema)
    .output(formDefinitionSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        return await formService.archiveWithAudit(
          toServiceContext(ctx),
          input.id,
        );
      } catch (e) {
        mapServiceError(e);
      }
    }),

  /** Duplicate a form as a new DRAFT. */
  duplicate: orgProcedure
    .use(requireScopes('forms:write'))
    .input(idParamSchema)
    .output(formDefinitionDetailSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        const result = await formService.duplicateWithAudit(
          toServiceContext(ctx),
          input.id,
        );
        return result;
      } catch (e) {
        mapServiceError(e);
      }
    }),

  /** Delete a DRAFT form. */
  delete: orgProcedure
    .use(requireScopes('forms:write'))
    .input(idParamSchema)
    .output(successResponseSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        return await formService.deleteWithAudit(
          toServiceContext(ctx),
          input.id,
        );
      } catch (e) {
        mapServiceError(e);
      }
    }),

  /** Add a field to a DRAFT form. */
  addField: orgProcedure
    .use(requireScopes('forms:write'))
    .input(idParamSchema.merge(createFormFieldSchema))
    .output(formFieldSchema)
    .mutation(async ({ ctx, input }) => {
      const { id, ...fieldData } = input;
      try {
        return await formService.addFieldWithAudit(
          toServiceContext(ctx),
          id,
          fieldData,
        );
      } catch (e) {
        mapServiceError(e);
      }
    }),

  /** Update a field in a DRAFT form. */
  updateField: orgProcedure
    .use(requireScopes('forms:write'))
    .input(formIdFieldIdSchema.merge(updateFormFieldSchema))
    .output(formFieldSchema)
    .mutation(async ({ ctx, input }) => {
      const { id, fieldId, ...data } = input;
      try {
        return await formService.updateFieldWithAudit(
          toServiceContext(ctx),
          id,
          fieldId,
          data,
        );
      } catch (e) {
        mapServiceError(e);
      }
    }),

  /** Remove a field from a DRAFT form. */
  removeField: orgProcedure
    .use(requireScopes('forms:write'))
    .input(formIdFieldIdSchema)
    .output(formFieldSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        return await formService.removeFieldWithAudit(
          toServiceContext(ctx),
          input.id,
          input.fieldId,
        );
      } catch (e) {
        mapServiceError(e);
      }
    }),

  /** Reorder fields in a DRAFT form. */
  reorderFields: orgProcedure
    .use(requireScopes('forms:write'))
    .input(idParamSchema.merge(reorderFormFieldsSchema))
    .output(z.array(formFieldSchema))
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      try {
        return await formService.reorderFieldsWithAudit(
          toServiceContext(ctx),
          id,
          data,
        );
      } catch (e) {
        mapServiceError(e);
      }
    }),
});
