import { z } from 'zod';
import {
  createSubmissionSchema,
  updateSubmissionSchema,
  updateSubmissionStatusSchema,
  listSubmissionsSchema,
  resubmitSchema,
  idParamSchema,
  submissionSchema,
  submissionHistorySchema,
  fileSchema,
  paginatedResponseSchema,
  successResponseSchema,
  submissionReviewerSchema,
} from '@colophony/types';
import { restPaginationQuery } from '@colophony/api-contracts';
import { submissionService } from '../../services/submission.service.js';
import { submissionReviewerService } from '../../services/submission-reviewer.service.js';
import { simsubService } from '../../services/simsub.service.js';
import { toServiceContext } from '../../services/context.js';
import { assertEditorOrAdmin } from '../../services/errors.js';
import { mapServiceError } from '../error-mapper.js';
import { orgProcedure, requireScopes } from '../context.js';
import { validateEnv } from '../../config/env.js';

// ---------------------------------------------------------------------------
// Query schemas — override page/limit with z.coerce for REST query strings
// ---------------------------------------------------------------------------

const paginatedSubmissionsSchema = paginatedResponseSchema(submissionSchema);

const submissionWithDetailsSchema = submissionSchema.extend({
  files: z.array(fileSchema),
  submitterEmail: z.string().nullable(),
});

const statusUpdateResponseSchema = z.object({
  submission: submissionSchema,
  historyEntry: submissionHistorySchema,
});

const restListSubmissionsQuery = listSubmissionsSchema
  .omit({ page: true, limit: true })
  .merge(restPaginationQuery);

// ---------------------------------------------------------------------------
// Submission routes
// ---------------------------------------------------------------------------

const mine = orgProcedure
  .use(requireScopes('submissions:read'))
  .route({
    method: 'GET',
    path: '/submissions/mine',
    summary: 'List my submissions',
    description:
      'Returns submissions created by the authenticated user in the current organization.',
    operationId: 'listMySubmissions',
    tags: ['Submissions'],
  })
  .input(restListSubmissionsQuery)
  .output(paginatedSubmissionsSchema)
  .handler(async ({ input, context }) => {
    return submissionService.listBySubmitter(
      context.dbTx,
      context.authContext.userId,
      input,
    );
  });

const list = orgProcedure
  .use(requireScopes('submissions:read'))
  .route({
    method: 'GET',
    path: '/submissions',
    summary: 'List all submissions',
    description:
      'Returns all submissions in the organization. Requires EDITOR or ADMIN role.',
    operationId: 'listSubmissions',
    tags: ['Submissions'],
  })
  .input(restListSubmissionsQuery)
  .output(paginatedSubmissionsSchema)
  .handler(async ({ input, context }) => {
    try {
      assertEditorOrAdmin(context.authContext.role);
      return await submissionService.listAll(context.dbTx, input);
    } catch (e) {
      mapServiceError(e);
    }
  });

const create = orgProcedure
  .use(requireScopes('submissions:write'))
  .route({
    method: 'POST',
    path: '/submissions',
    successStatus: 201,
    summary: 'Create a submission',
    description: 'Create a new submission in DRAFT status.',
    operationId: 'createSubmission',
    tags: ['Submissions'],
  })
  .input(createSubmissionSchema)
  .output(submissionSchema)
  .handler(async ({ input, context }) => {
    try {
      return await submissionService.createWithAudit(
        toServiceContext(context),
        input,
      );
    } catch (e) {
      mapServiceError(e);
    }
  });

const get = orgProcedure
  .use(requireScopes('submissions:read'))
  .route({
    method: 'GET',
    path: '/submissions/{id}',
    summary: 'Get a submission',
    description:
      'Retrieve a single submission by ID, including attached files and submitter email.',
    operationId: 'getSubmission',
    tags: ['Submissions'],
  })
  .input(idParamSchema)
  .output(submissionWithDetailsSchema)
  .handler(async ({ input, context }) => {
    try {
      return await submissionService.getByIdWithAccess(
        toServiceContext(context),
        input.id,
      );
    } catch (e) {
      mapServiceError(e);
    }
  });

