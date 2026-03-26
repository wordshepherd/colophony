"use client";

import { Button } from "@/components/ui/button";
import { ChevronRight } from "lucide-react";

interface QueueRailProps {
  currentIndex: number;
  totalCount: number;
  onExpand: () => void;
}

/**
 * Collapsed rail shown in deep-read mode.
 * Displays position indicator and expand button.
 */
export function QueueRail({
  currentIndex,
  totalCount,
  onExpand,
}: QueueRailProps) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 px-2 border-r bg-muted/30">
      <div className="text-center">
        <div className="text-sm font-medium tabular-nums">
          {currentIndex + 1}
        </div>
        <div className="text-xs text-muted-foreground">of {totalCount}</div>
      </div>
      <Button
        variant="ghost"
        size="icon"
        onClick={onExpand}
        aria-label="Expand queue list"
        className="h-7 w-7"
      >
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
}
