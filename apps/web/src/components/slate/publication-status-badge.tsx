import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { PublicationStatus } from "@colophony/types";
import { Archive, CheckCircle } from "lucide-react";

const statusConfig: Record<
  PublicationStatus,
  {
    label: string;
    className: string;
    icon: React.ComponentType<{ className?: string }>;
  }
> = {
  ACTIVE: {
    label: "Active",
    className: "bg-status-success/10 text-status-success",
    icon: CheckCircle,
  },
  ARCHIVED: {
    label: "Archived",
    className: "bg-status-info/10 text-status-info",
    icon: Archive,
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