const update = orgProcedure
  .use(requireScopes('submissions:write'))
  .route({
    method: 'PATCH',
    path: '/submissions/{id}',
    summary: 'Update a submission',
    description:
      "Update a submission's title, content, or cover letter. Only allowed while in DRAFT status.",
    operationId: 'updateSubmission',
    tags: ['Submissions'],
  })
  .input(idParamSchema.merge(updateSubmissionSchema))
  .output(submissionSchema)
  .handler(async ({ input, context }) => {
    const { id, ...data } = input;
    try {
      return await submissionService.updateAsOwner(
        toServiceContext(context),
        id,
        data,
      );
    } catch (e) {
      mapServiceError(e);
    }
  });

const submit = orgProcedure
  .use(requireScopes('submissions:write'))
  .route({
    method: 'POST',
    path: '/submissions/{id}/submit',
    summary: 'Submit a submission',
    description:
      'Transition a DRAFT submission to SUBMITTED status. Validates that all files have passed virus scanning.',
    operationId: 'submitSubmission',
    tags: ['Submissions'],
  })
  .input(idParamSchema)
  .output(statusUpdateResponseSchema)
  .handler(async ({ input, context }) => {
    try {
      const env = validateEnv();
      const svc = toServiceContext(context);
      await simsubService.preSubmitCheck(
        env,
        svc.tx,
        input.id,
        svc.actor.userId,
        svc.actor.orgId,
      );
      return await submissionService.submitAsOwner(svc, input.id);
    } catch (e) {
      mapServiceError(e);
    }
  });

const del = orgProcedure
  .use(requireScopes('submissions:write'))
  .route({
    method: 'DELETE',
    path: '/submissions/{id}',
    summary: 'Delete a submission',
    description:
      'Permanently delete a DRAFT submission and its attached files.',
    operationId: 'deleteSubmission',
    tags: ['Submissions'],
  })
  .input(idParamSchema)
  .output(successResponseSchema)
  .handler(async ({ input, context }) => {
    try {
      return await submissionService.deleteAsOwner(
        toServiceContext(context),
        input.id,
      );
    } catch (e) {
      mapServiceError(e);
    }
  });

const resubmit = orgProcedure
  .use(requireScopes('submissions:write'))
  .route({
    method: 'POST',
    path: '/submissions/{id}/resubmit',
    summary: 'Resubmit with a new manuscript version',
    description:
      'Resubmit a submission that is in REVISE_AND_RESUBMIT status with a new manuscript version. Only the submitter can resubmit.',
    operationId: 'resubmitSubmission',
    tags: ['Submissions'],
  })
  .input(resubmitSchema)
  .output(statusUpdateResponseSchema)
  .handler(async ({ input, context }) => {
    try {
      return await submissionService.resubmitAsOwner(
        toServiceContext(context),
        input.id,
        input.manuscriptVersionId,
      );
    } catch (e) {
      mapServiceError(e);
    }
  });

const withdraw = orgProcedure
  .use(requireScopes('submissions:write'))
  .route({
    method: 'POST',
    path: '/submissions/{id}/withdraw',
    summary: 'Withdraw a submission',
    description:
      'Withdraw a submission from consideration. Allowed from DRAFT, SUBMITTED, UNDER_REVIEW, or HOLD status.',
    operationId: 'withdrawSubmission',
    tags: ['Submissions'],
  })
  .input(idParamSchema)
  .output(statusUpdateResponseSchema)
  .handler(async ({ input, context }) => {
    try {
      return await submissionService.withdrawAsOwner(
        toServiceContext(context),
        input.id,
      );
    } catch (e) {
      mapServiceError(e);
    }
  });

const updateStatus = orgProcedure
  .use(requireScopes('submissions:write'))
  .route({
    method: 'PATCH',
    path: '/submissions/{id}/status',
    summary: 'Update submission status',
    description:
      'Transition a submission to a new status. Requires EDITOR or ADMIN role. Valid transitions depend on current status.',
    operationId: 'updateSubmissionStatus',
    tags: ['Submissions'],
  })
  .input(idParamSchema.merge(updateSubmissionStatusSchema))
  .output(statusUpdateResponseSchema)
  .handler(async ({ input, context }) => {
    const { id, status, comment } = input;
    try {
      return await submissionService.updateStatusAsEditor(
        toServiceContext(context),
        id,
        status,
        comment,
      );
    } catch (e) {
      mapServiceError(e);
    }
  });

