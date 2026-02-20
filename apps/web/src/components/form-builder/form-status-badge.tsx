import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { FormStatus } from "@colophony/types";

const statusConfig: Record<FormStatus, { label: string; className: string }> = {
  DRAFT: {
    label: "Draft",
    className: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200",
  },
  PUBLISHED: {
    label: "Published",
    className:
      "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  },
  ARCHIVED: {
    label: "Archived",
    className:
      "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
  },
};

interface FormStatusBadgeProps {
  status: FormStatus;
  className?: string;
}

export function FormStatusBadge({ status, className }: FormStatusBadgeProps) {
  const config = statusConfig[status];

  return (
    <Badge variant="secondary" className={cn(config.className, className)}>
      {config.label}
    </Badge>
  );
}
