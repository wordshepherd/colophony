import { oc } from "@orpc/contract";
import { z } from "zod";
import {
  manuscriptSchema,
  manuscriptDetailSchema,
  manuscriptVersionSchema,
  relatedSubmissionSchema,
  createManuscriptSchema,
  updateManuscriptSchema,
  listManuscriptsSchema,
} from "@colophony/types";

// ---------------------------------------------------------------------------
// Path param schemas
// ---------------------------------------------------------------------------

const manuscriptIdParam = z.object({
  manuscriptId: z.string().uuid(),
});

// ---------------------------------------------------------------------------
// Response schemas
// ---------------------------------------------------------------------------

const deleteResponseSchema = z.object({
  success: z.literal(true),
});

const paginatedManuscriptsSchema = z.object({
  items: z.array(manuscriptSchema),
  total: z.number(),
  page: z.number(),
  limit: z.number(),
  totalPages: z.number(),
});

// ---------------------------------------------------------------------------
// Contract
// ---------------------------------------------------------------------------

export const manuscriptsContract = {
  list: oc
    .route({
      method: "GET",
      path: "/manuscripts",
      summary: "List manuscripts",
      description: "Returns all manuscripts owned by the authenticated user.",
      operationId: "listManuscripts",
      tags: ["Manuscripts"],
    })
    .input(listManuscriptsSchema)
    .output(paginatedManuscriptsSchema),

  getById: oc
    .route({
      method: "GET",
      path: "/manuscripts/{manuscriptId}",
      summary: "Get manuscript",
      description: "Returns a manuscript with all versions and files.",
      operationId: "getManuscript",
      tags: ["Manuscripts"],
    })
    .input(manuscriptIdParam)
    .output(manuscriptDetailSchema),

  create: oc
    .route({
      method: "POST",
      path: "/manuscripts",
      summary: "Create manuscript",
      description: "Creates a new manuscript with an initial version.",
      operationId: "createManuscript",
      tags: ["Manuscripts"],
    })
    .input(createManuscriptSchema)
    .output(manuscriptSchema),

  update: oc
    .route({
      method: "PATCH",
      path: "/manuscripts/{manuscriptId}",
      summary: "Update manuscript",
      description: "Updates manuscript title and/or description.",
      operationId: "updateManuscript",
      tags: ["Manuscripts"],
    })
    .input(manuscriptIdParam.merge(updateManuscriptSchema))
    .output(manuscriptSchema),

  delete: oc
    .route({
      method: "DELETE",
      path: "/manuscripts/{manuscriptId}",
      summary: "Delete manuscript",
      description: "Deletes a manuscript and all its versions and files.",
      operationId: "deleteManuscript",
      tags: ["Manuscripts"],
    })
    .input(manuscriptIdParam)
    .output(deleteResponseSchema),

  createVersion: oc
    .route({
      method: "POST",
      path: "/manuscripts/{manuscriptId}/versions",
      summary: "Create version",
      description: "Creates a new version of a manuscript.",
      operationId: "createManuscriptVersion",
      tags: ["Manuscripts"],
    })
    .input(
      manuscriptIdParam.extend({
        label: z.string().max(255).optional(),
      }),
    )
    .output(manuscriptVersionSchema),

  listVersions: oc
    .route({
      method: "GET",
      path: "/manuscripts/{manuscriptId}/versions",
      summary: "List versions",
      description: "Returns all versions of a manuscript.",
      operationId: "listManuscriptVersions",
      tags: ["Manuscripts"],
    })
    .input(manuscriptIdParam)
    .output(z.array(manuscriptVersionSchema)),

  getRelatedSubmissions: oc
    .route({
      method: "GET",
      path: "/manuscripts/{manuscriptId}/submissions",
      summary: "Related submissions",
      description:
        "Returns all submissions referencing any version of this manuscript.",
      operationId: "getManuscriptRelatedSubmissions",
      tags: ["Manuscripts"],
    })
    .input(manuscriptIdParam)
    .output(z.array(relatedSubmissionSchema)),
};
