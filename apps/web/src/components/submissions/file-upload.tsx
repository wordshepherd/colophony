"use client";

import { useCallback, useEffect, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { useFileUpload, type UploadingFile } from "@/hooks/use-file-upload";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  Upload,
  File,
  X,
  CheckCircle,
  AlertCircle,
  Clock,
  Loader2,
} from "lucide-react";
import {
  MAX_FILE_SIZE,
  MAX_FILES_PER_SUBMISSION,
  ALLOWED_MIME_TYPES,
  type ScanStatus,
} from "@colophony/types";

interface FileUploadProps {
  submissionId: string;
  disabled?: boolean;
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
    className: "bg-gray-100 text-gray-800",
  },
  SCANNING: {
    label: "Scanning...",
    icon: Loader2,
    className: "bg-blue-100 text-blue-800",
  },
  CLEAN: {
    label: "Clean",
    icon: CheckCircle,
    className: "bg-green-100 text-green-800",
  },
  INFECTED: {
    label: "Infected",
    icon: AlertCircle,
    className: "bg-red-100 text-red-800",
  },
  FAILED: {
    label: "Scan failed",
    icon: AlertCircle,
    className: "bg-orange-100 text-orange-800",
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

function UploadingFileItem({
  upload,
  onCancel,
  onRemove,
}: {
  upload: UploadingFile;
  onCancel: () => void;
  onRemove: () => void;
}) {
  return (
    <div className="flex items-center gap-3 p-3 border rounded-lg">
      <File className="h-8 w-8 text-muted-foreground flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{upload.file.name}</p>
        <p className="text-xs text-muted-foreground">
          {formatFileSize(upload.file.size)}
        </p>
        {upload.status === "uploading" && (
          <Progress value={upload.progress} className="h-1 mt-2" />
        )}
        {upload.status === "error" && (
          <p className="text-xs text-destructive mt-1">{upload.error}</p>
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
        {upload.status === "complete" && (
          <CheckCircle className="h-5 w-5 text-green-600" />
        )}
        {upload.status === "error" && (
          <AlertCircle className="h-5 w-5 text-destructive" />
        )}
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={upload.status === "uploading" ? onCancel : onRemove}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

function ExistingFileItem({
  file,
  onDelete,
  canDelete,
}: {
  file: {
    id: string;
    filename: string;
    size: number;
    scanStatus: ScanStatus;
  };
  onDelete: () => void;
  canDelete: boolean;
}) {
  return (
    <div className="flex items-center gap-3 p-3 border rounded-lg">
      <File className="h-8 w-8 text-muted-foreground flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{file.filename}</p>
        <p className="text-xs text-muted-foreground">
          {formatFileSize(file.size)}
        </p>
      </div>
      <div className="flex items-center gap-2">
        <ScanStatusBadge status={file.scanStatus} />
        {canDelete && (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={onDelete}
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
}

export function FileUpload({ submissionId, disabled }: FileUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  // Track whether uploads are in "processing" state (waiting for post-finish
  // webhook to create the file record). Used by refetchInterval below.
  const hasProcessingUploadsRef = useRef(false);

  const deleteMutation = trpc.files.delete.useMutation();
  const utils = trpc.useUtils();

  const { uploads, uploadFiles, removeUpload, cancelUpload } = useFileUpload({
    submissionId,
    onUploadComplete: () => {
      utils.files.listBySubmission.invalidate({ submissionId });
    },
  });

  // Keep ref in sync with upload state so the query's refetchInterval
  // can read it without stale closures.
  useEffect(() => {
    hasProcessingUploadsRef.current = uploads.some(
      (u) => u.status === "processing",
    );
  }, [uploads]);

  // Poll while any file is still being scanned OR while uploads are waiting
  // for the post-finish webhook to create their DB records.
  const { data: existingFiles, isPending: isLoading } =
    trpc.files.listBySubmission.useQuery(
      { submissionId },
      {
        refetchInterval: (query) => {
          const files = query.state.data as
            | Array<{ scanStatus: ScanStatus }>
            | undefined;
          const hasPending = files?.some(
            (f) => f.scanStatus === "PENDING" || f.scanStatus === "SCANNING",
          );
          return hasPending || hasProcessingUploadsRef.current ? 3000 : false;
        },
      },
    );

  // Auto-remove "processing" upload items once their file record appears
  // in the DB query results (i.e., the post-finish webhook has completed).
  useEffect(() => {
    if (!existingFiles) return;
    const existingNames = new Set(existingFiles.map((f) => f.filename));
    for (const upload of uploads) {
      if (
        upload.status === "processing" &&
        existingNames.has(upload.file.name)
      ) {
        removeUpload(upload.id);
      }
    }
  }, [existingFiles, uploads, removeUpload]);

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (files && files.length > 0) {
        uploadFiles(files);
      }
      // Reset input
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

  const handleDeleteFile = useCallback(
    async (fileId: string) => {
      try {
        await deleteMutation.mutateAsync({ fileId });
        utils.files.listBySubmission.invalidate({ submissionId });
      } catch (error) {
        console.error("Failed to delete file:", error);
      }
    },
    [deleteMutation, utils.files.listBySubmission, submissionId],
  );

  const totalFiles = (existingFiles?.length ?? 0) + uploads.length;
  const canUpload = !disabled && totalFiles < MAX_FILES_PER_SUBMISSION;

  const acceptedTypes = ALLOWED_MIME_TYPES.join(",");

  return (
    <div className="space-y-4">
      {/* Drop zone */}
      <div
        className={cn(
          "border-2 border-dashed rounded-lg p-8 text-center transition-colors",
          canUpload
            ? "border-muted-foreground/25 hover:border-primary/50 cursor-pointer"
            : "border-muted opacity-50 cursor-not-allowed",
        )}
        onDrop={canUpload ? handleDrop : undefined}
        onDragOver={canUpload ? handleDragOver : undefined}
        onClick={() => canUpload && inputRef.current?.click()}
      >
        <Upload className="mx-auto h-12 w-12 text-muted-foreground" />
        <p className="mt-2 text-sm font-medium">
          {canUpload
            ? "Drop files here or click to upload"
            : "Upload limit reached"}
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          Max {formatFileSize(MAX_FILE_SIZE)} per file.{" "}
          {MAX_FILES_PER_SUBMISSION} files max.
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
          <p className="text-sm font-medium">Uploading</p>
          {uploads.map((upload) => (
            <UploadingFileItem
              key={upload.id}
              upload={upload}
              onCancel={() => cancelUpload(upload.id)}
              onRemove={() => removeUpload(upload.id)}
            />
          ))}
        </div>
      )}

      {/* Existing files */}
      {!isLoading && existingFiles && existingFiles.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium">Uploaded files</p>
          {existingFiles.map((file) => (
            <ExistingFileItem
              key={file.id}
              file={file}
              onDelete={() => handleDeleteFile(file.id)}
              canDelete={!disabled}
            />
          ))}
        </div>
      )}

      {/* Warning about pending scans */}
      {existingFiles?.some(
        (f) => f.scanStatus === "PENDING" || f.scanStatus === "SCANNING",
      ) && (
        <p className="text-sm text-yellow-600 dark:text-yellow-400">
          Some files are still being scanned. You can submit after all scans
          complete.
        </p>
      )}

      {/* Warning about infected files */}
      {existingFiles?.some((f) => f.scanStatus === "INFECTED") && (
        <p className="text-sm text-destructive">
          Some files were flagged as infected. Please remove them before
          submitting.
        </p>
      )}
    </div>
  );
}
