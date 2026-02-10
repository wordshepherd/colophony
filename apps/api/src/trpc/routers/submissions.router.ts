import { TRPCError } from '@trpc/server';
import { z } from 'zod';

import { router, orgProcedure, orgEditorProcedure } from '../trpc.service';
import { trpcRegistry } from '../trpc.registry';
import {
  createSubmissionSchema,
  updateSubmissionSchema,
  updateSubmissionStatusSchema,
  listSubmissionsSchema,
  isEditorAllowedTransition,
  isValidStatusTransition,
  type SubmissionStatus,
} from '@prospector/types';
import { AuditActions, AuditResources } from '../../modules/audit';

/**
 * Extract IP address from request
 */
function getIpAddress(req: Express.Request): string | undefined {
  const forwarded = (
    req as unknown as { headers: Record<string, string | string[]> }
  ).headers['x-forwarded-for'];
  if (typeof forwarded === 'string') {
    return forwarded.split(',')[0].trim();
  }
  if (Array.isArray(forwarded) && forwarded.length > 0) {
    return forwarded[0].trim();
  }
  return (req as unknown as { ip?: string }).ip ?? undefined;
}

/**
 * Extract user agent from request
 */
function getUserAgent(req: Express.Request): string | undefined {
  return (req as unknown as { headers: Record<string, string | string[]> })
    .headers['user-agent'] as string | undefined;
}

/**
 * Submissions router handles all submission-related operations.
 * All procedures use orgProcedure which enforces RLS via withOrgContext.
 */
