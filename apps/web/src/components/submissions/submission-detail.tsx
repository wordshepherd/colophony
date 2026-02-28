"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { formatDistanceToNow, format } from "date-fns";
import { trpc } from "@/lib/trpc";
import { useOrganization } from "@/hooks/use-organization";
import { PluginSlot } from "@/components/plugins/plugin-slot";
import { StatusBadge } from "./status-badge";
import { StatusTransition } from "./status-transition";
import { ReviseAndResubmitCard } from "./revise-and-resubmit-card";
import { ComposeMessageDialog } from "./compose-message-dialog";
import { CorrespondenceHistory } from "./correspondence-history";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Edit,
  Trash2,
  ArrowLeft,
  File,
  Download,
  Clock,
  CheckCircle,
  AlertCircle,
  Loader2,
  BookOpen,
  Mail,
} from "lucide-react";
import {
  EDITOR_ALLOWED_TRANSITIONS,
  type ScanStatus,
  type SubmissionStatus,
} from "@colophony/types";
import { ReadOnlyFormFields } from "./form-renderer/read-only-form-fields";

interface SubmissionDetailProps {
  submissionId: string;
  backHref?: string;
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

export function SubmissionDetail({
  submissionId,
  backHref = "/submissions",
}: SubmissionDetailProps) {
  const router = useRouter();
  const { user, isEditor, isAdmin } = useOrganization();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showWithdrawDialog, setShowWithdrawDialog] = useState(false);
  const [showComposeDialog, setShowComposeDialog] = useState(false);
  const utils = trpc.useUtils();

  const { data: submission, isPending: isLoading } =
    trpc.submissions.getById.useQuery({
      id: submissionId,
    });

  // v2: listByManuscriptVersion (files belong to manuscript versions)
  const { data: files } = trpc.files.listByManuscriptVersion.useQuery(
    { manuscriptVersionId: submission?.manuscriptVersionId ?? "" },
    { enabled: !!submission?.manuscriptVersionId },
  );

  const { data: history } = trpc.submissions.getHistory.useQuery({
    submissionId,
  });

  const deleteMutation = trpc.submissions.delete.useMutation({
    onSuccess: () => {
      toast.success("Submission deleted");
      router.push(backHref);
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });

  const withdrawMutation = trpc.submissions.withdraw.useMutation({
    onSuccess: () => {
      toast.success("Submission withdrawn");
      utils.submissions.getById.invalidate({ id: submissionId });
      utils.submissions.getHistory.invalidate({ submissionId });
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });

  const handleDownload = async (fileId: string) => {
    try {
      const { url } = await utils.files.getDownloadUrl.fetch({ fileId });
      window.open(url, "_blank");
    } catch {
      toast.error("Failed to get download link");
    }
  };

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
        <Link href={backHref}>
          <Button variant="link">Back to submissions</Button>
        </Link>
      </div>
    );
  }

  const isOwner = user?.id === submission.submitterId;
  const canEdit = isOwner && submission.status === "DRAFT";
  const canDelete = isOwner && submission.status === "DRAFT";
  const canWithdraw =
    isOwner &&
    ["SUBMITTED", "UNDER_REVIEW", "HOLD", "REVISE_AND_RESUBMIT"].includes(
      submission.status,
    );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <Link
            href={backHref}
            className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="mr-1 h-4 w-4" />
            Back to submissions
          </Link>
          <h1 className="text-2xl font-bold">{submission.title}</h1>
          <div className="flex items-center gap-2">
            <StatusBadge status={submission.status as SubmissionStatus} />
            <span className="text-sm text-muted-foreground">
              Created{" "}
              {formatDistanceToNow(new Date(submission.createdAt), {
                addSuffix: true,
              })}
            </span>
          </div>
        </div>

