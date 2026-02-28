"use client";

import { useState } from "react";
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
import { toast } from "sonner";
import {
  EDITOR_ALLOWED_TRANSITIONS,
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
  const utils = trpc.useUtils();

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
    });
  };

  return (
    <>
      <div className="flex flex-wrap gap-2">
        {allowedTransitions.map((status) => (
          <Button
            key={status}
            variant={statusButtonVariants[status]}
            onClick={() => setSelectedStatus(status)}
          >
            {statusLabels[status]}
          </Button>
        ))}
      </div>

      <Dialog
        open={selectedStatus !== null}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedStatus(null);
            setComment("");
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
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setSelectedStatus(null);
                setComment("");
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
