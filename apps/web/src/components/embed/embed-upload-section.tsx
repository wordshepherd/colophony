"use client";

import { useCallback, useEffect, useRef } from "react";
import { useEmbedFileUpload } from "@/hooks/use-embed-file-upload";
import { useEmbedUploadStatus } from "@/hooks/use-embed-upload-status";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  Upload,
  File as FileIcon,
  X,
  CheckCircle,
  AlertCircle,
  Clock,
  Loader2,
} from "lucide-react";
import type { EmbedPrepareUploadResponse, ScanStatus } from "@colophony/types";

export interface UploadState {
  isUploading: boolean;
  hasInfected: boolean;
  allClean: boolean;
  fileCount: number;
}

interface EmbedUploadSectionProps {
  token: string;
  apiUrl: string;
  uploadContext: EmbedPrepareUploadResponse;
  identity: { email: string; name?: string };
  disabled: boolean;
  onUploadStateChange: (state: UploadState) => void;
}

const scanStatusConfig: Record<
  ScanStatus,
  {
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    className: string;
  }
> = {
  PENDING: {
    label: "Pending scan",
    icon: Clock,
    className: "bg-status-info/10 text-status-info",
  },
  SCANNING: {
    label: "Scanning...",
    icon: Loader2,
    className: "bg-status-info/10 text-status-info",
  },
  CLEAN: {
    label: "Clean",
    icon: CheckCircle,
    className: "bg-status-success/10 text-status-success",
  },
  INFECTED: {
    label: "Infected",
    icon: AlertCircle,
    className: "bg-status-error/10 text-status-error",
  },
  FAILED: {
    label: "Scan failed",
    icon: AlertCircle,
    className: "bg-status-held/10 text-status-held",
  },
};

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function ScanStatusBadge({ status }: { status: ScanStatus }) {
  const config = scanStatusConfig[status];
  const Icon = config.icon;

  return (
    <Badge variant="secondary" className={cn("gap-1", config.className)}>
      <Icon
        className={cn("h-3 w-3", status === "SCANNING" && "animate-spin")}
      />
      {config.label}
    </Badge>
  );
}

