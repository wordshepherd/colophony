"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { PipelineStageBadge } from "./pipeline-stage-badge";
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
import { toast } from "sonner";
import { VALID_PIPELINE_TRANSITIONS } from "@colophony/types";
import type { PipelineStage } from "@colophony/types";

interface PipelineStageTransitionProps {
  pipelineItemId: string;
  currentStage: PipelineStage;
  onStageChange?: () => void;
}

function getButtonVariant(
  stage: PipelineStage,
): "default" | "secondary" | "destructive" {
  if (stage === "WITHDRAWN") return "destructive";
  if (stage === "READY_TO_PUBLISH" || stage === "PUBLISHED") return "default";
  return "secondary";
}

export function PipelineStageTransition({
  pipelineItemId,
  currentStage,
  onStageChange,
}: PipelineStageTransitionProps) {
  const [targetStage, setTargetStage] = useState<PipelineStage | null>(null);
  const [comment, setComment] = useState("");
  const utils = trpc.useUtils();

  const validTransitions = VALID_PIPELINE_TRANSITIONS[currentStage];

  const mutation = trpc.pipeline.updateStage.useMutation({
    onSuccess: () => {
      toast.success("Stage updated");
      setTargetStage(null);
      setComment("");
      utils.pipeline.getById.invalidate({ id: pipelineItemId });
      utils.pipeline.list.invalidate();
      utils.pipeline.getHistory.invalidate({ id: pipelineItemId });
      onStageChange?.();
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });

  // Terminal stages — no transitions available
  if (validTransitions.length === 0) {
    return null;
  }

  const handleConfirm = () => {
    if (!targetStage) return;
    mutation.mutate({
      id: pipelineItemId,
      stage: targetStage,
      comment: comment.trim() || undefined,
    });
  };

  return (
    <>
      <div className="flex flex-wrap gap-2">
        {validTransitions.map((stage) => (
          <Button
            key={stage}
            variant={getButtonVariant(stage)}
            size="sm"
            onClick={() => setTargetStage(stage)}
          >
            <PipelineStageBadge stage={stage} className="pointer-events-none" />
          </Button>
        ))}
      </div>

      <Dialog
        open={targetStage !== null}
        onOpenChange={(open) => {
          if (!open) {
            setTargetStage(null);
            setComment("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm stage transition</DialogTitle>
            <DialogDescription>
              Move this item from{" "}
              <PipelineStageBadge stage={currentStage} className="inline" /> to{" "}
              {targetStage && (
                <PipelineStageBadge stage={targetStage} className="inline" />
              )}
              ?
            </DialogDescription>
          </DialogHeader>

          <Textarea
            placeholder="Optional comment..."
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={3}
          />

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setTargetStage(null);
                setComment("");
              }}
            >
              Cancel
            </Button>
            <Button
              variant={targetStage ? getButtonVariant(targetStage) : "default"}
              onClick={handleConfirm}
              disabled={mutation.isPending}
            >
              {mutation.isPending ? "Updating..." : "Confirm"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