export const submissionsRouter = router({
  /**
   * List submissions with filtering and pagination.
   * RLS automatically filters to current organization.
   */
  list: orgProcedure
    .input(listSubmissionsSchema)
    .query(async ({ input, ctx }) => {
      const { status, submissionPeriodId, search, page, limit } = input;

      const where: Record<string, unknown> = {};

      if (status) {
        where.status = status;
      }

      if (submissionPeriodId) {
        where.submissionPeriodId = submissionPeriodId;
      }

      // Note: Full-text search would use raw query with search_vector
      // For now, use simple LIKE on title
      if (search) {
        where.title = {
          contains: search,
          mode: 'insensitive',
        };
      }

      const [items, total] = await Promise.all([
        ctx.prisma.submission.findMany({
          where,
          skip: (page - 1) * limit,
          take: limit,
          orderBy: { createdAt: 'desc' },
          include: {
            submitter: {
              select: {
                id: true,
                email: true,
              },
            },
            _count: {
              select: { files: true },
            },
          },
        }),
        ctx.prisma.submission.count({ where }),
      ]);

      return {
        items,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      };
    }),

  /**
   * Get a single submission by ID.
   * RLS ensures user can only access submissions in their org.
   */
  getById: orgProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ input, ctx }) => {
      const submission = await ctx.prisma.submission.findUnique({
        where: { id: input.id },
        include: {
          submitter: {
            select: {
              id: true,
              email: true,
            },
          },
          files: true,
          history: {
            orderBy: { changedAt: 'desc' },
          },
          submissionPeriod: true,
        },
      });

      if (!submission) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Submission not found',
        });
      }

      return submission;
    }),

  /**
   * Create a new submission (as draft).
   */
  create: orgProcedure
    .input(createSubmissionSchema)
    .mutation(async ({ input, ctx }) => {
      const submission = await ctx.prisma.submission.create({
        data: {
          ...input,
          organizationId: ctx.org.id,
          submitterId: ctx.user.userId,
          status: 'DRAFT',
        },
      });

      // Record history
      await ctx.prisma.submissionHistory.create({
        data: {
          submissionId: submission.id,
          toStatus: 'DRAFT',
          changedBy: ctx.user.userId,
        },
      });

      // Audit log - submission created
      await trpcRegistry.auditService.logSafe({
        organizationId: ctx.org.id,
        actorId: ctx.user.userId,
        action: AuditActions.SUBMISSION_CREATED,
        resource: AuditResources.SUBMISSION,
        resourceId: submission.id,
        newValue: { title: input.title, status: 'DRAFT' },
        ipAddress: getIpAddress(ctx.req),
        userAgent: getUserAgent(ctx.req),
      });

      return submission;
    }),

  /**
   * Update a submission (only in DRAFT status).
   */
  update: orgProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        data: updateSubmissionSchema,
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const existing = await ctx.prisma.submission.findUnique({
        where: { id: input.id },
      });

      if (!existing) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Submission not found',
        });
      }

      if (existing.status !== 'DRAFT') {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Can only edit submissions in draft status',
        });
      }

      // Only submitter can edit their own submission
      if (existing.submitterId !== ctx.user.userId) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'You can only edit your own submissions',
        });
      }

      const updated = await ctx.prisma.submission.update({
        where: { id: input.id },
        data: input.data,
      });

      // Audit log - submission updated
      await trpcRegistry.auditService.logSafe({
        organizationId: ctx.org.id,
        actorId: ctx.user.userId,
        action: AuditActions.SUBMISSION_UPDATED,
        resource: AuditResources.SUBMISSION,
        resourceId: input.id,
        oldValue: { title: existing.title, content: existing.content },
        newValue: input.data,
        ipAddress: getIpAddress(ctx.req),
        userAgent: getUserAgent(ctx.req),
      });

      return updated;
    }),

  /**
   * Submit a draft submission.
   */
  submit: orgProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ input, ctx }) => {
      const existing = await ctx.prisma.submission.findUnique({
        where: { id: input.id },
        include: { files: true },
      });

      if (!existing) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Submission not found',
        });
      }

      if (existing.status !== 'DRAFT') {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Submission is not in draft status',
        });
      }

      // Check if any files are still being scanned
      const pendingScans = existing.files.some(
        (f: { scanStatus: string }) =>
          f.scanStatus === 'PENDING' || f.scanStatus === 'SCANNING',
      );

      if (pendingScans) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Files are still being scanned. Please wait.',
        });
      }

      // Check for infected files
      const infectedFiles = existing.files.some(
        (f: { scanStatus: string }) => f.scanStatus === 'INFECTED',
      );

      if (infectedFiles) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Cannot submit with infected files. Please remove them.',
        });
      }

      const submission = await ctx.prisma.submission.update({
        where: { id: input.id },
        data: {
          status: 'SUBMITTED',
          submittedAt: new Date(),
        },
      });

      // Record history
      await ctx.prisma.submissionHistory.create({
        data: {
          submissionId: submission.id,
          fromStatus: 'DRAFT',
          toStatus: 'SUBMITTED',
          changedBy: ctx.user.userId,
        },
      });

      // Audit log - submission submitted
      await trpcRegistry.auditService.logSafe({
        organizationId: ctx.org.id,
        actorId: ctx.user.userId,
        action: AuditActions.SUBMISSION_SUBMITTED,
        resource: AuditResources.SUBMISSION,
        resourceId: submission.id,
        oldValue: { status: 'DRAFT' },
        newValue: { status: 'SUBMITTED' },
        ipAddress: getIpAddress(ctx.req),
        userAgent: getUserAgent(ctx.req),
      });

      return submission;
    }),

  /**
   * Update submission status (editors/admins only).
   * Validates that the transition is allowed for editors.
   */
  updateStatus: orgEditorProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        data: updateSubmissionStatusSchema,
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const existing = await ctx.prisma.submission.findUnique({
        where: { id: input.id },
      });

      if (!existing) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Submission not found',
        });
      }

      const fromStatus = existing.status as SubmissionStatus;
      const toStatus = input.data.status;

      // Validate the status transition
      if (!isEditorAllowedTransition(fromStatus, toStatus)) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `Cannot transition from ${fromStatus} to ${toStatus}`,
        });
      }

      const submission = await ctx.prisma.submission.update({
        where: { id: input.id },
        data: {
          status: input.data.status,
        },
      });

      // Record history
      await ctx.prisma.submissionHistory.create({
        data: {
          submissionId: submission.id,
          fromStatus: existing.status,
          toStatus: input.data.status,
          changedBy: ctx.user.userId,
          comment: input.data.comment,
        },
      });

      // Audit log - status changed by editor
      await trpcRegistry.auditService.logSafe({
        organizationId: ctx.org.id,
        actorId: ctx.user.userId,
        action: AuditActions.SUBMISSION_STATUS_CHANGED,
        resource: AuditResources.SUBMISSION,
        resourceId: submission.id,
        oldValue: { status: fromStatus },
        newValue: { status: toStatus, comment: input.data.comment },
        ipAddress: getIpAddress(ctx.req),
        userAgent: getUserAgent(ctx.req),
      });

      return submission;
    }),

  /**
   * Withdraw a submission (submitter only).
   */
  withdraw: orgProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ input, ctx }) => {
      const existing = await ctx.prisma.submission.findUnique({
        where: { id: input.id },
      });

      if (!existing) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Submission not found',
        });
      }

      if (existing.submitterId !== ctx.user.userId) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'You can only withdraw your own submissions',
        });
      }

      const fromStatus = existing.status as SubmissionStatus;

      // Validate the withdrawal is allowed from this status
      if (!isValidStatusTransition(fromStatus, 'WITHDRAWN')) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `Cannot withdraw submission in ${fromStatus} status`,
        });
      }

      const submission = await ctx.prisma.submission.update({
        where: { id: input.id },
        data: { status: 'WITHDRAWN' },
      });

      await ctx.prisma.submissionHistory.create({
        data: {
          submissionId: submission.id,
          fromStatus: existing.status,
          toStatus: 'WITHDRAWN',
          changedBy: ctx.user.userId,
        },
      });

      // Audit log - submission withdrawn
      await trpcRegistry.auditService.logSafe({
        organizationId: ctx.org.id,
        actorId: ctx.user.userId,
        action: AuditActions.SUBMISSION_WITHDRAWN,
        resource: AuditResources.SUBMISSION,
        resourceId: submission.id,
        oldValue: { status: fromStatus },
        newValue: { status: 'WITHDRAWN' },
        ipAddress: getIpAddress(ctx.req),
        userAgent: getUserAgent(ctx.req),
      });

      return submission;
    }),

  /**
   * Delete a draft submission (submitter only).
   * Only drafts can be deleted - submitted items must be withdrawn.
   */
  delete: orgProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ input, ctx }) => {
      const existing = await ctx.prisma.submission.findUnique({
        where: { id: input.id },
      });

      if (!existing) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Submission not found',
        });
      }

      if (existing.submitterId !== ctx.user.userId) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'You can only delete your own submissions',
        });
      }

      if (existing.status !== 'DRAFT') {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message:
            'Only draft submissions can be deleted. Use withdraw for submitted items.',
        });
      }

      // Delete the submission (cascade will delete files and history)
      await ctx.prisma.submission.delete({
        where: { id: input.id },
      });

      // Audit log - submission deleted
      await trpcRegistry.auditService.logSafe({
        organizationId: ctx.org.id,
        actorId: ctx.user.userId,
        action: AuditActions.SUBMISSION_DELETED,
        resource: AuditResources.SUBMISSION,
        resourceId: input.id,
        oldValue: { title: existing.title, status: existing.status },
        ipAddress: getIpAddress(ctx.req),
        userAgent: getUserAgent(ctx.req),
      });

      return { success: true };
    }),

  /**
   * Get current user's submissions (for submitters to see their own work).
   */
  mySubmissions: orgProcedure
    .input(
      z.object({
        status: z
          .enum([
            'DRAFT',
            'SUBMITTED',
            'UNDER_REVIEW',
            'ACCEPTED',
            'REJECTED',
            'HOLD',
            'WITHDRAWN',
          ])
          .optional(),
        page: z.number().int().min(1).default(1),
        limit: z.number().int().min(1).max(100).default(20),
      }),
    )
    .query(async ({ input, ctx }) => {
      const { status, page, limit } = input;

      const where: Record<string, unknown> = {
        submitterId: ctx.user.userId,
      };

      if (status) {
        where.status = status;
      }

      const [items, total] = await Promise.all([
        ctx.prisma.submission.findMany({
          where,
          skip: (page - 1) * limit,
          take: limit,
          orderBy: { createdAt: 'desc' },
          include: {
            _count: {
              select: { files: true },
            },
            submissionPeriod: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        }),
        ctx.prisma.submission.count({ where }),
      ]);

      return {
        items,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      };
    }),

  /**
   * Get submission history.
   */
  getHistory: orgProcedure
    .input(z.object({ submissionId: z.string().uuid() }))
    .query(async ({ input, ctx }) => {
      // First verify the submission exists and user can access it
      const submission = await ctx.prisma.submission.findUnique({
        where: { id: input.submissionId },
      });

      if (!submission) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Submission not found',
        });
      }

      return ctx.prisma.submissionHistory.findMany({
        where: { submissionId: input.submissionId },
        orderBy: { changedAt: 'desc' },
      });
    }),
});

export type SubmissionsRouter = typeof submissionsRouter;
