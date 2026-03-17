import { z } from 'zod';
import {
  createIssueSchema,
  updateIssueSchema,
  listIssuesSchema,
  addIssueItemSchema,
  addIssueSectionSchema,
  reorderItemsSchema,
  issueSchema,
  issueSectionSchema,
  issueItemSchema,
  idParamSchema,
  paginatedResponseSchema,
} from '@colophony/types';
import {
  orgProcedure,
  adminProcedure,
  createRouter,
  requireScopes,
} from '../init.js';
import {
  issueService,
  IssueNotFoundError,
} from '../../services/issue.service.js';
import { toServiceContext } from '../../services/context.js';
import { mapServiceError } from '../error-mapper.js';

export const issuesRouter = createRouter({
  /** List issues in the org. */
  list: orgProcedure
    .use(requireScopes('issues:read'))
    .input(listIssuesSchema)
    .output(paginatedResponseSchema(issueSchema))
    .query(async ({ ctx, input }) => {
      return issueService.list(ctx.dbTx, input, ctx.authContext.orgId);
    }),

  /** Get issue by ID. */
  getById: orgProcedure
    .use(requireScopes('issues:read'))
    .input(idParamSchema)
    .output(issueSchema)
    .query(async ({ ctx, input }) => {
      try {
        const issue = await issueService.getById(
          ctx.dbTx,
          input.id,
          ctx.authContext.orgId,
        );
        if (!issue) throw new IssueNotFoundError(input.id);
        return issue;
      } catch (e) {
        mapServiceError(e);
      }
    }),

  /** Get items in an issue. */
  getItems: orgProcedure
    .use(requireScopes('issues:read'))
    .input(idParamSchema)
    .output(z.array(issueItemSchema))
    .query(async ({ ctx, input }) => {
      return issueService.getItems(ctx.dbTx, input.id, ctx.authContext.orgId);
    }),

  /** Get sections in an issue. */
  getSections: orgProcedure
    .use(requireScopes('issues:read'))
    .input(idParamSchema)
    .output(z.array(issueSectionSchema))
    .query(async ({ ctx, input }) => {
      return issueService.getSections(
        ctx.dbTx,
        input.id,
        ctx.authContext.orgId,
      );
    }),

  /** Create an issue (admin only). */
  create: adminProcedure
    .use(requireScopes('issues:write'))
    .input(createIssueSchema)
    .output(issueSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        return await issueService.createWithAudit(toServiceContext(ctx), input);
      } catch (e) {
        mapServiceError(e);
      }
    }),

  /** Update an issue (admin only). */
  update: adminProcedure
    .use(requireScopes('issues:write'))
    .input(idParamSchema.merge(updateIssueSchema))
    .output(issueSchema)
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      try {
        return await issueService.updateWithAudit(
          toServiceContext(ctx),
          id,
          data,
        );
      } catch (e) {
        mapServiceError(e);
      }
    }),

  /** Publish an issue (admin only). */
  publish: adminProcedure
    .use(requireScopes('issues:write'))
    .input(idParamSchema)
    .output(issueSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        return await issueService.publishWithAudit(
          toServiceContext(ctx),
          input.id,
        );
      } catch (e) {
        mapServiceError(e);
      }
    }),

  /** Archive an issue (admin only). */
  archive: adminProcedure
    .use(requireScopes('issues:write'))
    .input(idParamSchema)
    .output(issueSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        return await issueService.archiveWithAudit(
          toServiceContext(ctx),
          input.id,
        );
      } catch (e) {
        mapServiceError(e);
      }
    }),

  /** Add an item to an issue. */
  addItem: orgProcedure
    .use(requireScopes('issues:write'))
    .input(idParamSchema.merge(addIssueItemSchema))
    .output(issueItemSchema)
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      try {
        return await issueService.addItemWithAudit(
          toServiceContext(ctx),
          id,
          data,
        );
      } catch (e) {
        mapServiceError(e);
      }
    }),

  /** Remove an item from an issue. */
  removeItem: orgProcedure
    .use(requireScopes('issues:write'))
    .input(z.object({ id: z.string().uuid(), itemId: z.string().uuid() }))
    .output(issueItemSchema.nullable())
    .mutation(async ({ ctx, input }) => {
      try {
        return await issueService.removeItemWithAudit(
          toServiceContext(ctx),
          input.id,
          input.itemId,
        );
      } catch (e) {
        mapServiceError(e);
      }
    }),

  /** Reorder items in an issue. */
  reorderItems: adminProcedure
    .use(requireScopes('issues:write'))
    .input(idParamSchema.merge(reorderItemsSchema))
    .output(z.array(issueItemSchema))
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      return issueService.reorderItems(
        ctx.dbTx,
        id,
        data,
        ctx.authContext.orgId,
      );
    }),

  /** Add a section to an issue. */
  addSection: adminProcedure
    .use(requireScopes('issues:write'))
    .input(idParamSchema.merge(addIssueSectionSchema))
    .output(issueSectionSchema)
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      try {
        return await issueService.addSection(
          ctx.dbTx,
          id,
          data,
          ctx.authContext.orgId,
        );
      } catch (e) {
        mapServiceError(e);
      }
    }),

  /** Remove a section from an issue. */
  removeSection: adminProcedure
    .use(requireScopes('issues:write'))
    .input(z.object({ id: z.string().uuid(), sectionId: z.string().uuid() }))
    .output(issueSectionSchema.nullable())
    .mutation(async ({ ctx, input }) => {
      return issueService.removeSection(
        ctx.dbTx,
        input.id,
        input.sectionId,
        ctx.authContext.orgId,
      );
    }),
});
