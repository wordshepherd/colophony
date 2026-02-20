import { oc } from "@orpc/contract";
import { z } from "zod";
import {
  formDefinitionSchema,
  formDefinitionDetailSchema,
  formFieldSchema,
  createFormDefinitionSchema,
  updateFormDefinitionSchema,
  createFormFieldSchema,
  updateFormFieldSchema,
  reorderFormFieldsSchema,
  listFormDefinitionsSchema,
} from "@colophony/types";
import { restPaginationQuery } from "./shared.js";

// ---------------------------------------------------------------------------
// Query schemas — override page/limit with z.coerce for REST query strings
// ---------------------------------------------------------------------------

const restListFormsQuery = listFormDefinitionsSchema
  .omit({ page: true, limit: true })
  .merge(restPaginationQuery);

// ---------------------------------------------------------------------------
// Path param schemas
// ---------------------------------------------------------------------------

const formIdParam = z.object({
  id: z.string().uuid(),
});

const formFieldIdParam = z.object({
  id: z.string().uuid(),
  fieldId: z.string().uuid(),
});

// ---------------------------------------------------------------------------
// Response schemas
// ---------------------------------------------------------------------------

const paginatedFormsSchema = z.object({
  items: z.array(formDefinitionSchema),
  total: z.number(),
  page: z.number(),
  limit: z.number(),
  totalPages: z.number(),
});

const deleteResponseSchema = z.object({
  success: z.literal(true),
});

// ---------------------------------------------------------------------------
// Contract
// ---------------------------------------------------------------------------

export const formsContract = {
  list: oc
    .route({
      method: "GET",
      path: "/forms",
      summary: "List form definitions",
      description:
        "Returns a paginated list of form definitions in the organization.",
      operationId: "listForms",
      tags: ["Forms"],
    })
    .input(restListFormsQuery)
    .output(paginatedFormsSchema),

  create: oc
    .route({
      method: "POST",
      path: "/forms",
      successStatus: 201,
      summary: "Create a form definition",
      description: "Create a new form definition in DRAFT status.",
      operationId: "createForm",
      tags: ["Forms"],
    })
    .input(createFormDefinitionSchema)
    .output(formDefinitionSchema),

  get: oc
    .route({
      method: "GET",
      path: "/forms/{id}",
      summary: "Get a form definition",
      description:
        "Retrieve a form definition by ID, including its fields ordered by sortOrder.",
      operationId: "getForm",
      tags: ["Forms"],
    })
    .input(formIdParam)
    .output(formDefinitionDetailSchema),

  update: oc
    .route({
      method: "PATCH",
      path: "/forms/{id}",
      summary: "Update a form definition",
      description: "Update a DRAFT form definition's name or description.",
      operationId: "updateForm",
      tags: ["Forms"],
    })
    .input(formIdParam.merge(updateFormDefinitionSchema))
    .output(formDefinitionSchema),

  publish: oc
    .route({
      method: "POST",
      path: "/forms/{id}/publish",
      summary: "Publish a form",
      description:
        "Transition a DRAFT form to PUBLISHED status. Requires at least one field.",
      operationId: "publishForm",
      tags: ["Forms"],
    })
    .input(formIdParam)
    .output(formDefinitionSchema),

  archive: oc
    .route({
      method: "POST",
      path: "/forms/{id}/archive",
      summary: "Archive a form",
      description: "Transition a PUBLISHED form to ARCHIVED status.",
      operationId: "archiveForm",
      tags: ["Forms"],
    })
    .input(formIdParam)
    .output(formDefinitionSchema),

  duplicate: oc
    .route({
      method: "POST",
      path: "/forms/{id}/duplicate",
      successStatus: 201,
      summary: "Duplicate a form",
      description:
        "Create a copy of a form (including all fields) as a new DRAFT.",
      operationId: "duplicateForm",
      tags: ["Forms"],
    })
    .input(formIdParam)
    .output(formDefinitionDetailSchema),

  delete: oc
    .route({
      method: "DELETE",
      path: "/forms/{id}",
      summary: "Delete a form",
      description:
        "Delete a DRAFT form definition. Fails if referenced by submission periods or submissions.",
      operationId: "deleteForm",
      tags: ["Forms"],
    })
    .input(formIdParam)
    .output(deleteResponseSchema),

  addField: oc
    .route({
      method: "POST",
      path: "/forms/{id}/fields",
      successStatus: 201,
      summary: "Add a field",
      description: "Add a new field to a DRAFT form definition.",
      operationId: "addFormField",
      tags: ["Forms"],
    })
    .input(formIdParam.merge(createFormFieldSchema))
    .output(formFieldSchema),

  updateField: oc
    .route({
      method: "PATCH",
      path: "/forms/{id}/fields/{fieldId}",
      summary: "Update a field",
      description: "Update a field in a DRAFT form definition.",
      operationId: "updateFormField",
      tags: ["Forms"],
    })
    .input(formFieldIdParam.merge(updateFormFieldSchema))
    .output(formFieldSchema),

  removeField: oc
    .route({
      method: "DELETE",
      path: "/forms/{id}/fields/{fieldId}",
      summary: "Remove a field",
      description: "Remove a field from a DRAFT form definition.",
      operationId: "removeFormField",
      tags: ["Forms"],
    })
    .input(formFieldIdParam)
    .output(formFieldSchema),

  reorderFields: oc
    .route({
      method: "PUT",
      path: "/forms/{id}/fields/order",
      summary: "Reorder fields",
      description:
        "Set the display order of fields in a DRAFT form definition.",
      operationId: "reorderFormFields",
      tags: ["Forms"],
    })
    .input(formIdParam.merge(reorderFormFieldsSchema))
    .output(z.array(formFieldSchema)),
};
