"use client";

import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import {
  EDITOR_ALLOWED_TRANSITIONS,
  orgSettingsSchema,
  type SubmissionStatus,
} from "@colophony/types";

interface StatusTransitionProps {
  submissionId: string;
  currentStatus: SubmissionStatus;
  onStatusChange?: () => void;
}

const statusLabels: Record<SubmissionStatus, string> = {
  DRAFT: "Draft",
  SUBMITTED: "Submitted",
  UNDER_REVIEW: "Under Review",
  ACCEPTED: "Accept",
  REJECTED: "Reject",
  HOLD: "Put on Hold",
  REVISE_AND_RESUBMIT: "Request Revisions",
  WITHDRAWN: "Withdrawn",
};

const statusButtonVariants: Record<
  SubmissionStatus,
  "default" | "secondary" | "destructive" | "outline"
> = {
  DRAFT: "outline",
  SUBMITTED: "outline",
  UNDER_REVIEW: "secondary",
  ACCEPTED: "default",
  REJECTED: "destructive",
  HOLD: "outline",
  REVISE_AND_RESUBMIT: "outline",
  WITHDRAWN: "outline",
};

export function StatusTransition({
  submissionId,
  currentStatus,
  onStatusChange,
}: StatusTransitionProps) {
  const [selectedStatus, setSelectedStatus] = useState<SubmissionStatus | null>(
    null,
  );
  const [comment, setComment] = useState("");
  const [includeFeedback, setIncludeFeedback] = useState(false);
  const utils = trpc.useUtils();

  // Feedback-on-rejection: check org settings and fetch includable feedback
  const { data: orgData } = trpc.organizations.get.useQuery(undefined, {
    enabled: selectedStatus === "REJECTED",
  });

  const feedbackOnRejectionEnabled = useMemo(() => {
    if (!orgData?.settings) return false;
    const parsed = orgSettingsSchema.safeParse(orgData.settings);
    return parsed.success ? parsed.data.feedbackOnRejectionEnabled : false;
  }, [orgData]);

  const { data: includableFeedback } =
    trpc.readerFeedback.listIncludable.useQuery(
      { submissionId },
      {
        enabled: selectedStatus === "REJECTED" && feedbackOnRejectionEnabled,
      },
    );

  const updateStatusMutation = trpc.submissions.updateStatus.useMutation({
    onSuccess: () => {
      toast.success(`Status updated to ${statusLabels[selectedStatus!]}`);
      utils.submissions.getById.invalidate({ id: submissionId });
      utils.submissions.getHistory.invalidate({ submissionId });
      utils.submissions.list.invalidate();
      setSelectedStatus(null);
      setComment("");
      onStatusChange?.();
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });

  const allowedTransitions = EDITOR_ALLOWED_TRANSITIONS[currentStatus];

  if (allowedTransitions.length === 0) {
    return null;
  }

  const handleConfirm = () => {
    if (!selectedStatus) return;

    // v2: flattened input — { id, status, comment } instead of { id, data: { status, comment } }
    updateStatusMutation.mutate({
      id: submissionId,
      status: selectedStatus,
      comment: comment || undefined,
      includeFeedback:
        selectedStatus === "REJECTED" && includeFeedback ? true : undefined,
    });
  };

  return (
    <>
      <div className="flex flex-wrap gap-2">
        {allowedTransitions.map((status) => {
          const isDecision =
            status === "ACCEPTED" || status === "REJECTED" || status === "HOLD";
          return (
            <Button
              key={status}
              variant={statusButtonVariants[status]}
              onClick={() => setSelectedStatus(status)}
              className={
                isDecision
                  ? "[font-family:var(--font-playfair),ui-serif,Georgia,serif] italic font-bold"
                  : undefined
              }
            >
              {statusLabels[status]}
            </Button>
          );
        })}
      </div>

      <Dialog
        open={selectedStatus !== null}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedStatus(null);
            setComment("");
            setIncludeFeedback(false);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {selectedStatus === "REJECTED"
                ? "Reject Submission"
                : selectedStatus === "ACCEPTED"
                  ? "Accept Submission"
                  : selectedStatus === "REVISE_AND_RESUBMIT"
                    ? "Request Revisions"
                    : `Change Status to ${selectedStatus ? statusLabels[selectedStatus] : ""}`}
            </DialogTitle>
            <DialogDescription>
              {selectedStatus === "REJECTED"
                ? "This will reject the submission. Consider providing feedback."
                : selectedStatus === "ACCEPTED"
                  ? "This will accept the submission for publication."
                  : selectedStatus === "REVISE_AND_RESUBMIT"
                    ? "Provide revision notes for the submitter. They will be able to resubmit a new manuscript version."
                    : "Add an optional comment for this status change."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="comment">
                {selectedStatus === "REVISE_AND_RESUBMIT"
                  ? "Revision Notes (required)"
                  : "Comment (optional)"}
              </Label>
              <Textarea
                id="comment"
                placeholder={
                  selectedStatus === "REJECTED"
                    ? "Provide feedback for the submitter..."
                    : selectedStatus === "REVISE_AND_RESUBMIT"
                      ? "Describe the revisions needed..."
                      : "Add a note about this status change..."
                }
                value={comment}
                onChange={(e) => setComment(e.target.value)}
              />
            </div>

            {/* Feedback on rejection */}
            {selectedStatus === "REJECTED" &&
              feedbackOnRejectionEnabled &&
              includableFeedback &&
              includableFeedback.length > 0 && (
                <div className="space-y-3">
                  <Separator />
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="include-feedback">
                        Include reader feedback
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        Anonymized feedback will be included in the rejection
                        email.
                      </p>
                    </div>
                    <Switch
                      id="include-feedback"
                      checked={includeFeedback}
                      onCheckedChange={setIncludeFeedback}
                    />
                  </div>
                  {includeFeedback && (
                    <div className="space-y-2 rounded-md border p-3 bg-muted/50">
                      <p className="text-xs font-medium text-muted-foreground">
                        Preview (writer will see):
                      </p>
                      {includableFeedback.map((f) => (
                        <div
                          key={f.id}
                          className="border-l-2 border-muted-foreground/30 pl-3 space-y-1"
                        >
                          {(f.tags as string[]).length > 0 && (
                            <div className="flex gap-1 flex-wrap">
                              {(f.tags as string[]).map((tag) => (
                                <Badge key={tag} variant="secondary">
                                  {tag}
                                </Badge>
                              ))}
                            </div>
                          )}
                          {f.comment && <p className="text-sm">{f.comment}</p>}
                          {!f.forwardedAt && (
                            <p className="text-xs text-muted-foreground italic">
                              Will be auto-forwarded
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setSelectedStatus(null);
                setComment("");
                setIncludeFeedback(false);
              }}
            >
              Cancel
            </Button>
            <Button
              variant={
                selectedStatus === "REJECTED" ? "destructive" : "default"
              }
              onClick={handleConfirm}
              disabled={
                updateStatusMutation.isPending ||
                (selectedStatus === "REVISE_AND_RESUBMIT" && !comment.trim())
              }
            >
              {updateStatusMutation.isPending
                ? "Updating..."
                : `Confirm ${selectedStatus ? statusLabels[selectedStatus] : ""}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
