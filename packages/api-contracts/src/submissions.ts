import { oc } from "@orpc/contract";
import { z } from "zod";
import {
  submissionSchema,
  submissionFileSchema,
  createSubmissionSchema,
  updateSubmissionSchema,
  updateSubmissionStatusSchema,
  listSubmissionsSchema,
  submissionHistorySchema,
} from "@colophony/types";
import { restPaginationQuery } from "./shared.js";

// ---------------------------------------------------------------------------
// Query schemas — override page/limit with z.coerce for REST query strings
// ---------------------------------------------------------------------------

const restListSubmissionsQuery = listSubmissionsSchema
  .omit({ page: true, limit: true })
  .merge(restPaginationQuery);

// ---------------------------------------------------------------------------
// Path param schemas
// ---------------------------------------------------------------------------

const submissionIdParam = z.object({
  id: z.string().uuid(),
});

// ---------------------------------------------------------------------------
// Response schemas
// ---------------------------------------------------------------------------

const submissionWithDetailsSchema = submissionSchema.extend({
  files: z.array(submissionFileSchema),
  submitterEmail: z.string().nullable(),
});

const paginatedSubmissionsSchema = z.object({
  items: z.array(submissionSchema),
  total: z.number(),
  page: z.number(),
  limit: z.number(),
  totalPages: z.number(),
});

const statusUpdateResponseSchema = z.object({
  submission: submissionSchema,
  historyEntry: submissionHistorySchema,
});

const deleteResponseSchema = z.object({
  success: z.literal(true),
});

// ---------------------------------------------------------------------------
// Contract
// ---------------------------------------------------------------------------

export const submissionsContract = {
  mine: oc
    .route({
      method: "GET",
      path: "/submissions/mine",
      summary: "List my submissions",
      description:
        "Returns a paginated list of the authenticated user's own submissions.",
      operationId: "listMySubmissions",
      tags: ["Submissions"],
    })
    .input(restListSubmissionsQuery)
    .output(paginatedSubmissionsSchema),

  list: oc
    .route({
      method: "GET",
      path: "/submissions",
      summary: "List all submissions",
      description:
        "Returns a paginated list of all submissions in the organization. Requires EDITOR or ADMIN role.",
      operationId: "listSubmissions",
      tags: ["Submissions"],
    })
    .input(restListSubmissionsQuery)
    .output(paginatedSubmissionsSchema),

  create: oc
    .route({
      method: "POST",
      path: "/submissions",
      successStatus: 201,
      summary: "Create a submission",
      description:
        "Create a new submission in DRAFT status. Attach files separately via the Files endpoints.",
      operationId: "createSubmission",
      tags: ["Submissions"],
    })
    .input(createSubmissionSchema)
    .output(submissionSchema),

  get: oc
    .route({
      method: "GET",
      path: "/submissions/{id}",
      summary: "Get a submission",
      description:
        "Retrieve a single submission with its attached files. Editors/admins can view any submission; submitters can view their own.",
      operationId: "getSubmission",
      tags: ["Submissions"],
    })
    .input(submissionIdParam)
    .output(submissionWithDetailsSchema),

  update: oc
    .route({
      method: "PATCH",
      path: "/submissions/{id}",
      summary: "Update a submission",
      description:
        "Update a DRAFT submission's title, content, or cover letter. Only the submitter can update.",
      operationId: "updateSubmission",
      tags: ["Submissions"],
    })
    .input(submissionIdParam.merge(updateSubmissionSchema))
    .output(submissionSchema),

  submit: oc
    .route({
      method: "POST",
      path: "/submissions/{id}/submit",
      summary: "Submit a draft",
      description:
        "Transition a DRAFT submission to SUBMITTED status. Only the submitter can submit.",
      operationId: "submitSubmission",
      tags: ["Submissions"],
    })
    .input(submissionIdParam)
    .output(statusUpdateResponseSchema),

  delete: oc
    .route({
      method: "DELETE",
      path: "/submissions/{id}",
      summary: "Delete a submission",
      description:
        "Delete a DRAFT submission and its attached files. Only the submitter can delete.",
      operationId: "deleteSubmission",
      tags: ["Submissions"],
    })
    .input(submissionIdParam)
    .output(deleteResponseSchema),

  withdraw: oc
    .route({
      method: "POST",
      path: "/submissions/{id}/withdraw",
      summary: "Withdraw a submission",
      description:
        "Withdraw a submission from consideration. Only the submitter can withdraw.",
      operationId: "withdrawSubmission",
      tags: ["Submissions"],
    })
    .input(submissionIdParam)
    .output(statusUpdateResponseSchema),

  updateStatus: oc
    .route({
      method: "PATCH",
      path: "/submissions/{id}/status",
      summary: "Update submission status",
      description:
        "Transition a submission's status (e.g. SUBMITTED → UNDER_REVIEW). Requires EDITOR or ADMIN role. Invalid transitions are rejected.",
      operationId: "updateSubmissionStatus",
      tags: ["Submissions"],
    })
    .input(submissionIdParam.merge(updateSubmissionStatusSchema))
    .output(statusUpdateResponseSchema),

  history: oc
    .route({
      method: "GET",
      path: "/submissions/{id}/history",
      summary: "Get submission history",
      description: "Retrieve the full status change history for a submission.",
      operationId: "getSubmissionHistory",
      tags: ["Submissions"],
    })
    .input(submissionIdParam)
    .output(z.array(submissionHistorySchema)),
};
