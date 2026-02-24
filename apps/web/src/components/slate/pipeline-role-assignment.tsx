"use client";

import { useState } from "react";
import { z } from "zod";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";

interface PipelineRoleAssignmentProps {
  pipelineItemId: string;
  currentCopyeditorId: string | null;
  currentProofreaderId: string | null;
}

type RoleType = "copyeditor" | "proofreader";

export function PipelineRoleAssignment({
  pipelineItemId,
  currentCopyeditorId,
  currentProofreaderId,
}: PipelineRoleAssignmentProps) {
  const [assignRole, setAssignRole] = useState<RoleType | null>(null);
  const [userId, setUserId] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);
  const utils = trpc.useUtils();

  const copyeditorMutation = trpc.pipeline.assignCopyeditor.useMutation({
    onSuccess: () => {
      toast.success("Copyeditor assigned");
      closeDialog();
      utils.pipeline.getById.invalidate({ id: pipelineItemId });
      utils.pipeline.list.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const proofreaderMutation = trpc.pipeline.assignProofreader.useMutation({
    onSuccess: () => {
      toast.success("Proofreader assigned");
      closeDialog();
      utils.pipeline.getById.invalidate({ id: pipelineItemId });
      utils.pipeline.list.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const closeDialog = () => {
    setAssignRole(null);
    setUserId("");
    setValidationError(null);
  };

  const handleAssign = () => {
    const result = z.string().uuid().safeParse(userId.trim());
    if (!result.success) {
      setValidationError("Please enter a valid UUID");
      return;
    }

    const input = { id: pipelineItemId, userId: result.data };
    if (assignRole === "copyeditor") {
      copyeditorMutation.mutate(input);
    } else {
      proofreaderMutation.mutate(input);
    }
  };

  const isPending =
    copyeditorMutation.isPending || proofreaderMutation.isPending;

  return (
    <>
      <div className="space-y-3">
        {/* Copyeditor row */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">Copyeditor</p>
            <p className="text-xs text-muted-foreground font-mono">
              {currentCopyeditorId
                ? `${currentCopyeditorId.slice(0, 8)}\u2026`
                : "Unassigned"}
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setAssignRole("copyeditor")}
          >
            Assign
          </Button>
        </div>

        {/* Proofreader row */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">Proofreader</p>
            <p className="text-xs text-muted-foreground font-mono">
              {currentProofreaderId
                ? `${currentProofreaderId.slice(0, 8)}\u2026`
                : "Unassigned"}
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setAssignRole("proofreader")}
          >
            Assign
          </Button>
        </div>
      </div>

      <Dialog
        open={assignRole !== null}
        onOpenChange={(open) => !open && closeDialog()}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Assign{" "}
              {assignRole === "copyeditor" ? "Copyeditor" : "Proofreader"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-2">
            <Label htmlFor="user-id">User ID</Label>
            <Input
              id="user-id"
              placeholder="Enter user UUID..."
              value={userId}
              onChange={(e) => {
                setUserId(e.target.value);
                setValidationError(null);
              }}
            />
            {validationError && (
              <p className="text-sm text-destructive">{validationError}</p>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>
              Cancel
            </Button>
            <Button
              onClick={handleAssign}
              disabled={isPending || !userId.trim()}
            >
              {isPending ? "Assigning..." : "Assign"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
