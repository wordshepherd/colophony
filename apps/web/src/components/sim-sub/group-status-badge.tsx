"use client";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { SimsubGroupStatus } from "@colophony/types";
import { CheckCircle, Circle, XCircle } from "lucide-react";

const statusConfig: Record<
  SimsubGroupStatus,
  {
    label: string;
    className: string;
    icon: React.ComponentType<{ className?: string }>;
  }
> = {
  ACTIVE: {
    label: "Active",
    className: "bg-status-info/10 text-status-info",
    icon: Circle,
  },
  RESOLVED: {
    label: "Resolved",
    className: "bg-status-success/10 text-status-success",
    icon: CheckCircle,
  },
  WITHDRAWN: {
    label: "Withdrawn",
    className: "bg-status-held/10 text-status-held",
    icon: XCircle,
  },
};

interface GroupStatusBadgeProps {
  status: SimsubGroupStatus;
  className?: string;
}

export function GroupStatusBadge({ status, className }: GroupStatusBadgeProps) {
  const config = statusConfig[status];
  const Icon = config.icon;

  return (
    <Badge
      variant="secondary"
      className={cn("gap-1", config.className, className)}
    >
      <Icon className="h-3 w-3" />
      {config.label}
    </Badge>
  );
}
