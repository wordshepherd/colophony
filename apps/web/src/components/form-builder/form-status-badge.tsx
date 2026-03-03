import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { FormStatus } from "@colophony/types";
import { Archive, CheckCircle, FileEdit } from "lucide-react";

const statusConfig: Record<
  FormStatus,
  {
    label: string;
    className: string;
    icon: React.ComponentType<{ className?: string }>;
  }
> = {
  DRAFT: {
    label: "Draft",
    className: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200",
    icon: FileEdit,
  },
  PUBLISHED: {
    label: "Published",
    className:
      "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
    icon: CheckCircle,
  },
  ARCHIVED: {
    label: "Archived",
    className:
      "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
    icon: Archive,
  },
};

interface FormStatusBadgeProps {
  status: FormStatus;
  className?: string;
}

export function FormStatusBadge({ status, className }: FormStatusBadgeProps) {
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
