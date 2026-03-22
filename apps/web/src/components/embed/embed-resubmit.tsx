"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  fetchResubmitContext,
  prepareResubmitUpload,
  fetchResubmitUploadStatus,
  submitResubmission,
  type EmbedApiError,
} from "@/lib/embed-api";
import type {
  EmbedResubmitContextResponse,
  EmbedPrepareUploadResponse,
  EmbedUploadStatusResponse,
} from "@colophony/types";
import { useEmbedFileUpload } from "@/hooks/use-embed-file-upload";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  Loader2,
  CheckCircle,
  AlertCircle,
  Clock,
  Upload,
  File as FileIcon,
  RefreshCw,
} from "lucide-react";

type Step = "loading" | "form" | "submitting" | "success" | "error";

interface EmbedResubmitProps {
  statusToken: string;
  apiUrl: string;
}

export function EmbedResubmit({ statusToken, apiUrl }: EmbedResubmitProps) {
  const [step, setStep] = useState<Step>("loading");
  const [context, setContext] = useState<EmbedResubmitContextResponse | null>(
    null,
  );
  const [uploadContext, setUploadContext] =
    useState<EmbedPrepareUploadResponse | null>(null);
  const [scanFiles, setScanFiles] = useState<
    EmbedUploadStatusResponse["files"]
  >([]);
  const [allClean, setAllClean] = useState(false);
  const [newStatusToken, setNewStatusToken] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Load context + prepare upload on mount
  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const ctx = await fetchResubmitContext(apiUrl, statusToken);
        if (cancelled) return;
        setContext(ctx);

        const upload = await prepareResubmitUpload(apiUrl, statusToken);
        if (cancelled) return;
        setUploadContext(upload);
        setStep("form");
      } catch (err) {
        if (cancelled) return;
        const apiErr = err as EmbedApiError;
        if (apiErr.status === 404 || apiErr.status === 410) {
          setErrorMessage(
            "This resubmission link is no longer valid. The submission may have already been resubmitted, or the status link has expired.",
          );
        } else {
          setErrorMessage(
            "Unable to load resubmission form. Please try again.",
          );
        }
        setStep("error");
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [apiUrl, statusToken]);

  // File upload hook — uses status token for tusd auth (not embed token)
  const { uploadFiles, uploads, isUploading } = useEmbedFileUpload({
    tusEndpoint: uploadContext?.tusEndpoint ?? "",
    manuscriptVersionId: uploadContext?.manuscriptVersionId ?? "",
    guestUserId: uploadContext?.guestUserId ?? "",
    statusToken,
    maxFileSize: uploadContext?.maxFileSize ?? 0,
    maxFiles: uploadContext?.maxFiles ?? 0,
    allowedMimeTypes: uploadContext?.allowedMimeTypes ?? [],
  });

  // Poll scan status
  const startPolling = useCallback(() => {
    if (!uploadContext?.manuscriptVersionId) return;

    async function poll() {
      try {
        const result = await fetchResubmitUploadStatus(
          apiUrl,
          statusToken,
          uploadContext!.manuscriptVersionId,
        );
        setScanFiles(result.files);
        setAllClean(result.allClean);

        const allTerminal =
          result.files.length > 0 &&
          result.files.every(
            (f) =>
              f.scanStatus === "CLEAN" ||
              f.scanStatus === "INFECTED" ||
              f.scanStatus === "FAILED",
          );
        if (allTerminal && pollRef.current) {
          clearInterval(pollRef.current);
          pollRef.current = null;
        }
      } catch {
        // Silently retry on next interval
      }
    }

    poll();
    pollRef.current = setInterval(poll, 3000);
  }, [apiUrl, statusToken, uploadContext]);

  // Start polling when uploads complete
  useEffect(() => {
    if (uploads.length > 0 && !isUploading) {
      startPolling();
    }
    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [uploads.length, isUploading, startPolling]);

  // Handle file drop/selection
  const handleFiles = useCallback(
    (fileList: FileList | File[]) => {
      const filesArray = Array.from(fileList);
      uploadFiles(filesArray);
    },
    [uploadFiles],
  );

  // Handle submit
  const handleSubmit = useCallback(async () => {
    if (!uploadContext) return;
    setStep("submitting");

    try {
      const result = await submitResubmission(apiUrl, statusToken, {
        manuscriptVersionId: uploadContext.manuscriptVersionId,
      });
      setNewStatusToken(result.statusToken);
      setStep("success");
    } catch (err) {
      const apiErr = err as EmbedApiError;
      setErrorMessage(apiErr.message || "Failed to submit. Please try again.");
      setStep("error");
    }
  }, [apiUrl, statusToken, uploadContext]);

  const hasInfected = scanFiles.some((f) => f.scanStatus === "INFECTED");
  const hasPending = scanFiles.some(
    (f) => f.scanStatus === "PENDING" || f.scanStatus === "SCANNING",
  );
  const canSubmit =
    !isUploading &&
    !hasInfected &&
    !hasPending &&
    scanFiles.length > 0 &&
    allClean;

  // --- Loading ---
  if (step === "loading") {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // --- Error ---
  if (step === "error") {
    return (
      <div className="max-w-md mx-auto text-center py-16 px-4">
        <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
        <h2 className="text-lg font-semibold">Something Went Wrong</h2>
        <p className="text-sm text-muted-foreground mt-2">{errorMessage}</p>
      </div>
    );
  }

  // --- Success ---
  if (step === "success") {
    return (
      <div className="max-w-md mx-auto text-center py-16 px-4">
        <CheckCircle className="h-12 w-12 text-green-600 mx-auto mb-4" />
        <h2 className="text-lg font-semibold">Resubmission Received</h2>
        <p className="text-sm text-muted-foreground mt-2">
          Your revised manuscript has been submitted successfully. A new
          confirmation email has been sent with an updated status link.
        </p>
        {newStatusToken && (
          <a
            href={`/embed/status/${newStatusToken}`}
            className="inline-flex items-center gap-2 mt-4 text-sm text-primary hover:underline"
          >
            Check submission status
          </a>
        )}
      </div>
    );
  }

  // --- Submitting ---
  if (step === "submitting") {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          Submitting your revision...
        </p>
      </div>
    );
  }

  // --- Form ---
  return (
    <div className="max-w-lg mx-auto py-8 px-4">
      <div className="border rounded-lg p-6 space-y-6">
        {/* Header */}
        <div className="text-center">
          <p className="text-sm text-muted-foreground">
            {context?.organizationName}
          </p>
          <h2 className="text-lg font-semibold mt-1">
            Resubmit Revised Manuscript
          </h2>
          {context?.title && (
            <p className="text-sm text-muted-foreground mt-1">
              {context.title}
            </p>
          )}
        </div>

        {/* Revision Notes */}
        {context?.revisionNotes && (
          <div className="rounded-md bg-blue-50 p-4">
            <p className="text-xs font-medium text-blue-800 uppercase tracking-wide mb-1">
              Editor&apos;s Revision Notes
            </p>
            <p className="text-sm text-blue-900 whitespace-pre-wrap">
              {context.revisionNotes}
            </p>
          </div>
        )}

        {/* File Upload */}
        <div className="space-y-3">
          <p className="text-sm font-medium">Upload Revised Files</p>

          {/* Drop zone */}
          <div
            role="button"
            tabIndex={0}
            className={cn(
              "border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors",
              "hover:border-primary hover:bg-muted/50",
              isUploading && "pointer-events-none opacity-50",
            )}
            onClick={() => {
              const input = document.createElement("input");
              input.type = "file";
              input.multiple = true;
              if (uploadContext?.allowedMimeTypes) {
                input.accept = uploadContext.allowedMimeTypes.join(",");
              }
              input.onchange = () => {
                if (input.files) handleFiles(input.files);
              };
              input.click();
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                (e.target as HTMLElement).click();
              }
            }}
            onDragOver={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
            onDrop={(e) => {
              e.preventDefault();
              e.stopPropagation();
              if (e.dataTransfer.files.length > 0) {
                handleFiles(e.dataTransfer.files);
              }
            }}
          >
            <Upload className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">
              Drop files here or click to browse
            </p>
            {uploadContext && (
              <p className="text-xs text-muted-foreground mt-1">
                Max {uploadContext.maxFiles} files, up to{" "}
                {Math.round(uploadContext.maxFileSize / 1024 / 1024)}MB each
              </p>
            )}
          </div>

          {/* Upload progress */}
          {uploads.map((u) => (
            <div key={u.id} className="flex items-center gap-2 text-sm">
              <FileIcon className="h-4 w-4 shrink-0" />
              <span className="truncate flex-1">{u.file.name}</span>
              {u.progress < 100 ? (
                <Progress value={u.progress} className="w-20 h-2" />
              ) : (
                <CheckCircle className="h-4 w-4 text-green-600 shrink-0" />
              )}
            </div>
          ))}

          {/* Scan status */}
          {scanFiles.map((f) => (
            <div key={f.id} className="flex items-center gap-2 text-sm">
              <FileIcon className="h-4 w-4 shrink-0" />
              <span className="truncate flex-1">{f.filename}</span>
              <ScanBadge status={f.scanStatus} />
            </div>
          ))}
        </div>

        {/* Submit */}
        <Button onClick={handleSubmit} disabled={!canSubmit} className="w-full">
          <RefreshCw className="h-4 w-4 mr-2" />
          Submit Revision
        </Button>

        {hasInfected && (
          <p className="text-xs text-destructive text-center">
            One or more files were flagged as infected. Please upload clean
            files.
          </p>
        )}
        {hasPending && (
          <p className="text-xs text-muted-foreground text-center">
            Waiting for file scanning to complete...
          </p>
        )}
      </div>
    </div>
  );
}

function ScanBadge({ status }: { status: string }) {
  switch (status) {
    case "CLEAN":
      return (
        <Badge variant="outline" className="bg-green-100 text-green-800 gap-1">
          <CheckCircle className="h-3 w-3" />
          Clean
        </Badge>
      );
    case "INFECTED":
      return (
        <Badge variant="outline" className="bg-red-100 text-red-800 gap-1">
          <AlertCircle className="h-3 w-3" />
          Infected
        </Badge>
      );
    case "SCANNING":
      return (
        <Badge
          variant="outline"
          className="bg-yellow-100 text-yellow-800 gap-1"
        >
          <Loader2 className="h-3 w-3 animate-spin" />
          Scanning
        </Badge>
      );
    default:
      return (
        <Badge variant="outline" className="bg-gray-100 text-gray-800 gap-1">
          <Clock className="h-3 w-3" />
          Pending
        </Badge>
      );
  }
}
