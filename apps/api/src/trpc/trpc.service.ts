import { initTRPC, TRPCError } from '@trpc/server';
import { withOrgContext } from '@prospector/db';
import type { Context, AuthedContext, OrgContext } from './trpc.context';

/**
 * Initialize tRPC with our context type.
 * This is the entry point for all tRPC functionality.
 */
const t = initTRPC.context<Context>().create({
  errorFormatter({ shape, error: _error }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        // Add custom error data here if needed
      },
    };
  },
});

/**
 * Router and procedure builders
 */
export const router = t.router;
export const publicProcedure = t.procedure;
export const middleware = t.middleware;
export const mergeRouters = t.mergeRouters;

/**
 * Middleware: Validates that the user is authenticated.
 * Sets user in context from JWT payload (extracted by auth guard).
 */
const isAuthed = middleware(({ ctx, next }) => {
  if (!ctx.user) {
    throw new TRPCError({
      code: 'UNAUTHORIZED',
      message: 'You must be logged in to access this resource',
    });
  }

  return next({
    ctx: ctx as AuthedContext,
  });
});

/**
 * Middleware: Validates organization context and wraps in RLS transaction.
 * CRITICAL: This is where Row-Level Security is enforced.
 */
const withOrg = middleware(async ({ ctx, next }) => {
  const authedCtx = ctx as AuthedContext;

  if (!authedCtx.org) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: 'Organization context is required',
    });
  }

  // Execute the procedure within an RLS transaction context
  return withOrgContext(authedCtx.org.id, authedCtx.user.userId, async (tx) => {
    return next({
      ctx: {
        ...authedCtx,
        prisma: tx,
      } as OrgContext,
    });
  });
});

/**
 * Middleware: Validates that the user has admin role in the organization.
 */
const isOrgAdmin = middleware(({ ctx, next }) => {
  const orgCtx = ctx as OrgContext;

  if (orgCtx.org.role !== 'ADMIN') {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'Admin access required',
    });
  }

  return next({ ctx: orgCtx });
});

/**
 * Middleware: Validates that the user has editor or admin role.
 */
const isOrgEditor = middleware(({ ctx, next }) => {
  const orgCtx = ctx as OrgContext;

  if (orgCtx.org.role !== 'ADMIN' && orgCtx.org.role !== 'EDITOR') {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'Editor access required',
    });
  }

  return next({ ctx: orgCtx });
});

/**
 * Procedure types:
 *
 * - publicProcedure: No authentication required
 * - authedProcedure: User must be logged in
 * - orgProcedure: User must be logged in and have org context (RLS enforced)
 * - orgAdminProcedure: User must be org admin
 * - orgEditorProcedure: User must be org editor or admin
 */
export const authedProcedure = publicProcedure.use(isAuthed);
export const orgProcedure = authedProcedure.use(withOrg);
export const orgAdminProcedure = orgProcedure.use(isOrgAdmin);
export const orgEditorProcedure = orgProcedure.use(isOrgEditor);
