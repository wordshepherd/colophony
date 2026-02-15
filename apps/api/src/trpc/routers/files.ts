import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { AuditActions, AuditResources } from '@colophony/types';
import { orgProcedure, createRouter } from '../init.js';
import { submissionService } from '../../services/submission.service.js';
import { fileService } from '../../services/file.service.js';
import {
  createS3Client,
  getPresignedDownloadUrl,
  deleteS3Object,
} from '../../services/s3.js';
import { validateEnv } from '../../config/env.js';

// Lazily create S3 client (avoid creating at module load for tests)
let s3ClientInstance: ReturnType<typeof createS3Client> | null = null;

function getS3Client() {
  if (!s3ClientInstance) {
    const env = validateEnv();
    s3ClientInstance = createS3Client(env);
  }
  return s3ClientInstance;
}

function getEnvConfig() {
  return validateEnv();
}

function assertOwnerOrEditor(
  submitterId: string,
  userId: string,
  role: string,
): void {
  if (submitterId !== userId && role !== 'ADMIN' && role !== 'EDITOR') {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'You do not have access to this submission',
    });
  }
}

export const filesRouter = createRouter({
  /** List files for a submission — owner or editor/admin. */
  listBySubmission: orgProcedure
    .input(z.object({ submissionId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const submission = await submissionService.getById(
        ctx.dbTx,
        input.submissionId,
      );
      if (!submission) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Submission not found',
        });
      }
      assertOwnerOrEditor(
        submission.submitterId,
        ctx.authContext.userId,
        ctx.authContext.role,
      );
      return fileService.listBySubmission(ctx.dbTx, input.submissionId);
    }),

  /** Get a presigned download URL for a file — owner or editor/admin, CLEAN only. */
  getDownloadUrl: orgProcedure
    .input(z.object({ fileId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const file = await fileService.getById(ctx.dbTx, input.fileId);
      if (!file) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'File not found',
        });
      }

      // Check access via submission
      const submission = await submissionService.getById(
        ctx.dbTx,
        file.submissionId,
      );
      if (!submission) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Submission not found',
        });
      }
      assertOwnerOrEditor(
        submission.submitterId,
        ctx.authContext.userId,
        ctx.authContext.role,
      );

      if (file.scanStatus !== 'CLEAN') {
        throw new TRPCError({
          code: 'PRECONDITION_FAILED',
          message: 'File has not passed virus scan',
        });
      }

      const env = getEnvConfig();
      const url = await getPresignedDownloadUrl(
        getS3Client(),
        env.S3_BUCKET,
        file.storageKey,
      );
      return { url, filename: file.filename, mimeType: file.mimeType };
    }),

  /** Delete a file — submission owner only, DRAFT only. */
  delete: orgProcedure
    .input(z.object({ fileId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const file = await fileService.getById(ctx.dbTx, input.fileId);
      if (!file) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'File not found',
        });
      }

      // Check ownership via submission
      const submission = await submissionService.getById(
        ctx.dbTx,
        file.submissionId,
      );
      if (!submission) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Submission not found',
        });
      }
      if (submission.submitterId !== ctx.authContext.userId) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Only the submitter can delete files',
        });
      }
      if (submission.status !== 'DRAFT') {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Files can only be deleted from DRAFT submissions',
        });
      }

      // Delete DB record
      const deleted = await fileService.delete(ctx.dbTx, input.fileId);
      if (!deleted) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'File not found',
        });
      }

      await ctx.audit({
        action: AuditActions.FILE_DELETED,
        resource: AuditResources.FILE,
        resourceId: input.fileId,
        newValue: {
          filename: file.filename,
          submissionId: file.submissionId,
        },
      });

      // Delete from correct S3 bucket based on scan status (best-effort)
      try {
        const env = getEnvConfig();
        const bucket =
          file.scanStatus === 'CLEAN'
            ? env.S3_BUCKET
            : env.S3_QUARANTINE_BUCKET;
        await deleteS3Object(getS3Client(), bucket, file.storageKey);
      } catch {
        // Log but don't fail — orphaned S3 objects can be cleaned up
        // by a periodic garbage collection job
        ctx
          .audit({
            action: AuditActions.FILE_DELETED,
            resource: AuditResources.FILE,
            resourceId: input.fileId,
            newValue: { s3DeleteFailed: true, storageKey: file.storageKey },
          })
          .catch(() => {});
      }

      return { success: true };
    }),
});
