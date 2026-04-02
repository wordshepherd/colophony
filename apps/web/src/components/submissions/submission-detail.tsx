"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { formatDistanceToNow, format } from "date-fns";
import { trpc } from "@/lib/trpc";
import { useOrganization } from "@/hooks/use-organization";
import { StatusBadge } from "./status-badge";
import { WriterStatusBadge } from "./writer-status-badge";
import { StatusTransition } from "./status-transition";
import { ReviseAndResubmitCard } from "./revise-and-resubmit-card";
import { ComposeMessageDialog } from "./compose-message-dialog";
import { CorrespondenceHistory } from "./correspondence-history";
import { ReviewerList } from "./reviewer-list";
import { ReviewerPicker } from "./reviewer-picker";
import { DiscussionThread } from "./discussion-thread";
import { VotingPanel } from "./voting-panel";
import { ReaderFeedbackPanel } from "./reader-feedback-panel";
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
  ArrowRight,
  File,
  Download,
  Clock,
  CheckCircle,
  AlertCircle,
  Loader2,
  BookOpen,
  Mail,
  MessageSquare,
} from "lucide-react";
import {
  EDITOR_ALLOWED_TRANSITIONS,
  votingConfigSchema,
  type ScanStatus,
  type SubmissionStatus,
} from "@colophony/types";
import { ReadOnlyFormFields } from "./form-renderer/read-only-form-fields";
import { SimSubConflictDisplay } from "./sim-sub-conflict-display";

