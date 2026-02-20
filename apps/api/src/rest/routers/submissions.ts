import {
  createSubmissionSchema,
  updateSubmissionSchema,
  updateSubmissionStatusSchema,
  listSubmissionsSchema,
  idParamSchema,
} from '@colophony/types';
import { restPaginationQuery } from '@colophony/api-contracts';
import { submissionService } from '../../services/submission.service.js';
import { toServiceContext } from '../../services/context.js';
import { assertEditorOrAdmin } from '../../services/errors.js';
import { mapServiceError } from '../error-mapper.js';
import { orgProcedure, requireScopes } from '../context.js';

// ---------------------------------------------------------------------------
// Query schemas — override page/limit with z.coerce for REST query strings
// ---------------------------------------------------------------------------

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
  .handler(async ({ input, context }) => {
    try {
      return await submissionService.submitAsOwner(
        toServiceContext(context),
        input.id,
      );
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
// Assembled router
// ---------------------------------------------------------------------------

export const submissionsRouter = {
  mine,
  list,
  create,
  get,
  update,
  submit,
  delete: del,
  withdraw,
  updateStatus,
  history,
};
