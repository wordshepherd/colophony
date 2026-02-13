"use client";

import { useState, useCallback } from "react";
import * as tus from "tus-js-client";
import { trpc, getAccessToken } from "@/lib/trpc";
import type { ScanStatus } from "@colophony/types";

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
  onUploadComplete?: (fileId: string) => void;
  onError?: (error: string) => void;
}

export function useFileUpload({
  submissionId,
  onUploadComplete,
  onError,
}: UseFileUploadOptions) {
  const [uploads, setUploads] = useState<Map<string, UploadingFile>>(new Map());
  const utils = trpc.useUtils();

  const initiateUploadMutation = trpc.files.initiateUpload.useMutation();

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
    setUploads((prev) => {
      const newMap = new Map(prev);
      newMap.delete(id);
      return newMap;
    });
  }, []);

  const uploadFile = useCallback(
    async (file: File) => {
      const uploadId = crypto.randomUUID();

      // Add to uploads map
      setUploads((prev) => {
        const newMap = new Map(prev);
        newMap.set(uploadId, {
          id: uploadId,
          file,
          progress: 0,
          status: "pending",
        });
        return newMap;
      });

      try {
        // Initiate upload to get URL and file ID
        const { fileId, uploadUrl } = await initiateUploadMutation.mutateAsync({
          submissionId,
          filename: file.name,
          mimeType: file.type || "application/octet-stream",
          size: file.size,
        });

        updateUpload(uploadId, {
          fileId,
          status: "uploading",
        });

        // Create tus upload
        const upload = new tus.Upload(file, {
          endpoint: uploadUrl,
          retryDelays: [0, 1000, 3000, 5000],
          chunkSize: 5 * 1024 * 1024, // 5MB chunks
          metadata: {
            filename: file.name,
            filetype: file.type || "application/octet-stream",
            fileId,
            submissionId,
          },
          headers: {
            Authorization: `Bearer ${getAccessToken()}`,
          },
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
            // Invalidate file queries
            utils.files.getBySubmission.invalidate({ submissionId });
            onUploadComplete?.(fileId);
          },
          onError: (error) => {
            updateUpload(uploadId, {
              status: "error",
              error: error.message || "Upload failed",
            });
            onError?.(error.message || "Upload failed");
          },
        });

        // Start the upload
        upload.start();
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Failed to initiate upload";
        updateUpload(uploadId, {
          status: "error",
          error: message,
        });
        onError?.(message);
      }
    },
    [
      submissionId,
      initiateUploadMutation,
      updateUpload,
      utils.files.getBySubmission,
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

  const cancelUpload = useCallback(
    (id: string) => {
      // Note: tus-js-client doesn't expose abort directly in this version
      // For now, just remove from UI
      removeUpload(id);
    },
    [removeUpload],
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
