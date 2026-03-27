import { z } from 'zod';
import {
  createFormDefinitionSchema,
  updateFormDefinitionSchema,
  createFormFieldSchema,
  updateFormFieldSchema,
  reorderFormFieldsSchema,
  createFormPageSchema,
  updateFormPageSchema,
  reorderFormPagesSchema,
  listFormDefinitionsSchema,
  formDefinitionSchema,
  formDefinitionDetailSchema,
  formFieldSchema,
  formPageSchema,
  idParamSchema,
  successResponseSchema,
  paginatedResponseSchema,
} from '@colophony/types';
import {
  orgProcedure,
  editorProcedure,
  createRouter,
  requireScopes,
} from '../init.js';
import { formService } from '../../services/form.service.js';
import { toServiceContext } from '../../services/context.js';
import { mapServiceError } from '../error-mapper.js';

const formIdFieldIdSchema = z.object({
  id: z.string().uuid(),
  fieldId: z.string().uuid(),
});

const formIdPageIdSchema = z.object({
  id: z.string().uuid(),
  pageId: z.string().uuid(),
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
  create: editorProcedure
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
  update: editorProcedure
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
  publish: editorProcedure
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
  archive: editorProcedure
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
  duplicate: editorProcedure
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
  delete: editorProcedure
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
  addField: editorProcedure
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
  updateField: editorProcedure
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
  removeField: editorProcedure
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
  reorderFields: editorProcedure
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

  /** Add a page to a DRAFT form. */
  addPage: editorProcedure
    .use(requireScopes('forms:write'))
    .input(idParamSchema.merge(createFormPageSchema))
    .output(formPageSchema)
    .mutation(async ({ ctx, input }) => {
      const { id, ...pageData } = input;
      try {
        return await formService.addPageWithAudit(
          toServiceContext(ctx),
          id,
          pageData,
        );
      } catch (e) {
        mapServiceError(e);
      }
    }),

  /** Update a page in a DRAFT form. */
  updatePage: editorProcedure
    .use(requireScopes('forms:write'))
    .input(formIdPageIdSchema.merge(updateFormPageSchema))
    .output(formPageSchema)
    .mutation(async ({ ctx, input }) => {
      const { id, pageId, ...data } = input;
      try {
        return await formService.updatePageWithAudit(
          toServiceContext(ctx),
          id,
          pageId,
          data,
        );
      } catch (e) {
        mapServiceError(e);
      }
    }),

  /** Remove a page from a DRAFT form. */
  removePage: editorProcedure
    .use(requireScopes('forms:write'))
    .input(formIdPageIdSchema)
    .output(formPageSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        return await formService.removePageWithAudit(
          toServiceContext(ctx),
          input.id,
          input.pageId,
        );
      } catch (e) {
        mapServiceError(e);
      }
    }),

  /** Reorder pages in a DRAFT form. */
  reorderPages: editorProcedure
    .use(requireScopes('forms:write'))
    .input(idParamSchema.merge(reorderFormPagesSchema))
    .output(z.array(formPageSchema))
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      try {
        return await formService.reorderPagesWithAudit(
          toServiceContext(ctx),
          id,
          data,
        );
      } catch (e) {
        mapServiceError(e);
      }
    }),
});
