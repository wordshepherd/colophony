"use client";

import { useState, useCallback, useRef } from "react";
import * as tus from "tus-js-client";
import {
  trpc,
  getAccessToken,
  getCurrentOrgId,
  getTusEndpoint,
} from "@/lib/trpc";
import {
  MAX_FILE_SIZE,
  isAllowedMimeType,
  type ScanStatus,
} from "@colophony/types";

export interface UploadingFile {
  id: string;
  file: File;
  progress: number;
  status: "pending" | "uploading" | "processing" | "complete" | "error";
  error?: string;
  fileId?: string;
  scanStatus?: ScanStatus;
}

interface UseFileUploadOptions {
  submissionId: string;
  onUploadComplete?: (uploadId: string) => void;
  onError?: (error: string) => void;
}

function mapTusError(error: tus.DetailedError | Error): string {
  if ("originalResponse" in error) {
    const detailed = error as tus.DetailedError;
    const status = detailed.originalResponse?.getStatus();
    if (status === 413) return "File is too large";
    if (status === 415) return "File type not allowed";
    if (status === 403) return "Not authorized to upload";
    if (status === 429) return "Too many uploads. Please try again later";
  }
  return error.message || "Upload failed";
}

export function useFileUpload({
  submissionId,
  onUploadComplete,
  onError,
}: UseFileUploadOptions) {
  const [uploads, setUploads] = useState<Map<string, UploadingFile>>(new Map());
  const tusInstances = useRef<Map<string, tus.Upload>>(new Map());
  const utils = trpc.useUtils();

  const updateUpload = useCallback(
    (id: string, update: Partial<UploadingFile>) => {
      setUploads((prev) => {
        const newMap = new Map(prev);
        const existing = newMap.get(id);
        if (existing) {
          newMap.set(id, { ...existing, ...update });
        }
        return newMap;
      });
    },
    [],
  );

  const removeUpload = useCallback((id: string) => {
    tusInstances.current.delete(id);
    setUploads((prev) => {
      const newMap = new Map(prev);
      newMap.delete(id);
      return newMap;
    });
  }, []);

  const cancelUpload = useCallback(
    (id: string) => {
      const instance = tusInstances.current.get(id);
      if (instance) {
        instance.abort(true);
      }
      removeUpload(id);
    },
    [removeUpload],
  );

  const uploadFile = useCallback(
    async (file: File) => {
      const uploadId = crypto.randomUUID();

      // Client-side pre-validation
      if (!isAllowedMimeType(file.type || "application/octet-stream")) {
        const errorMsg = `File type "${file.type || "unknown"}" is not allowed`;
        setUploads((prev) => {
          const newMap = new Map(prev);
          newMap.set(uploadId, {
            id: uploadId,
            file,
            progress: 0,
            status: "error",
            error: errorMsg,
          });
          return newMap;
        });
        onError?.(errorMsg);
        return;
      }

      if (file.size > MAX_FILE_SIZE) {
        const errorMsg = `File exceeds maximum size of ${MAX_FILE_SIZE / (1024 * 1024)}MB`;
        setUploads((prev) => {
          const newMap = new Map(prev);
          newMap.set(uploadId, {
            id: uploadId,
            file,
            progress: 0,
            status: "error",
            error: errorMsg,
          });
          return newMap;
        });
        onError?.(errorMsg);
        return;
      }

      // Add to uploads map
      setUploads((prev) => {
        const newMap = new Map(prev);
        newMap.set(uploadId, {
          id: uploadId,
          file,
          progress: 0,
          status: "uploading",
        });
        return newMap;
      });

      try {
        const token = await getAccessToken();
        const orgId = getCurrentOrgId();

        const headers: Record<string, string> = {};
        if (token) {
          headers["Authorization"] = `Bearer ${token}`;
        }
        if (orgId) {
          headers["X-Organization-Id"] = orgId;
        }

        // Create tus upload — uploads directly to tusd sidecar
        const upload = new tus.Upload(file, {
          endpoint: getTusEndpoint(),
          retryDelays: [0, 1000, 3000, 5000],
          chunkSize: 5 * 1024 * 1024, // 5MB chunks
          metadata: {
            filename: file.name,
            filetype: file.type || "application/octet-stream",
            "submission-id": submissionId,
          },
          headers,
          onProgress: (bytesUploaded, bytesTotal) => {
            const progress = Math.round((bytesUploaded / bytesTotal) * 100);
            updateUpload(uploadId, { progress });
          },
          onSuccess: () => {
            updateUpload(uploadId, {
              progress: 100,
              status: "processing",
              scanStatus: "PENDING",
            });
            tusInstances.current.delete(uploadId);
            // The post-finish webhook creates the file record asynchronously
            // after tusd reports the upload complete. Delay the first
            // invalidation to give the webhook time to process, then retry
            // in case the first attempt was still too early.
            setTimeout(() => {
              utils.files.listBySubmission.invalidate({ submissionId });
              onUploadComplete?.(uploadId);
            }, 1500);
            setTimeout(() => {
              utils.files.listBySubmission.invalidate({ submissionId });
            }, 4000);
          },
          onError: (error) => {
            const message = mapTusError(error);
            updateUpload(uploadId, {
              status: "error",
              error: message,
            });
            tusInstances.current.delete(uploadId);
            onError?.(message);
          },
        });

        // Store instance for cancel support
        tusInstances.current.set(uploadId, upload);

        // Start the upload
        upload.start();
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Failed to start upload";
        updateUpload(uploadId, {
          status: "error",
          error: message,
        });
        onError?.(message);
      }
    },
    [
      submissionId,
      updateUpload,
      utils.files.listBySubmission,
      onUploadComplete,
      onError,
    ],
  );

  const uploadFiles = useCallback(
    async (files: FileList | File[]) => {
      const fileArray = Array.from(files);
      for (const file of fileArray) {
        await uploadFile(file);
      }
    },
    [uploadFile],
  );

  return {
    uploads: Array.from(uploads.values()),
    uploadFile,
    uploadFiles,
    removeUpload,
    cancelUpload,
    isUploading: Array.from(uploads.values()).some(
      (u) => u.status === "uploading" || u.status === "pending",
    ),
  };
}
