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
    className: "bg-status-info/10 text-status-info",
    icon: FileEdit,
  },
  PUBLISHED: {
    label: "Published",
    className: "bg-status-success/10 text-status-success",
    icon: CheckCircle,
  },
  ARCHIVED: {
    label: "Archived",
    className: "bg-status-held/10 text-status-held",
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
