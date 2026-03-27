"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { Users, X } from "lucide-react";
import type { SubmissionStatus } from "@colophony/types";

const DESTRUCTIVE_STATUSES = new Set<SubmissionStatus>([
  "REJECTED",
  "ACCEPTED",
]);

interface BatchActionBarProps {
  selectedCount: number;
  selectedIds: string[];
  statusFilter: SubmissionStatus | "ALL";
  onClear: () => void;
  onSuccess: () => void;
}

/**
 * Returns context-aware status transition buttons based on the current filter.
 */
function getAvailableStatusActions(
  statusFilter: SubmissionStatus | "ALL",
): Array<{
  status: SubmissionStatus;
  label: string;
  variant: "default" | "destructive" | "outline";
}> {
  switch (statusFilter) {
    case "SUBMITTED":
      return [
        { status: "UNDER_REVIEW", label: "Move to Review", variant: "default" },
        { status: "REJECTED", label: "Reject", variant: "destructive" },
      ];
    case "UNDER_REVIEW":
      return [
        { status: "ACCEPTED", label: "Accept", variant: "default" },
        { status: "REJECTED", label: "Reject", variant: "destructive" },
        { status: "HOLD", label: "Hold", variant: "outline" },
        { status: "REVISE_AND_RESUBMIT", label: "R&R", variant: "outline" },
      ];
    case "HOLD":
      return [
        { status: "UNDER_REVIEW", label: "Move to Review", variant: "default" },
        { status: "ACCEPTED", label: "Accept", variant: "default" },
        { status: "REJECTED", label: "Reject", variant: "destructive" },
        { status: "REVISE_AND_RESUBMIT", label: "R&R", variant: "outline" },
      ];
    case "ALL":
      return [{ status: "REJECTED", label: "Reject", variant: "destructive" }];
    default:
      return [];
  }
}

export function BatchActionBar({
  selectedCount,
  selectedIds,
  statusFilter,
  onClear,
  onSuccess,
}: BatchActionBarProps) {
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [selectedReviewers, setSelectedReviewers] = useState<Set<string>>(
    new Set(),
  );
  const [pendingAction, setPendingAction] = useState<{
    status: SubmissionStatus;
    label: string;
  } | null>(null);

  const utils = trpc.useUtils();

  const batchStatusMutation = trpc.submissions.batchUpdateStatus.useMutation({
    onSuccess: (result) => {
      const total = result.succeeded.length + result.failed.length;
      if (result.failed.length === 0) {
        toast.success(`Updated ${result.succeeded.length} submissions`);
      } else {
        toast.warning(
          `${result.succeeded.length} of ${total} updated. ${result.failed.length} failed.`,
        );
      }
      utils.submissions.list.invalidate();
      onSuccess();
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });

  const batchAssignMutation = trpc.submissions.batchAssignReviewers.useMutation(
    {
      onSuccess: (result) => {
        const total = result.succeeded.length + result.failed.length;
        if (result.failed.length === 0) {
          toast.success(
            `Assigned reviewers to ${result.succeeded.length} submissions`,
          );
        } else {
          toast.warning(
            `${result.succeeded.length} of ${total} assigned. ${result.failed.length} failed.`,
          );
        }
        setAssignDialogOpen(false);
        setSelectedReviewers(new Set());
        utils.submissions.list.invalidate();
        onSuccess();
      },
      onError: (err) => {
        toast.error(err.message);
      },
    },
  );

  const { data: membersData } = trpc.organizations.members.list.useQuery(
    { page: 1, limit: 100 },
    { enabled: assignDialogOpen },
  );

  const statusActions = getAvailableStatusActions(statusFilter);
  const isMutating =
    batchStatusMutation.isPending || batchAssignMutation.isPending;

  if (selectedCount === 0) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 border-t bg-background p-4 shadow-lg">
      <div className="mx-auto flex max-w-screen-xl items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium">{selectedCount} selected</span>
          <Button variant="ghost" size="sm" onClick={onClear}>
            <X className="mr-1 h-3 w-3" />
            Clear
          </Button>
        </div>

        <div className="flex items-center gap-2">
          {statusActions.map((action) => (
            <Button
              key={action.status}
              variant={action.variant}
              size="sm"
              disabled={isMutating}
              onClick={() => {
                if (DESTRUCTIVE_STATUSES.has(action.status)) {
                  setPendingAction({
                    status: action.status,
                    label: action.label,
                  });
                } else {
                  batchStatusMutation.mutate({
                    submissionIds: selectedIds,
                    status: action.status,
                  });
                }
              }}
            >
              {action.label}
            </Button>
          ))}

          <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" disabled={isMutating}>
                <Users className="mr-1 h-3 w-3" />
                Assign Reviewers
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Assign Reviewers</DialogTitle>
                <DialogDescription>
                  Select reviewers to assign to {selectedCount} submission
                  {selectedCount !== 1 ? "s" : ""}.
                </DialogDescription>
              </DialogHeader>

              <div className="max-h-60 space-y-2 overflow-y-auto py-2">
                {membersData?.items.map((member) => (
                  <label
                    key={member.userId}
                    className="flex items-center gap-3 rounded-md p-2 hover:bg-muted cursor-pointer"
                  >
                    <Checkbox
                      checked={selectedReviewers.has(member.userId)}
                      disabled={
                        !selectedReviewers.has(member.userId) &&
                        selectedReviewers.size >= 20
                      }
                      onCheckedChange={(checked) => {
                        setSelectedReviewers((prev) => {
                          const next = new Set(prev);
                          if (checked && next.size < 20) {
                            next.add(member.userId);
                          } else if (!checked) {
                            next.delete(member.userId);
                          }
                          return next;
                        });
                      }}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {member.email}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {member.roles[0]}
                      </p>
                    </div>
                  </label>
                ))}
              </div>

              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setAssignDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  disabled={
                    selectedReviewers.size === 0 ||
                    batchAssignMutation.isPending
                  }
                  onClick={() =>
                    batchAssignMutation.mutate({
                      submissionIds: selectedIds,
                      reviewerUserIds: [...selectedReviewers],
                    })
                  }
                >
                  Assign ({selectedReviewers.size})
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <AlertDialog
            open={pendingAction !== null}
            onOpenChange={(open) => {
              if (!open) setPendingAction(null);
            }}
          >
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>
                  {pendingAction?.label} {selectedCount} submission
                  {selectedCount !== 1 ? "s" : ""}?
                </AlertDialogTitle>
                <AlertDialogDescription>
                  This action will {pendingAction?.label.toLowerCase()}{" "}
                  {selectedCount} submission
                  {selectedCount !== 1 ? "s" : ""}. This cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  onClick={() => {
                    if (pendingAction) {
                      batchStatusMutation.mutate({
                        submissionIds: selectedIds,
                        status: pendingAction.status,
                      });
                    }
                    setPendingAction(null);
                  }}
                >
                  Confirm
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
    </div>
  );
}
