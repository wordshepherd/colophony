import {
  createManuscriptSchema,
  updateManuscriptSchema,
  listManuscriptsSchema,
} from '@colophony/types';
import { builder } from '../builder.js';
import { requireUserContext, requireScopes } from '../guards.js';
import { toUserServiceContext } from '../../services/context.js';
import {
  manuscriptService,
  ManuscriptNotFoundError,
} from '../../services/manuscript.service.js';
import { mapServiceError } from '../error-mapper.js';
import { ManuscriptType, ManuscriptVersionType } from '../types/manuscript.js';
import { SuccessPayload } from '../types/payloads.js';

// ---------------------------------------------------------------------------
// Query fields
// ---------------------------------------------------------------------------

builder.queryFields((t) => ({
  manuscripts: t.field({
    type: [ManuscriptType],
    description: 'List manuscripts owned by the authenticated user.',
    args: {
      search: t.arg.string({ description: 'Search by title.' }),
      page: t.arg.int({ defaultValue: 1, description: 'Page number.' }),
      limit: t.arg.int({ defaultValue: 20, description: 'Items per page.' }),
    },
    resolve: async (_root, args, ctx) => {
      const userCtx = requireUserContext(ctx);
      await requireScopes(ctx, 'manuscripts:read');
      try {
        const input = listManuscriptsSchema.parse({
          search: args.search ?? undefined,
          page: args.page ?? 1,
          limit: args.limit ?? 20,
        });
        const result = await manuscriptService.list(
          userCtx.dbTx,
          userCtx.authContext.userId,
          input,
        );
        return result.items;
      } catch (e) {
        mapServiceError(e);
      }
    },
  }),

  manuscript: t.field({
    type: ManuscriptType,
    nullable: true,
    description: 'Get a manuscript by ID.',
    args: {
      id: t.arg.string({ required: true, description: 'Manuscript ID.' }),
    },
    resolve: async (_root, args, ctx) => {
      const userCtx = requireUserContext(ctx);
      await requireScopes(ctx, 'manuscripts:read');
      try {
        return await manuscriptService.getById(userCtx.dbTx, args.id);
      } catch (e) {
        mapServiceError(e);
      }
    },
  }),

  manuscriptVersions: t.field({
    type: [ManuscriptVersionType],
    description: 'List versions of a manuscript.',
    args: {
      manuscriptId: t.arg.string({
        required: true,
        description: 'Manuscript ID.',
      }),
    },
    resolve: async (_root, args, ctx) => {
      const userCtx = requireUserContext(ctx);
      await requireScopes(ctx, 'manuscripts:read');
      try {
        const manuscript = await manuscriptService.getById(
          userCtx.dbTx,
          args.manuscriptId,
        );
        if (!manuscript) throw new ManuscriptNotFoundError(args.manuscriptId);
        return await manuscriptService.listVersions(
          userCtx.dbTx,
          args.manuscriptId,
        );
      } catch (e) {
        mapServiceError(e);
      }
    },
  }),
}));

// ---------------------------------------------------------------------------
// Mutation fields
// ---------------------------------------------------------------------------

builder.mutationFields((t) => ({
  createManuscript: t.field({
    type: ManuscriptType,
    description: 'Create a new manuscript with an initial version.',
    args: {
      title: t.arg.string({ required: true, description: 'Manuscript title.' }),
      description: t.arg.string({ description: 'Optional description.' }),
    },
    resolve: async (_root, args, ctx) => {
      const userCtx = requireUserContext(ctx);
      await requireScopes(ctx, 'manuscripts:write');
      try {
        const input = createManuscriptSchema.parse({
          title: args.title,
          description: args.description ?? undefined,
        });
        return await manuscriptService.createWithAudit(
          toUserServiceContext(userCtx),
          input,
        );
      } catch (e) {
        mapServiceError(e);
      }
    },
  }),

  updateManuscript: t.field({
    type: ManuscriptType,
    description: 'Update a manuscript.',
    args: {
      id: t.arg.string({ required: true, description: 'Manuscript ID.' }),
      title: t.arg.string({ description: 'New title.' }),
      description: t.arg.string({ description: 'New description.' }),
    },
    resolve: async (_root, args, ctx) => {
      const userCtx = requireUserContext(ctx);
      await requireScopes(ctx, 'manuscripts:write');
      try {
        const input = updateManuscriptSchema.parse({
          title: args.title ?? undefined,
          description: args.description,
        });
        return await manuscriptService.updateWithAudit(
          toUserServiceContext(userCtx),
          args.id,
          input,
        );
      } catch (e) {
        mapServiceError(e);
      }
    },
  }),

  deleteManuscript: t.field({
    type: SuccessPayload,
    description: 'Delete a manuscript and all its versions and files.',
    args: {
      id: t.arg.string({ required: true, description: 'Manuscript ID.' }),
    },
    resolve: async (_root, args, ctx) => {
      const userCtx = requireUserContext(ctx);
      await requireScopes(ctx, 'manuscripts:write');
      try {
        await manuscriptService.deleteWithAudit(
          toUserServiceContext(userCtx),
          args.id,
        );
        return { success: true as const };
      } catch (e) {
        mapServiceError(e);
      }
    },
  }),

  createManuscriptVersion: t.field({
    type: ManuscriptVersionType,
    description: 'Create a new version of a manuscript.',
    args: {
      manuscriptId: t.arg.string({
        required: true,
        description: 'Manuscript ID.',
      }),
      label: t.arg.string({ description: 'Optional version label.' }),
    },
    resolve: async (_root, args, ctx) => {
      const userCtx = requireUserContext(ctx);
      await requireScopes(ctx, 'manuscripts:write');
      try {
        return await manuscriptService.createVersionWithAudit(
          toUserServiceContext(userCtx),
          args.manuscriptId,
          args.label ?? undefined,
        );
      } catch (e) {
        mapServiceError(e);
      }
    },
  }),
}));
