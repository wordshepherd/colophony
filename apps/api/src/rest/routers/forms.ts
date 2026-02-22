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
  idParamSchema,
} from '@colophony/types';
import { restPaginationQuery } from '@colophony/api-contracts';
import { formService, FormNotFoundError } from '../../services/form.service.js';
import { toServiceContext } from '../../services/context.js';
import { mapServiceError } from '../error-mapper.js';
import { orgProcedure, requireScopes } from '../context.js';

// ---------------------------------------------------------------------------
// Query schemas — override page/limit with z.coerce for REST query strings
// ---------------------------------------------------------------------------

const restListFormsQuery = listFormDefinitionsSchema
  .omit({ page: true, limit: true })
  .merge(restPaginationQuery);

// ---------------------------------------------------------------------------
// Path param schemas
// ---------------------------------------------------------------------------

const formFieldIdParam = z.object({
  id: z.string().uuid(),
  fieldId: z.string().uuid(),
});

const formPageIdParam = z.object({
  id: z.string().uuid(),
  pageId: z.string().uuid(),
});

// ---------------------------------------------------------------------------
// Form routes
// ---------------------------------------------------------------------------

const list = orgProcedure
  .use(requireScopes('forms:read'))
  .route({
    method: 'GET',
    path: '/forms',
    summary: 'List form definitions',
    description:
      'Returns a paginated list of form definitions in the organization.',
    operationId: 'listForms',
    tags: ['Forms'],
  })
  .input(restListFormsQuery)
  .handler(async ({ input, context }) => {
    return formService.list(context.dbTx, input);
  });

const create = orgProcedure
  .use(requireScopes('forms:write'))
  .route({
    method: 'POST',
    path: '/forms',
    successStatus: 201,
    summary: 'Create a form definition',
    description: 'Create a new form definition in DRAFT status.',
    operationId: 'createForm',
    tags: ['Forms'],
  })
  .input(createFormDefinitionSchema)
  .handler(async ({ input, context }) => {
    try {
      return await formService.createWithAudit(
        toServiceContext(context),
        input,
      );
    } catch (e) {
      mapServiceError(e);
    }
  });

const get = orgProcedure
  .use(requireScopes('forms:read'))
  .route({
    method: 'GET',
    path: '/forms/{id}',
    summary: 'Get a form definition',
    description:
      'Retrieve a form definition by ID, including its fields ordered by sortOrder.',
    operationId: 'getForm',
    tags: ['Forms'],
  })
  .input(idParamSchema)
  .handler(async ({ input, context }) => {
    try {
      const form = await formService.getById(context.dbTx, input.id);
      if (!form) throw new FormNotFoundError(input.id);
      return form;
    } catch (e) {
      mapServiceError(e);
    }
  });

const update = orgProcedure
  .use(requireScopes('forms:write'))
  .route({
    method: 'PATCH',
    path: '/forms/{id}',
    summary: 'Update a form definition',
    description: "Update a DRAFT form definition's name or description.",
    operationId: 'updateForm',
    tags: ['Forms'],
  })
  .input(idParamSchema.merge(updateFormDefinitionSchema))
  .handler(async ({ input, context }) => {
    const { id, ...data } = input;
    try {
      return await formService.updateWithAudit(
        toServiceContext(context),
        id,
        data,
      );
    } catch (e) {
      mapServiceError(e);
    }
  });

const publish = orgProcedure
  .use(requireScopes('forms:write'))
  .route({
    method: 'POST',
    path: '/forms/{id}/publish',
    summary: 'Publish a form',
    description:
      'Transition a DRAFT form to PUBLISHED status. Requires at least one field.',
    operationId: 'publishForm',
    tags: ['Forms'],
  })
  .input(idParamSchema)
  .handler(async ({ input, context }) => {
    try {
      return await formService.publishWithAudit(
        toServiceContext(context),
        input.id,
      );
    } catch (e) {
      mapServiceError(e);
    }
  });

const archive = orgProcedure
  .use(requireScopes('forms:write'))
  .route({
    method: 'POST',
    path: '/forms/{id}/archive',
    summary: 'Archive a form',
    description: 'Transition a PUBLISHED form to ARCHIVED status.',
    operationId: 'archiveForm',
    tags: ['Forms'],
  })
  .input(idParamSchema)
  .handler(async ({ input, context }) => {
    try {
      return await formService.archiveWithAudit(
        toServiceContext(context),
        input.id,
      );
    } catch (e) {
      mapServiceError(e);
    }
  });

const duplicate = orgProcedure
  .use(requireScopes('forms:write'))
  .route({
    method: 'POST',
    path: '/forms/{id}/duplicate',
    successStatus: 201,
    summary: 'Duplicate a form',
    description:
      'Create a copy of a form (including all fields) as a new DRAFT.',
    operationId: 'duplicateForm',
    tags: ['Forms'],
  })
  .input(idParamSchema)
  .handler(async ({ input, context }) => {
    try {
      const result = await formService.duplicateWithAudit(
        toServiceContext(context),
        input.id,
      );
      return result;
    } catch (e) {
      mapServiceError(e);
    }
  });

const del = orgProcedure
  .use(requireScopes('forms:write'))
  .route({
    method: 'DELETE',
    path: '/forms/{id}',
    summary: 'Delete a form',
    description:
      'Delete a DRAFT form. Fails if referenced by submission periods or submissions.',
    operationId: 'deleteForm',
    tags: ['Forms'],
  })
  .input(idParamSchema)
  .handler(async ({ input, context }) => {
    try {
      return await formService.deleteWithAudit(
        toServiceContext(context),
        input.id,
      );
    } catch (e) {
      mapServiceError(e);
    }
  });

