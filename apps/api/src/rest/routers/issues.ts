import { z } from 'zod';
import {
  listIssuesSchema,
  createIssueSchema,
  updateIssueSchema,
  addIssueItemSchema,
  addIssueSectionSchema,
  reorderItemsSchema,
  idParamSchema,
  issueSchema,
  issueItemSchema,
  issueSectionSchema,
  paginatedResponseSchema,
} from '@colophony/types';
import { restPaginationQuery } from '@colophony/api-contracts';
import {
  issueService,
  IssueNotFoundError,
} from '../../services/issue.service.js';
import { toServiceContext } from '../../services/context.js';
import { mapServiceError } from '../error-mapper.js';
import { orgProcedure, adminProcedure, requireScopes } from '../context.js';

// ---------------------------------------------------------------------------
// Query schemas
// ---------------------------------------------------------------------------

const paginatedIssuesSchema = paginatedResponseSchema(issueSchema);

const restListQuery = listIssuesSchema
  .omit({ page: true, limit: true })
  .merge(restPaginationQuery);

// ---------------------------------------------------------------------------
// Issue routes
// ---------------------------------------------------------------------------

const list = orgProcedure
  .use(requireScopes('issues:read'))
  .route({
    method: 'GET',
    path: '/issues',
    summary: 'List issues',
    description: 'Returns a paginated list of issues in the organization.',
    operationId: 'listIssues',
    tags: ['Issues'],
  })
  .input(restListQuery)
  .output(paginatedIssuesSchema)
  .handler(async ({ input, context }) => {
    return issueService.list(context.dbTx, input, context.authContext.orgId);
  });

const get = orgProcedure
  .use(requireScopes('issues:read'))
  .route({
    method: 'GET',
    path: '/issues/{id}',
    summary: 'Get an issue',
    description: 'Retrieve an issue by ID.',
    operationId: 'getIssue',
    tags: ['Issues'],
  })
  .input(idParamSchema)
  .output(issueSchema)
  .handler(async ({ input, context }) => {
    try {
      const issue = await issueService.getById(
        context.dbTx,
        input.id,
        context.authContext.orgId,
      );
      if (!issue) throw new IssueNotFoundError(input.id);
      return issue;
    } catch (e) {
      mapServiceError(e);
    }
  });

const getItems = orgProcedure
  .use(requireScopes('issues:read'))
  .route({
    method: 'GET',
    path: '/issues/{id}/items',
    summary: 'Get items in an issue',
    description: 'Retrieve all items in an issue, ordered by sort order.',
    operationId: 'getIssueItems',
    tags: ['Issues'],
  })
  .input(idParamSchema)
  .output(z.array(issueItemSchema))
  .handler(async ({ input, context }) => {
    return issueService.getItems(
      context.dbTx,
      input.id,
      context.authContext.orgId,
    );
  });

const getSections = orgProcedure
  .use(requireScopes('issues:read'))
  .route({
    method: 'GET',
    path: '/issues/{id}/sections',
    summary: 'Get sections in an issue',
    description: 'Retrieve all sections in an issue.',
    operationId: 'getIssueSections',
    tags: ['Issues'],
  })
  .input(idParamSchema)
  .output(z.array(issueSectionSchema))
  .handler(async ({ input, context }) => {
    return issueService.getSections(
      context.dbTx,
      input.id,
      context.authContext.orgId,
    );
  });

const create = adminProcedure
  .use(requireScopes('issues:write'))
  .route({
    method: 'POST',
    path: '/issues',
    successStatus: 201,
    summary: 'Create an issue',
    description: 'Create a new issue for a publication.',
    operationId: 'createIssue',
    tags: ['Issues'],
  })
  .input(createIssueSchema)
  .output(issueSchema)
  .handler(async ({ input, context }) => {
    try {
      return await issueService.createWithAudit(
        toServiceContext(context),
        input,
      );
    } catch (e) {
      mapServiceError(e);
    }
  });

const update = adminProcedure
  .use(requireScopes('issues:write'))
  .route({
    method: 'PATCH',
    path: '/issues/{id}',
    summary: 'Update an issue',
    description: 'Update an existing issue.',
    operationId: 'updateIssue',
    tags: ['Issues'],
  })
  .input(idParamSchema.merge(updateIssueSchema))
  .output(issueSchema)
  .handler(async ({ input, context }) => {
    const { id, ...data } = input;
    try {
      return await issueService.updateWithAudit(
        toServiceContext(context),
        id,
        data,
      );
    } catch (e) {
      mapServiceError(e);
    }
  });

