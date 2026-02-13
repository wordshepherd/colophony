import { initTRPC, TRPCError } from '@trpc/server';
import type { TRPCContext } from './context.js';

export const t = initTRPC.context<TRPCContext>().create();

// ---------------------------------------------------------------------------
// Middleware
// ---------------------------------------------------------------------------

/** Requires an authenticated user (authContext populated by auth hook). */
const isAuthed = t.middleware(({ ctx, next }) => {
  if (!ctx.authContext) {
    throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Not authenticated' });
  }
  return next({ ctx: { ...ctx, authContext: ctx.authContext } });
});

/** Requires org context (X-Organization-Id resolved by org-context hook). */
const hasOrgContext = t.middleware(({ ctx, next }) => {
  if (!ctx.authContext) {
    throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Not authenticated' });
  }
  if (!ctx.authContext.orgId || !ctx.authContext.role) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: 'X-Organization-Id header is required',
    });
  }
  if (!ctx.dbTx) {
    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Database transaction not available',
    });
  }
  return next({
    ctx: {
      ...ctx,
      authContext: ctx.authContext as Required<
        Pick<NonNullable<typeof ctx.authContext>, 'orgId' | 'role'>
      > &
        NonNullable<typeof ctx.authContext>,
      dbTx: ctx.dbTx,
    },
  });
});

/** Requires ADMIN role within the current org context. */
const isAdmin = t.middleware(({ ctx, next }) => {
  if (!ctx.authContext) {
    throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Not authenticated' });
  }
  if (!ctx.authContext.orgId || !ctx.authContext.role) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: 'X-Organization-Id header is required',
    });
  }
  if (ctx.authContext.role !== 'ADMIN') {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'Admin role required',
    });
  }
  if (!ctx.dbTx) {
    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Database transaction not available',
    });
  }
  return next({
    ctx: {
      ...ctx,
      authContext: ctx.authContext as Required<
        Pick<NonNullable<typeof ctx.authContext>, 'orgId' | 'role'>
      > &
        NonNullable<typeof ctx.authContext>,
      dbTx: ctx.dbTx,
    },
  });
});

// ---------------------------------------------------------------------------
// Procedure builders
// ---------------------------------------------------------------------------

export const publicProcedure = t.procedure;
export const authedProcedure = t.procedure.use(isAuthed);
export const orgProcedure = t.procedure.use(hasOrgContext);
export const adminProcedure = t.procedure.use(isAdmin);
export const createRouter = t.router;
export const mergeRouters = t.mergeRouters;
