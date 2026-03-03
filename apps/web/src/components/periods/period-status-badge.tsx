"use client";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { PeriodStatus } from "@colophony/types";
import { CheckCircle, Clock, Lock } from "lucide-react";

const statusConfig: Record<
  PeriodStatus,
  {
    label: string;
    className: string;
    icon: React.ComponentType<{ className?: string }>;
  }
> = {
  UPCOMING: {
    label: "Upcoming",
    className: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200",
    icon: Clock,
  },
  OPEN: {
    label: "Open",
    className:
      "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
    icon: CheckCircle,
  },
  CLOSED: {
    label: "Closed",
    className:
      "bg-gray-50 text-gray-500 dark:bg-gray-900 dark:text-gray-400 border-gray-200 dark:border-gray-700",
    icon: Lock,
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
  const Icon = config.icon;

  return (
    <Badge
      variant={status === "CLOSED" ? "outline" : "secondary"}
      className={cn("gap-1", config.className, className)}
    >
      <Icon className="h-3 w-3" />
      {config.label}
    </Badge>
  );
}