export function EmbedUploadSection({
  token,
  apiUrl,
  uploadContext,
  identity,
  disabled,
  onUploadStateChange,
}: EmbedUploadSectionProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const { uploads, uploadFiles, removeUpload, cancelUpload, isUploading } =
    useEmbedFileUpload({
      manuscriptVersionId: uploadContext.manuscriptVersionId,
      guestUserId: uploadContext.guestUserId,
      tusEndpoint: uploadContext.tusEndpoint,
      embedToken: token,
      maxFileSize: uploadContext.maxFileSize,
      allowedMimeTypes: uploadContext.allowedMimeTypes,
    });

  const { files: scannedFiles, allClean } = useEmbedUploadStatus({
    apiUrl,
    token,
    manuscriptVersionId: uploadContext.manuscriptVersionId,
    email: identity.email,
    enabled: true,
    uploadsInFlight: isUploading,
  });

  // Propagate upload state to parent
  const hasInfected = scannedFiles.some((f) => f.scanStatus === "INFECTED");
  const fileCount = scannedFiles.length;

  useEffect(() => {
    onUploadStateChange({
      isUploading,
      hasInfected,
      allClean,
      fileCount,
    });
  }, [isUploading, hasInfected, allClean, fileCount, onUploadStateChange]);

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (files && files.length > 0) {
        uploadFiles(files);
      }
      if (inputRef.current) {
        inputRef.current.value = "";
      }
    },
    [uploadFiles],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const files = e.dataTransfer.files;
      if (files && files.length > 0) {
        uploadFiles(files);
      }
    },
    [uploadFiles],
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
  }, []);

  const totalFiles =
    scannedFiles.length +
    uploads.filter((u) => u.status === "uploading" || u.status === "pending")
      .length;
  const canUpload = !disabled && totalFiles < uploadContext.maxFiles;

  const acceptedTypes = uploadContext.allowedMimeTypes.join(",");

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-medium">Files</h3>
        <p className="text-xs text-muted-foreground mt-1">
          Max {formatFileSize(uploadContext.maxFileSize)} per file.{" "}
          {uploadContext.maxFiles} files max.
        </p>
      </div>

      {/* Drop zone */}
      <div
        className={cn(
          "border-2 border-dashed rounded-lg p-6 text-center transition-colors",
          canUpload
            ? "border-muted-foreground/25 hover:border-primary/50 cursor-pointer"
            : "border-muted opacity-50 cursor-not-allowed",
        )}
        role="button"
        tabIndex={canUpload ? 0 : -1}
        aria-label={
          canUpload
            ? "Drop files here or click to upload"
            : "Upload limit reached"
        }
        aria-disabled={!canUpload}
        onDrop={canUpload ? handleDrop : undefined}
        onDragOver={canUpload ? handleDragOver : undefined}
        onClick={() => canUpload && inputRef.current?.click()}
        onKeyDown={(e) => {
          if ((e.key === "Enter" || e.key === " ") && canUpload) {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
      >
        <Upload className="mx-auto h-10 w-10 text-muted-foreground" />
        <p className="mt-2 text-sm font-medium">
          {canUpload
            ? "Drop files here or click to upload"
            : "Upload limit reached"}
        </p>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={acceptedTypes}
          onChange={handleFileSelect}
          className="hidden"
          disabled={!canUpload}
        />
      </div>

      {/* Uploading files */}
      {uploads.length > 0 && (
        <div className="space-y-2">
          {uploads.map((upload) => (
            <div
              key={upload.id}
              className="flex items-center gap-3 p-3 border rounded-lg"
            >
              <FileIcon className="h-6 w-6 text-muted-foreground flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">
                  {upload.file.name}
                </p>
                <p className="text-xs text-muted-foreground">
                  {formatFileSize(upload.file.size)}
                </p>
                {upload.status === "uploading" && (
                  <Progress value={upload.progress} className="h-1 mt-1" />
                )}
                {upload.status === "error" && (
                  <p className="text-xs text-destructive mt-1">
                    {upload.error}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2">
                {upload.status === "uploading" && (
                  <span className="text-xs text-muted-foreground">
                    {upload.progress}%
                  </span>
                )}
                {upload.status === "processing" && upload.scanStatus && (
                  <ScanStatusBadge status={upload.scanStatus} />
                )}
                {upload.status === "error" && (
                  <AlertCircle className="h-5 w-5 text-destructive" />
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={
                    upload.status === "uploading"
                      ? () => cancelUpload(upload.id)
                      : () => removeUpload(upload.id)
                  }
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Scanned files from server */}
      {scannedFiles.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium">Uploaded files</p>
          {scannedFiles.map((file) => (
            <div
              key={file.id}
              className="flex items-center gap-3 p-3 border rounded-lg"
            >
              <FileIcon className="h-6 w-6 text-muted-foreground flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{file.filename}</p>
                <p className="text-xs text-muted-foreground">
                  {formatFileSize(file.size)}
                </p>
              </div>
              <ScanStatusBadge status={file.scanStatus} />
            </div>
          ))}
        </div>
      )}

      {/* Scan status announcements for screen readers */}
      <div aria-live="polite">
        {/* Scanning warning */}
        {scannedFiles.some(
          (f) => f.scanStatus === "PENDING" || f.scanStatus === "SCANNING",
        ) && (
          <p className="text-sm text-status-warning">
            Files are being scanned. You can submit after all scans complete.
          </p>
        )}

        {/* Infected warning */}
        {hasInfected && (
          <p className="text-sm text-destructive">
            Some files were flagged as infected and cannot be submitted.
          </p>
        )}
      </div>
    </div>
  );
}