interface SubmissionDetailProps {
  submissionId: string;
  backHref?: string;
  queueIds?: string[];
  queueIdx?: number;
  /** When true, hides back link, queue nav, and reading mode toggle (split pane manages those) */
  embedded?: boolean;
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

function buildQueueHref(id: string, ids: string[], idx: number): string {
  const params = new URLSearchParams({
    queue: ids.join(","),
    idx: String(idx),
  });
  return `/editor/${id}?${params.toString()}`;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function SubmissionDetail({
  submissionId,
  backHref = "/submissions",
  queueIds,
  queueIdx,
  embedded = false,
}: SubmissionDetailProps) {
  const router = useRouter();
  const { user, isEditor, isAdmin } = useOrganization();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showWithdrawDialog, setShowWithdrawDialog] = useState(false);
  const [showComposeDialog, setShowComposeDialog] = useState(false);
  const [showWithdrawCascadeDialog, setShowWithdrawCascadeDialog] =
    useState(false);
  const [isReadingMode, setIsReadingMode] = useState(false);
  const utils = trpc.useUtils();

  // Editors use getById (full internal status); writers use mySubmissionDetail (projected status)
  const isEditorView = isEditor || isAdmin;

  const { data: editorSubmission, isPending: isEditorLoading } =
    trpc.submissions.getById.useQuery(
      { id: submissionId },
      { enabled: isEditorView },
    );

  const { data: writerSubmission, isPending: isWriterLoading } =
    trpc.submissions.mySubmissionDetail.useQuery(
      { id: submissionId },
      { enabled: !isEditorView },
    );

  const submission = isEditorView ? editorSubmission : writerSubmission;
  const isLoading = isEditorView ? isEditorLoading : isWriterLoading;

  // v2: listByManuscriptVersion (files belong to manuscript versions)
  const { data: files } = trpc.files.listByManuscriptVersion.useQuery(
    { manuscriptVersionId: submission?.manuscriptVersionId ?? "" },
    { enabled: !!submission?.manuscriptVersionId },
  );

  const { data: history } = trpc.submissions.getHistory.useQuery({
    submissionId,
  });

  const { data: reviewers } = trpc.submissions.listReviewers.useQuery({
    submissionId,
  });

  const { data: org } = trpc.organizations.get.useQuery();
  const votingConfig = votingConfigSchema.parse(
    (org?.settings as Record<string, unknown>) ?? {},
  );

  const markReadMutation = trpc.submissions.markReviewerRead.useMutation();

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
      utils.submissions.mySubmissionDetail.invalidate({ id: submissionId });
      utils.submissions.getHistory.invalidate({ submissionId });
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });

  // Sibling submissions for withdrawal cascade (only when owner + accepted)
  const submissionStatus =
    submission && "status" in submission ? submission.status : undefined;
  const submissionWriterStatus =
    submission && "writerStatus" in submission
      ? submission.writerStatus
      : undefined;
  const isSubmissionAccepted =
    submissionStatus === "ACCEPTED" || submissionWriterStatus === "ACCEPTED";
  const isSubmissionOwner = !!(user && submission?.submitterId === user.id);

  const { data: siblingsData } = trpc.submissions.findSiblings.useQuery(
    { id: submissionId },
    { enabled: isSubmissionOwner && isSubmissionAccepted },
  );

  const withdrawCascadeMutation = trpc.submissions.withdrawCascade.useMutation({
    onSuccess: (result) => {
      const count = result.withdrawn.length;
      toast.success(
        `Withdrawn from ${count} magazine${count !== 1 ? "s" : ""}`,
      );
      utils.submissions.findSiblings.invalidate({ id: submissionId });
      utils.submissions.mySubmissions.invalidate();
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });

  // Mark submission as read when a non-owner views it (fire-and-forget, idempotent)
  useEffect(() => {
    if (submission && user && user.id !== submission.submitterId) {
      markReadMutation.mutate({ submissionId });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [submission?.id, user?.id]);

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
  // Writer submissions have writerStatus; editor submissions have status
  const effectiveStatus =
    "status" in submission ? submission.status : undefined;
  const effectiveWriterStatus =
    "writerStatus" in submission ? submission.writerStatus : undefined;
  const canEdit =
    isOwner &&
    (effectiveStatus === "DRAFT" || effectiveWriterStatus === "DRAFT");
  const canDelete = canEdit;
  const canWithdraw =
    isOwner &&
    (effectiveStatus
      ? ["SUBMITTED", "UNDER_REVIEW", "HOLD", "REVISE_AND_RESUBMIT"].includes(
          effectiveStatus,
        )
      : effectiveWriterStatus === "RECEIVED" ||
        effectiveWriterStatus === "IN_REVIEW" ||
        effectiveWriterStatus === "REVISION_REQUESTED");

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          {!embedded && (
            <Link
              href={backHref}
              className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="mr-1 h-4 w-4" />
              Back to submissions
            </Link>
          )}
          <h1 className={embedded ? "text-lg font-bold" : "text-2xl font-bold"}>
            {submission.title}
          </h1>
          <div className="flex items-center gap-2">
            {"writerStatus" in submission ? (
              <WriterStatusBadge
                status={submission.writerStatus}
                label={submission.writerStatusLabel}
              />
            ) : (
              <StatusBadge status={submission.status as SubmissionStatus} />
            )}
            <span className="text-sm text-muted-foreground">
              Created{" "}
              {formatDistanceToNow(new Date(submission.createdAt), {
                addSuffix: true,
              })}
            </span>
          </div>
        </div>

        <div className="flex gap-2">
          {!embedded && (isEditor || isAdmin) && (
            <Button
              variant={isReadingMode ? "default" : "outline"}
              size="icon"
              onClick={() => setIsReadingMode((prev) => !prev)}
              aria-pressed={isReadingMode}
              aria-label="Toggle reading mode"
            >
              <BookOpen className="h-4 w-4" />
            </Button>
          )}
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

      {/* Sim-sub policy requirement notice */}
      {submission.simSubPolicyRequirement && (
        <SimSubConflictDisplay
          policyRequirement={
            submission.simSubPolicyRequirement as {
              type: "notify" | "withdraw";
              windowHours?: number;
              acknowledgedAt?: string;
              dueAt?: string;
            }
          }
        />
      )}

      {/* Withdrawal cascade — shown to owner when accepted with active siblings */}
      {isOwner &&
        isSubmissionAccepted &&
        siblingsData &&
        siblingsData.siblings.length > 0 && (
          <Card className="border-status-success/30 bg-status-success/5">
            <CardContent className="pt-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-medium">
                    This piece is still pending at{" "}
                    {siblingsData.siblings.length} other magazine
                    {siblingsData.siblings.length !== 1 ? "s" : ""}
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">
                    {siblingsData.siblings
                      .map((s) => s.organizationName)
                      .join(", ")}
                  </p>
                </div>
                <Button
                  variant="outline"
                  onClick={() => setShowWithdrawCascadeDialog(true)}
                >
                  Withdraw other submissions
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

      {/* Queue navigation — hidden when embedded in split pane */}
      {!embedded && queueIds && queueIds.length > 0 && queueIdx != null && (
        <div className="flex items-center justify-between rounded-lg border p-2">
          <Button
            variant="ghost"
            size="sm"
            disabled={queueIdx <= 0}
            onClick={() => {
              const prevIdx = queueIdx - 1;
              router.push(buildQueueHref(queueIds[prevIdx], queueIds, prevIdx));
            }}
          >
            <ArrowLeft className="mr-1 h-4 w-4" />
            Previous
          </Button>
          <span className="text-sm text-muted-foreground">
            {queueIdx + 1} of {queueIds.length}
          </span>
          <Button
            variant="ghost"
            size="sm"
            disabled={queueIdx >= queueIds.length - 1}
            onClick={() => {
              const nextIdx = queueIdx + 1;
              router.push(buildQueueHref(queueIds[nextIdx], queueIds, nextIdx));
            }}
          >
            Next
            <ArrowRight className="ml-1 h-4 w-4" />
          </Button>
        </div>
      )}

      {/* Editor status transitions — hidden in reading mode */}
      {!isReadingMode &&
        (isEditor || isAdmin) &&
        effectiveStatus &&
        EDITOR_ALLOWED_TRANSITIONS[effectiveStatus]?.length > 0 && (
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
                currentStatus={effectiveStatus}
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

      {/* Revise and Resubmit card — shown to owner when in R&R status, hidden in reading mode */}
      {!isReadingMode &&
        isOwner &&
        (effectiveStatus === "REVISE_AND_RESUBMIT" ||
          effectiveWriterStatus === "REVISION_REQUESTED") &&
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

      {/* Reviewers — hidden in reading mode */}
      {!isReadingMode && (isEditor || isAdmin || isOwner) && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Reviewers</CardTitle>
                <CardDescription>
                  Assigned reviewers and read status
                </CardDescription>
              </div>
              {(isEditor || isAdmin) && (
                <ReviewerPicker
                  submissionId={submissionId}
                  existingReviewerIds={
                    reviewers?.map((r) => r.reviewerUserId) ?? []
                  }
                />
              )}
            </div>
          </CardHeader>
          <CardContent>
            <ReviewerList submissionId={submissionId} />
          </CardContent>
        </Card>
      )}

      {/* Internal Discussion — hidden in reading mode */}
      {!isReadingMode &&
        (isEditor ||
          isAdmin ||
          (reviewers ?? []).some((r) => r.reviewerUserId === user?.id)) &&
        !isOwner && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5" />
                Internal Discussion
              </CardTitle>
              <CardDescription>
                Visible to editors, admins, and assigned reviewers only.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <DiscussionThread submissionId={submissionId} />
            </CardContent>
          </Card>
        )}

      {/* Voting — hidden in reading mode */}
      {!isReadingMode &&
        (isEditor ||
          isAdmin ||
          (reviewers ?? []).some((r) => r.reviewerUserId === user?.id)) &&
        !isOwner &&
        effectiveStatus !== "DRAFT" &&
        effectiveWriterStatus !== "DRAFT" && (
          <VotingPanel
            submissionId={submissionId}
            votingEnabled={votingConfig.votingEnabled}
            scoringEnabled={votingConfig.scoringEnabled}
            scoreMin={votingConfig.scoreMin}
            scoreMax={votingConfig.scoreMax}
          />
        )}

      {/* Reader Feedback — hidden in reading mode */}
      {!isReadingMode &&
        (isEditor ||
          isAdmin ||
          (reviewers ?? []).some((r) => r.reviewerUserId === user?.id)) &&
        !isOwner &&
        effectiveStatus !== "DRAFT" &&
        effectiveWriterStatus !== "DRAFT" && (
          <ReaderFeedbackPanel submissionId={submissionId} />
        )}

      {/* Content */}
      <div
        className={
          !embedded && isReadingMode
            ? "max-w-3xl mx-auto space-y-6"
            : embedded
              ? "space-y-6"
              : "grid gap-6 md:grid-cols-3"
        }
      >
        <div
          className={
            !embedded && isReadingMode
              ? "space-y-6"
              : embedded
                ? "space-y-6"
                : "md:col-span-2 space-y-6"
          }
        >
          {/* Main content */}
          <Card>
            <CardHeader>
              <CardTitle>Content</CardTitle>
            </CardHeader>
            <CardContent>
              {submission.content ? (
                <div
                  className={
                    isReadingMode
                      ? "prose prose-sm max-w-none leading-relaxed text-base"
                      : "whitespace-pre-wrap text-sm"
                  }
                >
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
                <div
                  className={
                    isReadingMode
                      ? "prose prose-sm max-w-none leading-relaxed text-base"
                      : "whitespace-pre-wrap text-sm"
                  }
                >
                  {submission.coverLetter}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Linked manuscript — hidden in reading mode */}
          {!isReadingMode && submission.manuscript && (
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
        </div>

        {/* Sidebar — hidden in reading mode and embedded mode */}
        {!embedded && !isReadingMode && (
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
                  <p className="text-sm text-muted-foreground">
                    No history yet
                  </p>
                )}
              </CardContent>
            </Card>

            {(isEditor || isAdmin) && (
              <CorrespondenceHistory submissionId={submissionId} />
            )}
          </div>
        )}
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

      {/* Withdraw cascade dialog — withdraw from all other magazines */}
      <Dialog
        open={showWithdrawCascadeDialog}
        onOpenChange={setShowWithdrawCascadeDialog}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Withdraw other submissions?</DialogTitle>
            <DialogDescription>
              This will withdraw your submission from the following magazine
              {(siblingsData?.siblings.length ?? 0) !== 1 ? "s" : ""}. A
              courteous withdrawal note will be sent.
            </DialogDescription>
          </DialogHeader>
          {siblingsData && siblingsData.siblings.length > 0 && (
            <div className="space-y-2 py-2">
              {siblingsData.siblings.map((sib) => (
                <div
                  key={sib.id}
                  className="flex items-center justify-between rounded-lg border p-3"
                >
                  <span className="text-sm font-medium">
                    {sib.organizationName}
                  </span>
                  <Badge variant="secondary" className="text-xs">
                    {sib.status.replace(/_/g, " ")}
                  </Badge>
                </div>
              ))}
              <div className="mt-3 rounded-lg bg-muted p-3">
                <p className="text-xs text-muted-foreground italic">
                  &ldquo;This piece has been accepted elsewhere. Thank you for
                  your consideration.&rdquo;
                </p>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowWithdrawCascadeDialog(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                withdrawCascadeMutation.mutate({ id: submissionId });
                setShowWithdrawCascadeDialog(false);
              }}
              disabled={withdrawCascadeMutation.isPending}
            >
              {withdrawCascadeMutation.isPending
                ? "Withdrawing..."
                : `Withdraw from ${siblingsData?.siblings.length ?? 0} magazine${(siblingsData?.siblings.length ?? 0) !== 1 ? "s" : ""}`}
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
