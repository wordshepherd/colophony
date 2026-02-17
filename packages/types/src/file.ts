import { z } from "zod";

export const scanStatusSchema = z.enum([
  "PENDING",
  "SCANNING",
  "CLEAN",
  "INFECTED",
  "FAILED",
]);

export type ScanStatus = z.infer<typeof scanStatusSchema>;

/**
 * Allowed file types for submissions.
 * This can be configured per organization in the future.
 */
export const ALLOWED_MIME_TYPES = [
  // Documents
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/rtf",
  "text/plain",
  "text/markdown",
  // Images
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  // Audio (for audio submissions)
  "audio/mpeg",
  "audio/wav",
  "audio/ogg",
  // Video (for video submissions)
  "video/mp4",
  "video/webm",
] as const;

export type AllowedMimeType = (typeof ALLOWED_MIME_TYPES)[number];

/**
 * Maximum file size in bytes (50MB default)
 */
export const MAX_FILE_SIZE = 50 * 1024 * 1024;

/**
 * Maximum total upload size per submission (200MB default)
 */
export const MAX_TOTAL_UPLOAD_SIZE = 200 * 1024 * 1024;

/**
 * Maximum files per submission
 */
export const MAX_FILES_PER_SUBMISSION = 10;

export const submissionFileSchema = z.object({
  id: z.string().uuid(),
  submissionId: z.string().uuid(),
  filename: z.string(),
  mimeType: z.string(),
  size: z.number(),
  storageKey: z.string(),
  scanStatus: scanStatusSchema,
  scannedAt: z.date().nullable(),
  uploadedAt: z.date(),
});

export type SubmissionFile = z.infer<typeof submissionFileSchema>;

/**
 * Input for initiating a file upload.
 * Client provides metadata, server returns upload URL.
 */
export const initiateUploadSchema = z.object({
  submissionId: z.string().uuid(),
  filename: z.string().min(1).max(255),
  mimeType: z.string(),
  size: z.number().int().positive().max(MAX_FILE_SIZE),
});

export type InitiateUploadInput = z.infer<typeof initiateUploadSchema>;

/**
 * Response from initiating an upload.
 * Contains the tus upload URL and file ID.
 */
export const initiateUploadResponseSchema = z.object({
  fileId: z.string().uuid(),
  uploadUrl: z.string().url(),
  expiresAt: z.date(),
});

export type InitiateUploadResponse = z.infer<
  typeof initiateUploadResponseSchema
>;

/**
 * Input for completing a file upload (called by tusd webhook).
 */
export const completeUploadSchema = z.object({
  fileId: z.string().uuid(),
  storageKey: z.string(),
  size: z.number().int().positive(),
});

export type CompleteUploadInput = z.infer<typeof completeUploadSchema>;

/**
 * Input for deleting a file from a submission.
 */
export const deleteFileSchema = z.object({
  fileId: z.string().uuid(),
});

export type DeleteFileInput = z.infer<typeof deleteFileSchema>;

/**
 * tusd pre-create hook payload
 */
export const tusdPreCreateHookSchema = z.object({
  Upload: z.object({
    ID: z.string().optional(),
    Size: z.number().optional(),
    SizeIsDeferred: z.boolean().optional(),
    Offset: z.number().optional(),
    MetaData: z.record(z.string(), z.string()).optional(),
    IsPartial: z.boolean().optional(),
    IsFinal: z.boolean().optional(),
    PartialUploads: z.array(z.string()).optional().nullable(),
    Storage: z.record(z.string(), z.unknown()).optional().nullable(),
  }),
  HTTPRequest: z.object({
    Method: z.string(),
    URI: z.string(),
    RemoteAddr: z.string(),
    Header: z.record(z.string(), z.array(z.string())),
  }),
});

export type TusdPreCreateHook = z.infer<typeof tusdPreCreateHookSchema>;

/**
 * tusd post-finish hook payload
 */
export const tusdPostFinishHookSchema = z.object({
  Upload: z.object({
    ID: z.string(),
    Size: z.number(),
    SizeIsDeferred: z.boolean().optional(),
    Offset: z.number(),
    MetaData: z.record(z.string(), z.string()).optional(),
    IsPartial: z.boolean().optional(),
    IsFinal: z.boolean().optional(),
    PartialUploads: z.array(z.string()).optional().nullable(),
    Storage: z
      .object({
        Bucket: z.string().optional(),
        Key: z.string().optional(),
        Type: z.string().optional(),
      })
      .optional()
      .nullable(),
  }),
  HTTPRequest: z.object({
    Method: z.string(),
    URI: z.string(),
    RemoteAddr: z.string(),
    Header: z.record(z.string(), z.array(z.string())),
  }),
});

export type TusdPostFinishHook = z.infer<typeof tusdPostFinishHookSchema>;

/**
 * Pre-create hook response to tusd
 */
export interface TusdPreCreateResponse {
  ChangeFileInfo?: {
    ID?: string;
    MetaData?: Record<string, string>;
  };
  RejectUpload?: boolean;
  HTTPResponse?: {
    StatusCode?: number;
    Body?: string;
    Header?: Record<string, string>;
  };
}

/**
 * Check if a MIME type is allowed
 */
export function isAllowedMimeType(mimeType: string): boolean {
  return (ALLOWED_MIME_TYPES as readonly string[]).includes(mimeType);
}

/**
 * Get file extension from filename
 */
export function getFileExtension(filename: string): string {
  const parts = filename.split(".");
  return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : "";
}

/**
 * Sanitize filename for storage
 */
export function sanitizeFilename(filename: string): string {
  // Remove path separators and null bytes
  let sanitized = filename.replace(/[\\/\0]/g, "");
  // Replace spaces with underscores
  sanitized = sanitized.replace(/\s+/g, "_");
  // Remove any characters that aren't alphanumeric, dash, underscore, or dot
  sanitized = sanitized.replace(/[^a-zA-Z0-9._-]/g, "");
  // Limit length
  if (sanitized.length > 200) {
    const ext = getFileExtension(sanitized);
    const base = sanitized.slice(0, 200 - ext.length - 1);
    sanitized = ext ? `${base}.${ext}` : base;
  }
  return sanitized || "unnamed";
}
