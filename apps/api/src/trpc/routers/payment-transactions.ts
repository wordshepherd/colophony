import {
  paymentTransactionSchema,
  paymentTransactionListItemSchema,
  createPaymentTransactionSchema,
  updatePaymentTransactionSchema,
  listPaymentTransactionsSchema,
  transitionPaymentTransactionStatusSchema,
  revenueSummarySchema,
  idParamSchema,
  paginatedResponseSchema,
} from '@colophony/types';
import { businessOpsProcedure, createRouter, requireScopes } from '../init.js';
import { revenueService } from '../../services/revenue.service.js';
import { toServiceContext } from '../../services/context.js';
import { mapServiceError } from '../error-mapper.js';

export const paymentTransactionsRouter = createRouter({
  /** List payment transactions for the current org (with contributor names). */
  list: businessOpsProcedure
    .use(requireScopes('payment-transactions:read'))
    .input(listPaymentTransactionsSchema)
    .output(paginatedResponseSchema(paymentTransactionListItemSchema))
    .query(async ({ ctx, input }) => {
      return revenueService.list(ctx.dbTx, input, ctx.authContext.orgId);
    }),

  /** Get a payment transaction by ID. */
  getById: businessOpsProcedure
    .use(requireScopes('payment-transactions:read'))
    .input(idParamSchema)
    .output(paymentTransactionSchema)
    .query(async ({ ctx, input }) => {
      try {
        const transaction = await revenueService.getById(
          ctx.dbTx,
          input.id,
          ctx.authContext.orgId,
        );
        if (!transaction) {
          const { PaymentTransactionNotFoundError } =
            await import('../../services/revenue.service.js');
          throw new PaymentTransactionNotFoundError(input.id);
        }
        return transaction;
      } catch (e) {
        mapServiceError(e);
      }
    }),

  /** Get revenue summary for the current org. */
  summary: businessOpsProcedure
    .use(requireScopes('payment-transactions:read'))
    .output(revenueSummarySchema)
    .query(async ({ ctx }) => {
      return revenueService.getSummary(ctx.dbTx, ctx.authContext.orgId);
    }),

  /** Create a new payment transaction. */
  create: businessOpsProcedure
    .use(requireScopes('payment-transactions:write'))
    .input(createPaymentTransactionSchema)
    .output(paymentTransactionSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        return await revenueService.createWithAudit(
          toServiceContext(ctx),
          input,
        );
      } catch (e) {
        mapServiceError(e);
      }
    }),

  /** Update a payment transaction (description/metadata only). */
  update: businessOpsProcedure
    .use(requireScopes('payment-transactions:write'))
    .input(updatePaymentTransactionSchema)
    .output(paymentTransactionSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        return await revenueService.updateWithAudit(
          toServiceContext(ctx),
          input,
        );
      } catch (e) {
        mapServiceError(e);
      }
    }),

  /** Transition a payment transaction to a new status. */
  transitionStatus: businessOpsProcedure
    .use(requireScopes('payment-transactions:write'))
    .input(transitionPaymentTransactionStatusSchema)
    .output(paymentTransactionSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        return await revenueService.transitionStatusWithAudit(
          toServiceContext(ctx),
          input,
        );
      } catch (e) {
        mapServiceError(e);
      }
    }),

  /** Delete a payment transaction. */
  delete: businessOpsProcedure
    .use(requireScopes('payment-transactions:write'))
    .input(idParamSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        await revenueService.deleteWithAudit(toServiceContext(ctx), input.id);
        return { success: true as const };
      } catch (e) {
        mapServiceError(e);
      }
    }),
});
