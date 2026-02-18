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
    .route({ method: "GET", path: "/submissions/mine" })
    .input(restListSubmissionsQuery)
    .output(paginatedSubmissionsSchema),

  list: oc
    .route({ method: "GET", path: "/submissions" })
    .input(restListSubmissionsQuery)
    .output(paginatedSubmissionsSchema),

  create: oc
    .route({ method: "POST", path: "/submissions", successStatus: 201 })
    .input(createSubmissionSchema)
    .output(submissionSchema),

  get: oc
    .route({ method: "GET", path: "/submissions/{id}" })
    .input(submissionIdParam)
    .output(submissionWithDetailsSchema),

  update: oc
    .route({ method: "PATCH", path: "/submissions/{id}" })
    .input(submissionIdParam.merge(updateSubmissionSchema))
    .output(submissionSchema),

  submit: oc
    .route({ method: "POST", path: "/submissions/{id}/submit" })
    .input(submissionIdParam)
    .output(statusUpdateResponseSchema),

  delete: oc
    .route({ method: "DELETE", path: "/submissions/{id}" })
    .input(submissionIdParam)
    .output(deleteResponseSchema),

  withdraw: oc
    .route({ method: "POST", path: "/submissions/{id}/withdraw" })
    .input(submissionIdParam)
    .output(statusUpdateResponseSchema),

  updateStatus: oc
    .route({ method: "PATCH", path: "/submissions/{id}/status" })
    .input(submissionIdParam.merge(updateSubmissionStatusSchema))
    .output(statusUpdateResponseSchema),

  history: oc
    .route({ method: "GET", path: "/submissions/{id}/history" })
    .input(submissionIdParam)
    .output(z.array(submissionHistorySchema)),
};
