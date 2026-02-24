import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { IssueStatus } from "@colophony/types";

const statusConfig: Record<IssueStatus, { label: string; className: string }> =
  {
    PLANNING: {
      label: "Planning",
      className:
        "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
    },
    ASSEMBLING: {
      label: "Assembling",
      className:
        "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
    },
    READY: {
      label: "Ready",
      className:
        "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
    },
    PUBLISHED: {
      label: "Published",
      className:
        "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
    },
    ARCHIVED: {
      label: "Archived",
      className:
        "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200",
    },
  };

interface IssueStatusBadgeProps {
  status: IssueStatus;
  className?: string;
}

export function IssueStatusBadge({ status, className }: IssueStatusBadgeProps) {
  const config = statusConfig[status];

  return (
    <Badge variant="secondary" className={cn(config.className, className)}>
      {config.label}
    </Badge>
  );
}
