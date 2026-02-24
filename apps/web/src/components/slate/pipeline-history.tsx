"use client";

import { formatDistanceToNow } from "date-fns";
import { trpc } from "@/lib/trpc";
import { PipelineStageBadge } from "./pipeline-stage-badge";
import { Skeleton } from "@/components/ui/skeleton";

interface PipelineHistoryProps {
  pipelineItemId: string;
}

export function PipelineHistory({ pipelineItemId }: PipelineHistoryProps) {
  const { data: history, isPending: isLoading } =
    trpc.pipeline.getHistory.useQuery({ id: pipelineItemId });

  if (isLoading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  if (!history || history.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">No history available.</p>
    );
  }

  return (
    <div className="relative space-y-0">
      {/* Connecting line */}
      <div className="absolute left-[7px] top-2 bottom-2 w-px bg-border" />

      {history.map((entry) => (
        <div key={entry.id} className="relative flex gap-3 pb-4 last:pb-0">
          {/* Dot marker */}
          <div className="relative z-10 mt-1.5 h-[15px] w-[15px] shrink-0 rounded-full border-2 border-border bg-background" />

          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex flex-wrap items-center gap-1.5 text-sm">
              {entry.fromStage ? (
                <>
                  <PipelineStageBadge stage={entry.fromStage} />
                  <span className="text-muted-foreground">&rarr;</span>
                  <PipelineStageBadge stage={entry.toStage} />
                </>
              ) : (
                <>
                  <span className="text-muted-foreground">
                    Entered pipeline
                  </span>
                  <PipelineStageBadge stage={entry.toStage} />
                </>
              )}
            </div>

            {entry.comment && (
              <p className="text-sm text-muted-foreground">{entry.comment}</p>
            )}

            <p className="text-xs text-muted-foreground">
              {entry.changedBy && (
                <span className="font-mono">
                  {entry.changedBy.slice(0, 8)}&hellip;{" "}
                </span>
              )}
              {formatDistanceToNow(new Date(entry.changedAt), {
                addSuffix: true,
              })}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
