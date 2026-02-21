"use client";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { PeriodStatus } from "@colophony/types";

const statusConfig: Record<PeriodStatus, { label: string; className: string }> =
  {
    UPCOMING: {
      label: "Upcoming",
      className:
        "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200",
    },
    OPEN: {
      label: "Open",
      className:
        "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
    },
    CLOSED: {
      label: "Closed",
      className:
        "bg-gray-50 text-gray-500 dark:bg-gray-900 dark:text-gray-400 border-gray-200 dark:border-gray-700",
    },
  };

interface PeriodStatusBadgeProps {
  status: PeriodStatus;
  className?: string;
}

export function PeriodStatusBadge({
  status,
  className,
}: PeriodStatusBadgeProps) {
  const config = statusConfig[status];

  return (
    <Badge
      variant={status === "CLOSED" ? "outline" : "secondary"}
      className={cn(config.className, className)}
    >
      {config.label}
    </Badge>
  );
}
