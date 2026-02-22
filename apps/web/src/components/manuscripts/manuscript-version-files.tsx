"use client";

import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { FileUpload } from "@/components/submissions/file-upload";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  File,
  CheckCircle,
  AlertCircle,
  Clock,
  Loader2,
  Download,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { ScanStatus } from "@colophony/types";

interface FileRecord {
  id: string;
  filename: string;
  size: number;
  scanStatus: ScanStatus;
}

interface ManuscriptVersionFilesProps {
  manuscriptVersionId: string;
  files: FileRecord[];
  readOnly?: boolean;
  onFileChange?: () => void;
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

export function ManuscriptVersionFiles({
  manuscriptVersionId,
  files,
  readOnly,
  onFileChange,
}: ManuscriptVersionFilesProps) {
  if (!readOnly) {
    return (
      <FileUpload
        manuscriptVersionId={manuscriptVersionId}
        onFileChange={onFileChange}
      />
    );
  }

  if (files.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">No files in this version.</p>
    );
  }

  return (
    <div className="space-y-2">
      {files.map((file) => (
        <ReadOnlyFileItem key={file.id} file={file} />
      ))}
    </div>
  );
}

function ReadOnlyFileItem({ file }: { file: FileRecord }) {
  const [downloadFileId, setDownloadFileId] = useState<string | null>(null);

  const { data: downloadData, isFetching } = trpc.files.getDownloadUrl.useQuery(
    { fileId: downloadFileId! },
    { enabled: !!downloadFileId },
  );

  // Open the download URL when it arrives
  useEffect(() => {
    if (downloadData?.url) {
      window.open(downloadData.url, "_blank");
      setDownloadFileId(null);
    }
  }, [downloadData]);

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
        {file.scanStatus === "CLEAN" && (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => setDownloadFileId(file.id)}
            disabled={isFetching}
          >
            {isFetching ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
          </Button>
        )}
      </div>
    </div>
  );
}
