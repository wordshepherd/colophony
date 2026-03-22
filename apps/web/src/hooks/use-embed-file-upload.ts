"use client";

import { useState, useCallback, useRef } from "react";
import * as tus from "tus-js-client";
import type { UploadingFile } from "./use-file-upload";

interface UseEmbedFileUploadOptions {
  manuscriptVersionId: string;
  guestUserId: string;
  tusEndpoint: string;
  embedToken?: string;
  statusToken?: string;
  maxFileSize: number;
  maxFiles?: number;
  allowedMimeTypes: string[];
  onUploadComplete?: () => void;
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

export function useEmbedFileUpload({
  manuscriptVersionId,
  guestUserId,
  tusEndpoint,
  embedToken,
  statusToken,
  maxFileSize,
  allowedMimeTypes,
  onUploadComplete,
  onError,
}: UseEmbedFileUploadOptions) {
  const [uploads, setUploads] = useState<Map<string, UploadingFile>>(new Map());
  const tusInstances = useRef<Map<string, tus.Upload>>(new Map());

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

      // Client-side MIME type validation
      const fileType = file.type || "application/octet-stream";
      if (allowedMimeTypes.length > 0 && !allowedMimeTypes.includes(fileType)) {
        const errorMsg = `File type "${fileType}" is not allowed`;
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

      // Client-side file size validation
      if (file.size > maxFileSize) {
        const errorMsg = `File exceeds maximum size of ${Math.round(maxFileSize / (1024 * 1024))}MB`;
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

      const upload = new tus.Upload(file, {
        endpoint: tusEndpoint,
        retryDelays: [0, 1000, 3000, 5000],
        chunkSize: 5 * 1024 * 1024,
        metadata: {
          filename: file.name,
          filetype: fileType,
          "guest-user-id": guestUserId,
          "manuscript-version-id": manuscriptVersionId,
        },
        headers: {
          ...(embedToken ? { "X-Embed-Token": embedToken } : {}),
          ...(statusToken ? { "X-Status-Token": statusToken } : {}),
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
          tusInstances.current.delete(uploadId);
          onUploadComplete?.();
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

      tusInstances.current.set(uploadId, upload);
      upload.start();
    },
    [
      manuscriptVersionId,
      guestUserId,
      tusEndpoint,
      embedToken,
      statusToken,
      maxFileSize,
      allowedMimeTypes,
      updateUpload,
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
      (u) =>
        u.status === "uploading" ||
        u.status === "pending" ||
        u.status === "processing",
    ),
  };
}
