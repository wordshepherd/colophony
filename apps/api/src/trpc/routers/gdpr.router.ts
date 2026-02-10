import { TRPCError } from '@trpc/server';
import { z } from 'zod';

import { router, authedProcedure } from '../trpc.service';
import { trpcRegistry } from '../trpc.registry';

/**
 * GDPR router handles all GDPR-related operations for users.
 *
 * These endpoints allow users to exercise their GDPR rights:
 * - Right of access (Article 15)
 * - Right to erasure (Article 17)
 * - Right to data portability (Article 20)
 */
export const gdprRouter = router({
  /**
   * Create a Data Subject Access Request (DSAR)
   *
   * Users can request to access or delete their data.
   * Returns a request ID and the due date (30 days from now per GDPR).
   */
  createDsarRequest: authedProcedure
    .input(
      z.object({
        type: z.enum(['ACCESS', 'ERASURE', 'RECTIFICATION', 'PORTABILITY']),
        notes: z.string().optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const result = await trpcRegistry.gdprService.createDsarRequest({
        userId: ctx.user.userId,
        type: input.type,
        notes: input.notes,
      });

      return {
        id: result.id,
        dueAt: result.dueAt,
        message: `Your ${input.type.toLowerCase()} request has been submitted. We will process it within 30 days.`,
      };
    }),

  /**
   * List user's DSAR requests
   */
  listDsarRequests: authedProcedure.query(async ({ ctx }) => {
    const requests = await trpcRegistry.gdprService.getUserDsarRequests(
      ctx.user.userId,
    );

    return requests.map((r: (typeof requests)[number]) => ({
      id: r.id,
      type: r.type,
      status: r.status,
      requestedAt: r.requestedAt,
      dueAt: r.dueAt,
      completedAt: r.completedAt,
      notes: r.notes,
    }));
  }),

  /**
   * Get a specific DSAR request
   */
  getDsarRequest: authedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ input, ctx }) => {
      const request = await trpcRegistry.gdprService.getDsarRequest(
        input.id,
        ctx.user.userId,
      );

      if (!request) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Request not found',
        });
      }

      return {
        id: request.id,
        type: request.type,
        status: request.status,
        requestedAt: request.requestedAt,
        dueAt: request.dueAt,
        completedAt: request.completedAt,
        notes: request.notes,
      };
    }),

  /**
   * Export user data
   *
   * Returns all user data as a JSON object.
   * For the ZIP export, use the downloadExport endpoint.
   */
  exportData: authedProcedure.query(async ({ ctx }) => {
    const data = await trpcRegistry.gdprService.exportUserData(ctx.user.userId);
    return data;
  }),

  /**
   * Download user data as ZIP
   *
   * Returns a base64-encoded ZIP file containing:
   * - profile.json
   * - submissions.json
   * - payments.json
   * - audit-log.json
   * - consents.json
   * - organizations.json
   * - metadata.json
   */
  downloadExport: authedProcedure.mutation(async ({ ctx }) => {
    const zipBuffer = await trpcRegistry.gdprService.exportUserDataAsZip(
      ctx.user.userId,
    );

    return {
      filename: `gdpr-export-${ctx.user.userId}-${new Date().toISOString().split('T')[0]}.zip`,
      contentType: 'application/zip',
      data: zipBuffer.toString('base64'),
    };
  }),

  /**
   * Request account deletion
   *
   * Creates an erasure DSAR request.
   * The actual deletion is processed separately (may require confirmation).
   */
  requestDeletion: authedProcedure
    .input(
      z.object({
        confirmation: z.literal('DELETE_MY_ACCOUNT'),
        reason: z.string().optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const result = await trpcRegistry.gdprService.createDsarRequest({
        userId: ctx.user.userId,
        type: 'ERASURE',
        notes: input.reason
          ? `Deletion requested. Reason: ${input.reason}`
          : 'Deletion requested by user',
      });

      return {
        id: result.id,
        dueAt: result.dueAt,
        message:
          'Your account deletion request has been submitted. Your data will be deleted within 30 days. You will receive a confirmation email when complete.',
      };
    }),
});

export type GdprRouter = typeof gdprRouter;
