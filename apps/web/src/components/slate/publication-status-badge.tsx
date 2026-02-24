import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { PublicationStatus } from "@colophony/types";

const statusConfig: Record<
  PublicationStatus,
  { label: string; className: string }
> = {
  ACTIVE: {
    label: "Active",
    className:
      "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  },
  ARCHIVED: {
    label: "Archived",
    className: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200",
  },
};

interface PublicationStatusBadgeProps {
  status: PublicationStatus;
  className?: string;
}

export function PublicationStatusBadge({
  status,
  className,
}: PublicationStatusBadgeProps) {
  const config = statusConfig[status];

  return (
    <Badge variant="secondary" className={cn(config.className, className)}>
      {config.label}
    </Badge>
  );
}
