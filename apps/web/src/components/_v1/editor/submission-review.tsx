"use client";

import Link from "next/link";
import { formatDistanceToNow, format } from "date-fns";
import { trpc } from "@/lib/trpc";
import { StatusBadge } from "@/components/submissions/status-badge";
import { StatusTransition } from "./status-transition";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  File,
  Download,
  Clock,
  CheckCircle,
  AlertCircle,
  Loader2,
  User,
} from "lucide-react";
import type { ScanStatus, SubmissionStatus } from "@colophony/types";

interface SubmissionReviewProps {
  submissionId: string;
}

const scanStatusIcons: Record<
  ScanStatus,
  React.ComponentType<{ className?: string }>
> = {
  PENDING: Clock,
  SCANNING: Loader2,
  CLEAN: CheckCircle,
  INFECTED: AlertCircle,
  FAILED: AlertCircle,
};

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function SubmissionReview({ submissionId }: SubmissionReviewProps) {
  const { data: submission, isPending: isLoading } =
    trpc.submissions.getById.useQuery({
      id: submissionId,
    });

  const { data: files } = trpc.files.getBySubmission.useQuery({
    submissionId,
  });

  const { data: history } = trpc.submissions.getHistory.useQuery({
    submissionId,
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (!submission) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Submission not found</p>
        <Link href="/editor">
          <Button variant="link">Back to dashboard</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <Link
            href="/editor"
            className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="mr-1 h-4 w-4" />
            Back to dashboard
          </Link>
          <h1 className="text-2xl font-bold">{submission.title}</h1>
          <div className="flex items-center gap-4">
            <StatusBadge status={submission.status as SubmissionStatus} />
            <div className="flex items-center text-sm text-muted-foreground">
              <User className="mr-1 h-4 w-4" />
              {submission.submitter?.email ?? "Unknown"}
            </div>
            <span className="text-sm text-muted-foreground">
              Submitted{" "}
              {submission.submittedAt
                ? formatDistanceToNow(new Date(submission.submittedAt), {
                    addSuffix: true,
                  })
                : "not yet"}
            </span>
          </div>
        </div>
      </div>

      {/* Status transition controls */}
      <Card>
        <CardHeader>
          <CardTitle>Status Actions</CardTitle>
          <CardDescription>Change the submission status</CardDescription>
        </CardHeader>
        <CardContent>
          <StatusTransition
            submissionId={submissionId}
            currentStatus={submission.status as SubmissionStatus}
          />
        </CardContent>
      </Card>

      {/* Content */}
      <div className="grid gap-6 md:grid-cols-3">
        <div className="md:col-span-2 space-y-6">
          {/* Main content */}
          <Card>
            <CardHeader>
              <CardTitle>Content</CardTitle>
            </CardHeader>
            <CardContent>
              {submission.content ? (
                <div className="whitespace-pre-wrap text-sm">
                  {submission.content}
                </div>
              ) : (
                <p className="text-muted-foreground text-sm">
                  No text content provided
                </p>
              )}
            </CardContent>
          </Card>

          {/* Cover letter */}
          {submission.coverLetter && (
            <Card>
              <CardHeader>
                <CardTitle>Cover Letter</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="whitespace-pre-wrap text-sm">
                  {submission.coverLetter}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Files */}
          {files && files.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Files</CardTitle>
                <CardDescription>
                  {files.length} file{files.length !== 1 ? "s" : ""} attached
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {files.map((file) => {
                    const Icon = scanStatusIcons[file.scanStatus as ScanStatus];
                    return (
                      <div
                        key={file.id}
                        className="flex items-center gap-3 p-3 border rounded-lg"
                      >
                        <File className="h-8 w-8 text-muted-foreground" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">
                            {file.filename}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {formatFileSize(file.size)}
                          </p>
                        </div>
                        <Badge
                          variant={
                            file.scanStatus === "CLEAN"
                              ? "default"
                              : file.scanStatus === "INFECTED"
                                ? "destructive"
                                : "secondary"
                          }
                          className="gap-1"
                        >
                          <Icon
                            className={`h-3 w-3 ${
                              file.scanStatus === "SCANNING"
                                ? "animate-spin"
                                : ""
                            }`}
                          />
                          {file.scanStatus}
                        </Badge>
                        {file.scanStatus === "CLEAN" && (
                          <Button variant="ghost" size="icon">
                            <Download className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Submitter info */}
          <Card>
            <CardHeader>
              <CardTitle>Submitter</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div>
                <p className="text-sm font-medium">
                  {submission.submitter?.email ?? "Unknown"}
                </p>
              </div>
              <Separator />
              <div className="text-sm text-muted-foreground">
                <p>Created: {format(new Date(submission.createdAt), "PPP")}</p>
                {submission.submittedAt && (
                  <p>
                    Submitted: {format(new Date(submission.submittedAt), "PPP")}
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* History */}
          <Card>
            <CardHeader>
              <CardTitle>History</CardTitle>
            </CardHeader>
            <CardContent>
              {history && history.length > 0 ? (
                <div className="space-y-4">
                  {history.map((event, index) => (
                    <div key={event.id} className="relative">
                      {index < history.length - 1 && (
                        <div className="absolute left-2 top-8 bottom-0 w-px bg-border" />
                      )}
                      <div className="flex gap-3">
                        <div className="w-4 h-4 mt-1 rounded-full bg-primary flex-shrink-0" />
                        <div className="space-y-1">
                          <p className="text-sm">
                            {event.fromStatus ? (
                              <>
                                Changed from{" "}
                                <Badge variant="outline" className="text-xs">
                                  {event.fromStatus}
                                </Badge>{" "}
                                to{" "}
                                <Badge variant="outline" className="text-xs">
                                  {event.toStatus}
                                </Badge>
                              </>
                            ) : (
                              <>
                                Status set to{" "}
                                <Badge variant="outline" className="text-xs">
                                  {event.toStatus}
                                </Badge>
                              </>
                            )}
                          </p>
                          {event.comment && (
                            <p className="text-sm text-muted-foreground">
                              &ldquo;{event.comment}&rdquo;
                            </p>
                          )}
                          <p className="text-xs text-muted-foreground">
                            {format(new Date(event.changedAt), "PPp")}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No history yet</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