const addField = orgProcedure
  .use(requireScopes('forms:write'))
  .route({
    method: 'POST',
    path: '/forms/{id}/fields',
    successStatus: 201,
    summary: 'Add a field',
    description: 'Add a new field to a DRAFT form definition.',
    operationId: 'addFormField',
    tags: ['Forms'],
  })
  .input(idParamSchema.merge(createFormFieldSchema))
  .handler(async ({ input, context }) => {
    const { id, ...fieldData } = input;
    try {
      return await formService.addFieldWithAudit(
        toServiceContext(context),
        id,
        fieldData,
      );
    } catch (e) {
      mapServiceError(e);
    }
  });

const updateField = orgProcedure
  .use(requireScopes('forms:write'))
  .route({
    method: 'PATCH',
    path: '/forms/{id}/fields/{fieldId}',
    summary: 'Update a field',
    description: 'Update a field in a DRAFT form definition.',
    operationId: 'updateFormField',
    tags: ['Forms'],
  })
  .input(formFieldIdParam.merge(updateFormFieldSchema))
  .handler(async ({ input, context }) => {
    const { id, fieldId, ...data } = input;
    try {
      return await formService.updateFieldWithAudit(
        toServiceContext(context),
        id,
        fieldId,
        data,
      );
    } catch (e) {
      mapServiceError(e);
    }
  });

const removeField = orgProcedure
  .use(requireScopes('forms:write'))
  .route({
    method: 'DELETE',
    path: '/forms/{id}/fields/{fieldId}',
    summary: 'Remove a field',
    description: 'Remove a field from a DRAFT form definition.',
    operationId: 'removeFormField',
    tags: ['Forms'],
  })
  .input(formFieldIdParam)
  .handler(async ({ input, context }) => {
    try {
      return await formService.removeFieldWithAudit(
        toServiceContext(context),
        input.id,
        input.fieldId,
      );
    } catch (e) {
      mapServiceError(e);
    }
  });

const reorderFields = orgProcedure
  .use(requireScopes('forms:write'))
  .route({
    method: 'PUT',
    path: '/forms/{id}/fields/order',
    summary: 'Reorder fields',
    description: 'Set the display order of fields in a DRAFT form definition.',
    operationId: 'reorderFormFields',
    tags: ['Forms'],
  })
  .input(idParamSchema.merge(reorderFormFieldsSchema))
  .handler(async ({ input, context }) => {
    const { id, ...data } = input;
    try {
      return await formService.reorderFieldsWithAudit(
        toServiceContext(context),
        id,
        data,
      );
    } catch (e) {
      mapServiceError(e);
    }
  });

// ---------------------------------------------------------------------------
// Page routes
// ---------------------------------------------------------------------------

const addPage = orgProcedure
  .use(requireScopes('forms:write'))
  .route({
    method: 'POST',
    path: '/forms/{id}/pages',
    successStatus: 201,
    summary: 'Add a page',
    description: 'Add a new page to a DRAFT form definition.',
    operationId: 'addFormPage',
    tags: ['Forms'],
  })
  .input(idParamSchema.merge(createFormPageSchema))
  .handler(async ({ input, context }) => {
    const { id, ...pageData } = input;
    try {
      return await formService.addPageWithAudit(
        toServiceContext(context),
        id,
        pageData,
      );
    } catch (e) {
      mapServiceError(e);
    }
  });

const updatePage = orgProcedure
  .use(requireScopes('forms:write'))
  .route({
    method: 'PATCH',
    path: '/forms/{id}/pages/{pageId}',
    summary: 'Update a page',
    description: 'Update a page in a DRAFT form definition.',
    operationId: 'updateFormPage',
    tags: ['Forms'],
  })
  .input(formPageIdParam.merge(updateFormPageSchema))
  .handler(async ({ input, context }) => {
    const { id, pageId, ...data } = input;
    try {
      return await formService.updatePageWithAudit(
        toServiceContext(context),
        id,
        pageId,
        data,
      );
    } catch (e) {
      mapServiceError(e);
    }
  });

const removePage = orgProcedure
  .use(requireScopes('forms:write'))
  .route({
    method: 'DELETE',
    path: '/forms/{id}/pages/{pageId}',
    summary: 'Remove a page',
    description: 'Remove a page from a DRAFT form definition.',
    operationId: 'removeFormPage',
    tags: ['Forms'],
  })
  .input(formPageIdParam)
  .handler(async ({ input, context }) => {
    try {
      return await formService.removePageWithAudit(
        toServiceContext(context),
        input.id,
        input.pageId,
      );
    } catch (e) {
      mapServiceError(e);
    }
  });

const reorderPages = orgProcedure
  .use(requireScopes('forms:write'))
  .route({
    method: 'PUT',
    path: '/forms/{id}/pages/order',
    summary: 'Reorder pages',
    description: 'Set the display order of pages in a DRAFT form definition.',
    operationId: 'reorderFormPages',
    tags: ['Forms'],
  })
  .input(idParamSchema.merge(reorderFormPagesSchema))
  .handler(async ({ input, context }) => {
    const { id, ...data } = input;
    try {
      return await formService.reorderPagesWithAudit(
        toServiceContext(context),
        id,
        data,
      );
    } catch (e) {
      mapServiceError(e);
    }
  });

// ---------------------------------------------------------------------------
// Assembled router
// ---------------------------------------------------------------------------

export const formsRouter = {
  list,
  create,
  get,
  update,
  publish,
  archive,
  duplicate,
  delete: del,
  addField,
  updateField,
  removeField,
  reorderFields,
  addPage,
  updatePage,
  removePage,
  reorderPages,
};