const history = orgProcedure
  .use(requireScopes('submissions:read'))
  .route({
    method: 'GET',
    path: '/submissions/{id}/history',
    summary: 'Get submission history',
    description: 'Returns the status change history for a submission.',
    operationId: 'getSubmissionHistory',
    tags: ['Submissions'],
  })
  .input(idParamSchema)
  .output(z.array(submissionHistorySchema))
  .handler(async ({ input, context }) => {
    try {
      return await submissionService.getHistoryWithAccess(
        toServiceContext(context),
        input.id,
      );
    } catch (e) {
      mapServiceError(e);
    }
  });

// ---------------------------------------------------------------------------
// Reviewer routes
// ---------------------------------------------------------------------------

const listReviewers = orgProcedure
  .use(requireScopes('submissions:read'))
  .route({
    method: 'GET',
    path: '/submissions/{id}/reviewers',
    summary: 'List submission reviewers',
    description:
      'Returns reviewers assigned to a submission. Visible to the submitter and editors/admins.',
    operationId: 'listSubmissionReviewers',
    tags: ['Submissions'],
  })
  .input(idParamSchema)
  .output(z.array(submissionReviewerSchema))
  .handler(async ({ input, context }) => {
    try {
      return await submissionReviewerService.listBySubmissionWithAccess(
        toServiceContext(context),
        input.id,
      );
    } catch (e) {
      mapServiceError(e);
    }
  });

const assignReviewers = orgProcedure
  .use(requireScopes('submissions:write'))
  .route({
    method: 'POST',
    path: '/submissions/{id}/reviewers',
    successStatus: 201,
    summary: 'Assign reviewers',
    description:
      'Assign one or more org members as reviewers on a submission. Requires EDITOR or ADMIN role.',
    operationId: 'assignSubmissionReviewers',
    tags: ['Submissions'],
  })
  .input(
    idParamSchema.merge(
      z.object({
        reviewerUserIds: z.array(z.string().uuid()).min(1).max(20),
      }),
    ),
  )
  .output(z.array(submissionReviewerSchema))
  .handler(async ({ input, context }) => {
    try {
      return await submissionReviewerService.assignWithAudit(
        toServiceContext(context),
        input.id,
        input.reviewerUserIds,
      );
    } catch (e) {
      mapServiceError(e);
    }
  });

const unassignReviewer = orgProcedure
  .use(requireScopes('submissions:write'))
  .route({
    method: 'DELETE',
    path: '/submissions/{id}/reviewers/{reviewerUserId}',
    summary: 'Unassign a reviewer',
    description:
      'Remove a reviewer from a submission. Requires EDITOR or ADMIN role.',
    operationId: 'unassignSubmissionReviewer',
    tags: ['Submissions'],
  })
  .input(
    z.object({
      id: z.string().uuid(),
      reviewerUserId: z.string().uuid(),
    }),
  )
  .output(successResponseSchema)
  .handler(async ({ input, context }) => {
    try {
      await submissionReviewerService.unassignWithAudit(
        toServiceContext(context),
        input.id,
        input.reviewerUserId,
      );
      return { success: true as const };
    } catch (e) {
      mapServiceError(e);
    }
  });

const markReviewerRead = orgProcedure
  .use(requireScopes('submissions:read'))
  .route({
    method: 'POST',
    path: '/submissions/{id}/reviewers/mark-read',
    summary: 'Mark submission as read',
    description:
      'Mark the current user as having read the submission. Idempotent — no-op if not a reviewer or already read.',
    operationId: 'markSubmissionReviewerRead',
    tags: ['Submissions'],
  })
  .input(idParamSchema)
  .output(successResponseSchema)
  .handler(async ({ input, context }) => {
    try {
      return await submissionReviewerService.markReadWithAudit(
        toServiceContext(context),
        input.id,
      );
    } catch (e) {
      mapServiceError(e);
    }
  });

// ---------------------------------------------------------------------------
// Assembled router
// ---------------------------------------------------------------------------

export const submissionsRouter = {
  mine,
  list,
  create,
  get,
  update,
  submit,
  resubmit,
  delete: del,
  withdraw,
  updateStatus,
  history,
  listReviewers,
  assignReviewers,
  unassignReviewer,
  markReviewerRead,
};
