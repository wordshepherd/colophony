"use client";

import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useDensity } from "@/hooks/use-density";
import { cn } from "@/lib/utils";
import type { WriterStatus } from "@colophony/types";
import {
  Ban,
  CheckCircle,
  Eye,
  FileEdit,
  MessageCircle,
  RotateCcw,
  Send,
} from "lucide-react";

const writerStatusConfig: Record<
  WriterStatus,
  {
    className: string;
    icon: React.ComponentType<{ className?: string }>;
  }
> = {
  DRAFT: {
    className: "bg-status-info/10 text-status-info",
    icon: FileEdit,
  },
  RECEIVED: {
    className: "bg-status-info/10 text-status-info",
    icon: Send,
  },
  IN_REVIEW: {
    className: "bg-status-info/10 text-status-info",
    icon: Eye,
  },
  REVISION_REQUESTED: {
    className: "bg-status-warning/10 text-status-warning",
    icon: RotateCcw,
  },
  ACCEPTED: {
    className: "bg-status-success/10 text-status-success",
    icon: CheckCircle,
  },
  DECISION_SENT: {
    className: "bg-status-info/10 text-status-info",
    icon: MessageCircle,
  },
  WITHDRAWN: {
    className: "bg-status-held/10 text-status-held",
    icon: Ban,
  },
};

interface WriterStatusBadgeProps {
  status: WriterStatus;
  label: string;
  className?: string;
}

export function WriterStatusBadge({
  status,
  label,
  className,
}: WriterStatusBadgeProps) {
  const { isCompact } = useDensity();
  const config = writerStatusConfig[status];
  const Icon = config.icon;

  const badge = (
    <Badge
      variant="secondary"
      className={cn("gap-1", config.className, className)}
    >
      <Icon className="h-3 w-3" />
      {!isCompact && label}
    </Badge>
  );

  if (isCompact) {
    return (
      <TooltipProvider delayDuration={200}>
        <Tooltip>
          <TooltipTrigger asChild>{badge}</TooltipTrigger>
          <TooltipContent>{label}</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return badge;
}

/** Re-export the config for use in embed status check (icon/color by enum). */
export { writerStatusConfig };
