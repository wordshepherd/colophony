import { z } from 'zod';
import {
  createSubmissionSchema,
  updateSubmissionSchema,
  updateSubmissionStatusSchema,
  listSubmissionsSchema,
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
// Path param schemas
// ---------------------------------------------------------------------------

const submissionIdParam = z.object({ id: z.string().uuid() });

// ---------------------------------------------------------------------------
// Submission routes
// ---------------------------------------------------------------------------

const mine = orgProcedure
  .use(requireScopes('submissions:read'))
  .route({ method: 'GET', path: '/submissions/mine' })
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
  .route({ method: 'GET', path: '/submissions' })
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
  .route({ method: 'POST', path: '/submissions', successStatus: 201 })
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
  .route({ method: 'GET', path: '/submissions/{id}' })
  .input(submissionIdParam)
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
  .route({ method: 'PATCH', path: '/submissions/{id}' })
  .input(submissionIdParam.merge(updateSubmissionSchema))
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
  .route({ method: 'POST', path: '/submissions/{id}/submit' })
  .input(submissionIdParam)
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
  .route({ method: 'DELETE', path: '/submissions/{id}' })
  .input(submissionIdParam)
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
  .route({ method: 'POST', path: '/submissions/{id}/withdraw' })
  .input(submissionIdParam)
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
  .route({ method: 'PATCH', path: '/submissions/{id}/status' })
  .input(submissionIdParam.merge(updateSubmissionStatusSchema))
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
  .route({ method: 'GET', path: '/submissions/{id}/history' })
  .input(submissionIdParam)
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
