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
    className: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
    icon: Circle,
  },
  RESOLVED: {
    label: "Resolved",
    className:
      "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
    icon: CheckCircle,
  },
  WITHDRAWN: {
    label: "Withdrawn",
    className: "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400",
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