        <div className="flex gap-2">
          {canEdit && (
            <Link href={`/submissions/${submissionId}/edit`}>
              <Button variant="outline">
                <Edit className="mr-2 h-4 w-4" />
                Edit
              </Button>
            </Link>
          )}
          {canWithdraw && (
            <Button
              variant="outline"
              onClick={() => setShowWithdrawDialog(true)}
            >
              Withdraw
            </Button>
          )}
          {canDelete && (
            <Button
              variant="destructive"
              onClick={() => setShowDeleteDialog(true)}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete
            </Button>
          )}
        </div>
      </div>

      {/* Editor status transitions */}
      {(isEditor || isAdmin) &&
        EDITOR_ALLOWED_TRANSITIONS[submission.status as SubmissionStatus]
          ?.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Editor Actions</CardTitle>
              <CardDescription>
                Change the status of this submission
              </CardDescription>
            </CardHeader>
            <CardContent>
              <StatusTransition
                submissionId={submissionId}
                currentStatus={submission.status as SubmissionStatus}
              />
              <div className="mt-4 pt-4 border-t">
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => setShowComposeDialog(true)}
                >
                  <Mail className="mr-2 h-4 w-4" />
                  Send Message
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

      {/* Revise and Resubmit card — shown to owner when in R&R status */}
      {isOwner &&
        submission.status === "REVISE_AND_RESUBMIT" &&
        submission.manuscript && (
          <ReviseAndResubmitCard
            submissionId={submissionId}
            manuscriptId={submission.manuscript.manuscriptId}
            revisionNotes={
              history
                ?.filter((h) => h.toStatus === "REVISE_AND_RESUBMIT")
                .at(-1)?.comment ?? null
            }
          />
        )}

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

          {/* Custom form fields */}
          {submission.formDefinitionId && (
            <ReadOnlyFormFields
              formDefinitionId={submission.formDefinitionId}
              formData={(submission.formData as Record<string, unknown>) ?? {}}
            />
          )}

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

          {/* Linked manuscript */}
          {submission.manuscript && (
            <Card>
              <CardHeader>
                <CardTitle>Linked Manuscript</CardTitle>
              </CardHeader>
              <CardContent>
                <Link
                  href={`/manuscripts/${submission.manuscript.manuscriptId}`}
                  className="flex items-center gap-3 p-3 border rounded-lg hover:bg-accent transition-colors"
                >
                  <BookOpen className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {submission.manuscript.manuscriptTitle}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Version {submission.manuscript.versionNumber}
                    </p>
                  </div>
                </Link>
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
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDownload(file.id)}
                          >
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

          <PluginSlot
            point="submission.detail.section"
            context={{ submissionId: submission.id }}
            className="space-y-4"
          />
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
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
                          <span className="text-sm">
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
                          </span>
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

          {(isEditor || isAdmin) && (
            <CorrespondenceHistory submissionId={submissionId} />
          )}
        </div>
      </div>

      {/* Compose message dialog */}
      <ComposeMessageDialog
        open={showComposeDialog}
        onOpenChange={setShowComposeDialog}
        submissionId={submissionId}
        submissionTitle={submission.title ?? "Untitled"}
      />

      {/* Delete confirmation dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete submission?</DialogTitle>
            <DialogDescription>
              This action cannot be undone. This will permanently delete your
              submission and all associated files.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowDeleteDialog(false)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                deleteMutation.mutate({ id: submissionId });
                setShowDeleteDialog(false);
              }}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Withdraw confirmation dialog */}
      <Dialog open={showWithdrawDialog} onOpenChange={setShowWithdrawDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Withdraw submission?</DialogTitle>
            <DialogDescription>
              This will withdraw your submission from consideration. You will
              not be able to resubmit this submission.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowWithdrawDialog(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                withdrawMutation.mutate({ id: submissionId });
                setShowWithdrawDialog(false);
              }}
              disabled={withdrawMutation.isPending}
            >
              {withdrawMutation.isPending ? "Withdrawing..." : "Withdraw"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
