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
    className: "bg-status-info/10 text-status-info",
    icon: Clock,
  },
  OPEN: {
    label: "Open",
    className: "bg-status-success/10 text-status-success",
    icon: CheckCircle,
  },
  CLOSED: {
    label: "Closed",
    className: "bg-status-info/10 text-status-info",
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
