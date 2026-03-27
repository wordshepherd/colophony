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
    className: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200",
    icon: FileEdit,
  },
  RECEIVED: {
    className: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
    icon: Send,
  },
  IN_REVIEW: {
    className:
      "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
    icon: Eye,
  },
  REVISION_REQUESTED: {
    className:
      "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
    icon: RotateCcw,
  },
  ACCEPTED: {
    className:
      "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
    icon: CheckCircle,
  },
  DECISION_SENT: {
    className:
      "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
    icon: MessageCircle,
  },
  WITHDRAWN: {
    className:
      "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
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