const publish = adminProcedure
  .use(requireScopes('issues:write'))
  .route({
    method: 'POST',
    path: '/issues/{id}/publish',
    summary: 'Publish an issue',
    description: 'Publish an issue, marking it as publicly available.',
    operationId: 'publishIssue',
    tags: ['Issues'],
  })
  .input(idParamSchema)
  .output(issueSchema)
  .handler(async ({ input, context }) => {
    try {
      return await issueService.publishWithAudit(
        toServiceContext(context),
        input.id,
      );
    } catch (e) {
      mapServiceError(e);
    }
  });

const archive = adminProcedure
  .use(requireScopes('issues:write'))
  .route({
    method: 'POST',
    path: '/issues/{id}/archive',
    summary: 'Archive an issue',
    description: 'Archive an issue.',
    operationId: 'archiveIssue',
    tags: ['Issues'],
  })
  .input(idParamSchema)
  .output(issueSchema)
  .handler(async ({ input, context }) => {
    try {
      return await issueService.archiveWithAudit(
        toServiceContext(context),
        input.id,
      );
    } catch (e) {
      mapServiceError(e);
    }
  });

const addItem = adminProcedure
  .use(requireScopes('issues:write'))
  .route({
    method: 'POST',
    path: '/issues/{id}/items',
    successStatus: 201,
    summary: 'Add item to issue',
    description: 'Add a pipeline item to an issue.',
    operationId: 'addIssueItem',
    tags: ['Issues'],
  })
  .input(idParamSchema.merge(addIssueItemSchema))
  .output(issueItemSchema)
  .handler(async ({ input, context }) => {
    const { id, ...data } = input;
    try {
      return await issueService.addItemWithAudit(
        toServiceContext(context),
        id,
        data,
      );
    } catch (e) {
      mapServiceError(e);
    }
  });

const removeItem = adminProcedure
  .use(requireScopes('issues:write'))
  .route({
    method: 'DELETE',
    path: '/issues/{id}/items/{itemId}',
    summary: 'Remove item from issue',
    description: 'Remove a pipeline item from an issue.',
    operationId: 'removeIssueItem',
    tags: ['Issues'],
  })
  .input(z.object({ id: z.string().uuid(), itemId: z.string().uuid() }))
  .output(issueItemSchema.nullable())
  .handler(async ({ input, context }) => {
    try {
      return await issueService.removeItemWithAudit(
        toServiceContext(context),
        input.id,
        input.itemId,
      );
    } catch (e) {
      mapServiceError(e);
    }
  });

const reorderItems = adminProcedure
  .use(requireScopes('issues:write'))
  .route({
    method: 'PUT',
    path: '/issues/{id}/items/reorder',
    summary: 'Reorder items',
    description: 'Reorder items within an issue.',
    operationId: 'reorderIssueItems',
    tags: ['Issues'],
  })
  .input(idParamSchema.merge(reorderItemsSchema))
  .output(z.array(issueItemSchema))
  .handler(async ({ input, context }) => {
    const { id, ...data } = input;
    return issueService.reorderItems(
      context.dbTx,
      id,
      data,
      context.authContext.orgId,
    );
  });

const addSection = adminProcedure
  .use(requireScopes('issues:write'))
  .route({
    method: 'POST',
    path: '/issues/{id}/sections',
    successStatus: 201,
    summary: 'Add section to issue',
    description: 'Add a section to an issue for grouping items.',
    operationId: 'addIssueSection',
    tags: ['Issues'],
  })
  .input(idParamSchema.merge(addIssueSectionSchema))
  .output(issueSectionSchema)
  .handler(async ({ input, context }) => {
    const { id, ...data } = input;
    try {
      return await issueService.addSection(
        context.dbTx,
        id,
        data,
        context.authContext.orgId,
      );
    } catch (e) {
      mapServiceError(e);
    }
  });

const removeSection = adminProcedure
  .use(requireScopes('issues:write'))
  .route({
    method: 'DELETE',
    path: '/issues/{id}/sections/{sectionId}',
    summary: 'Remove section from issue',
    description: 'Remove a section from an issue.',
    operationId: 'removeIssueSection',
    tags: ['Issues'],
  })
  .input(z.object({ id: z.string().uuid(), sectionId: z.string().uuid() }))
  .output(issueSectionSchema.nullable())
  .handler(async ({ input, context }) => {
    return issueService.removeSection(
      context.dbTx,
      input.id,
      input.sectionId,
      context.authContext.orgId,
    );
  });

// ---------------------------------------------------------------------------
// Assembled router
// ---------------------------------------------------------------------------

export const issuesRouter = {
  list,
  get,
  getItems,
  getSections,
  create,
  update,
  publish,
  archive,
  addItem,
  removeItem,
  reorderItems,
  addSection,
  removeSection,
};
