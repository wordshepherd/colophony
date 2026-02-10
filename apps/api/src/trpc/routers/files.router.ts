import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { router, orgProcedure } from '../trpc.service';
import { trpcRegistry } from '../trpc.registry';
import {
  initiateUploadSchema,
  deleteFileSchema,
  isAllowedMimeType,
  sanitizeFilename,
  MAX_FILE_SIZE,
  MAX_FILES_PER_SUBMISSION,
  MAX_TOTAL_UPLOAD_SIZE,
} from '@prospector/types';

/**
 * Files router handles file upload and management for submissions.
 * Files are uploaded through tusd for resumable uploads.
 */
export const filesRouter = router({
  /**
   * Initiate a file upload.
   * Returns an upload URL for the tusd server.
   */
  initiateUpload: orgProcedure
    .input(initiateUploadSchema)
    .mutation(async ({ input, ctx }) => {
      // Verify submission exists and belongs to org
      const submission = await ctx.prisma.submission.findUnique({
        where: { id: input.submissionId },
        include: {
          files: true,
        },
      });

      if (!submission) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Submission not found',
        });
      }

      // Check if user owns this submission
      if (submission.submitterId !== ctx.user.userId) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'You can only upload files to your own submissions',
        });
      }

      // Check if submission is in draft status
      if (submission.status !== 'DRAFT') {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Can only upload files to draft submissions',
        });
      }

      // Validate file type
      if (!isAllowedMimeType(input.mimeType)) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `File type ${input.mimeType} is not allowed`,
        });
      }

      // Validate file size
      if (input.size > MAX_FILE_SIZE) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `File size exceeds maximum of ${MAX_FILE_SIZE / 1024 / 1024}MB`,
        });
      }

      // Check file count limit
      if (submission.files.length >= MAX_FILES_PER_SUBMISSION) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `Maximum of ${MAX_FILES_PER_SUBMISSION} files per submission`,
        });
      }

      // Check total size limit
      const currentTotalSize = submission.files.reduce(
        (sum: number, f: { size: bigint }) => sum + Number(f.size),
        0,
      );
      if (currentTotalSize + input.size > MAX_TOTAL_UPLOAD_SIZE) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `Total upload size would exceed ${MAX_TOTAL_UPLOAD_SIZE / 1024 / 1024}MB limit`,
        });
      }

      // Sanitize filename
      const sanitizedFilename = sanitizeFilename(input.filename);

      // Create file record in pending state
      const file = await ctx.prisma.submissionFile.create({
        data: {
          submissionId: input.submissionId,
          filename: sanitizedFilename,
          mimeType: input.mimeType,
          size: BigInt(input.size),
          storageKey: '', // Will be set by tusd post-finish hook
          scanStatus: 'PENDING',
        },
      });

      // Generate the storage key
      const storageKey = trpcRegistry.storageService.generateStorageKey(
        ctx.org.id,
        input.submissionId,
        file.id,
        sanitizedFilename,
      );

      // Update file with storage key
      await ctx.prisma.submissionFile.update({
        where: { id: file.id },
        data: { storageKey },
      });

      // For now, return a presigned URL for direct S3 upload
      // When tusd is configured, this would return the tusd endpoint
      const tusEndpoint =
        trpcRegistry.configService.get<string>('TUS_ENDPOINT');

      let uploadUrl: string;
      let expiresAt: Date;

      if (tusEndpoint) {
        // Use tusd endpoint with file metadata
        uploadUrl = `${tusEndpoint}/files/`;
        expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
      } else {
        // Fallback to presigned S3 URL
        uploadUrl = await trpcRegistry.storageService.getUploadUrl({
          key: storageKey,
          contentType: input.mimeType,
          expiresIn: 3600,
        });
        expiresAt = new Date(Date.now() + 3600 * 1000);
      }

      return {
        fileId: file.id,
        uploadUrl,
        storageKey,
        expiresAt,
      };
    }),

  /**
   * Get files for a submission.
   */
  getBySubmission: orgProcedure
    .input(z.object({ submissionId: z.string().uuid() }))
    .query(async ({ input, ctx }) => {
      // Verify submission exists
      const submission = await ctx.prisma.submission.findUnique({
        where: { id: input.submissionId },
      });

      if (!submission) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Submission not found',
        });
      }

      const files = await ctx.prisma.submissionFile.findMany({
        where: { submissionId: input.submissionId },
        orderBy: { uploadedAt: 'desc' },
      });

      // Convert BigInt to number for JSON serialization
      return files.map((f: (typeof files)[number]) => ({
        ...f,
        size: Number(f.size),
      }));
    }),

  /**
   * Get a presigned download URL for a file.
   */
  getDownloadUrl: orgProcedure
    .input(z.object({ fileId: z.string().uuid() }))
    .query(async ({ input, ctx }) => {
      const file = await ctx.prisma.submissionFile.findUnique({
        where: { id: input.fileId },
        include: { submission: true },
      });

      if (!file) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'File not found',
        });
      }

      // Check scan status - only allow download of clean files
      if (file.scanStatus !== 'CLEAN') {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message:
            file.scanStatus === 'INFECTED'
              ? 'This file has been quarantined due to detected malware'
              : 'File is still being scanned',
        });
      }

      const downloadUrl = await trpcRegistry.storageService.getDownloadUrl(
        file.storageKey,
        3600, // 1 hour expiry
      );

      return {
        url: downloadUrl,
        filename: file.filename,
        mimeType: file.mimeType,
        size: Number(file.size),
      };
    }),

  /**
   * Delete a file from a submission.
   * Only the submitter can delete files, and only from draft submissions.
   */
  delete: orgProcedure
    .input(deleteFileSchema)
    .mutation(async ({ input, ctx }) => {
      const file = await ctx.prisma.submissionFile.findUnique({
        where: { id: input.fileId },
        include: { submission: true },
      });

      if (!file) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'File not found',
        });
      }

      // Check if user owns the submission
      if (file.submission.submitterId !== ctx.user.userId) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'You can only delete files from your own submissions',
        });
      }

      // Check if submission is in draft status
      if (file.submission.status !== 'DRAFT') {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Can only delete files from draft submissions',
        });
      }

      // Delete from storage
      if (file.storageKey) {
        try {
          if (file.scanStatus === 'CLEAN') {
            await trpcRegistry.storageService.deleteFile(file.storageKey);
          } else {
            // File might still be in quarantine
            await trpcRegistry.storageService.deleteFromQuarantine(
              file.storageKey,
            );
          }
        } catch {
          // Log but don't fail if storage delete fails
          console.error(
            `Failed to delete file from storage: ${file.storageKey}`,
          );
        }
      }

      // Delete database record
      await ctx.prisma.submissionFile.delete({
        where: { id: input.fileId },
      });

      return { success: true };
    }),
});

export type FilesRouter = typeof filesRouter;
