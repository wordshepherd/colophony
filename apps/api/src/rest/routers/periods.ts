import {
  listSubmissionPeriodsSchema,
  createSubmissionPeriodSchema,
  updateSubmissionPeriodSchema,
  idParamSchema,
  submissionPeriodSchema,
  paginatedResponseSchema,
  successResponseSchema,
} from '@colophony/types';
import { restPaginationQuery } from '@colophony/api-contracts';
import {
  periodService,
  PeriodNotFoundError,
} from '../../services/period.service.js';
import { toServiceContext } from '../../services/context.js';
import { mapServiceError } from '../error-mapper.js';
import { orgProcedure, editorProcedure, requireScopes } from '../context.js';

// ---------------------------------------------------------------------------
// Query schemas — override page/limit with z.coerce for REST query strings
// ---------------------------------------------------------------------------

const paginatedPeriodsSchema = paginatedResponseSchema(submissionPeriodSchema);

const restListPeriodsQuery = listSubmissionPeriodsSchema
  .omit({ page: true, limit: true })
  .merge(restPaginationQuery);

// ---------------------------------------------------------------------------
// Period routes
// ---------------------------------------------------------------------------

const list = orgProcedure
  .use(requireScopes('periods:read'))
  .route({
    method: 'GET',
    path: '/periods',
    summary: 'List submission periods',
    description:
      'Returns a paginated list of submission periods in the organization.',
    operationId: 'listPeriods',
    tags: ['Periods'],
  })
  .input(restListPeriodsQuery)
  .output(paginatedPeriodsSchema)
  .handler(async ({ input, context }) => {
    return periodService.list(context.dbTx, input);
  });

const create = editorProcedure
  .use(requireScopes('periods:write'))
  .route({
    method: 'POST',
    path: '/periods',
    successStatus: 201,
    summary: 'Create a submission period',
    description:
      'Create a new submission period — a time window during which submissions are accepted.',
    operationId: 'createPeriod',
    tags: ['Periods'],
  })
  .input(createSubmissionPeriodSchema)
  .output(submissionPeriodSchema)
  .handler(async ({ input, context }) => {
    try {
      return await periodService.createWithAudit(
        toServiceContext(context),
        input,
      );
    } catch (e) {
      mapServiceError(e);
    }
  });

const get = orgProcedure
  .use(requireScopes('periods:read'))
  .route({
    method: 'GET',
    path: '/periods/{id}',
    summary: 'Get a submission period',
    description: 'Retrieve a submission period by ID.',
    operationId: 'getPeriod',
    tags: ['Periods'],
  })
  .input(idParamSchema)
  .output(submissionPeriodSchema)
  .handler(async ({ input, context }) => {
    try {
      const period = await periodService.getById(context.dbTx, input.id);
      if (!period) throw new PeriodNotFoundError(input.id);
      return period;
    } catch (e) {
      mapServiceError(e);
    }
  });

const update = editorProcedure
  .use(requireScopes('periods:write'))
  .route({
    method: 'PATCH',
    path: '/periods/{id}',
    summary: 'Update a submission period',
    description: 'Update a submission period by ID.',
    operationId: 'updatePeriod',
    tags: ['Periods'],
  })
  .input(idParamSchema.merge(updateSubmissionPeriodSchema))
  .output(submissionPeriodSchema)
  .handler(async ({ input, context }) => {
    const { id, ...data } = input;
    try {
      return await periodService.updateWithAudit(
        toServiceContext(context),
        id,
        data,
      );
    } catch (e) {
      mapServiceError(e);
    }
  });

const del = editorProcedure
  .use(requireScopes('periods:write'))
  .route({
    method: 'DELETE',
    path: '/periods/{id}',
    summary: 'Delete a submission period',
    description:
      'Delete a submission period. Fails if the period has submissions.',
    operationId: 'deletePeriod',
    tags: ['Periods'],
  })
  .input(idParamSchema)
  .output(successResponseSchema)
  .handler(async ({ input, context }) => {
    try {
      return await periodService.deleteWithAudit(
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

export const periodsRouter = {
  list,
  create,
  get,
  update,
  delete: del,
};
