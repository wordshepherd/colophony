import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { IssueStatus } from "@colophony/types";
import { Archive, CheckCircle, Globe, Layers, Pencil } from "lucide-react";

const statusConfig: Record<
  IssueStatus,
  {
    label: string;
    className: string;
    icon: React.ComponentType<{ className?: string }>;
  }
> = {
  PLANNING: {
    label: "Planning",
    className: "bg-status-info/10 text-status-info",
    icon: Pencil,
  },
  ASSEMBLING: {
    label: "Assembling",
    className: "bg-status-warning/10 text-status-warning",
    icon: Layers,
  },
  READY: {
    label: "Ready",
    className: "bg-status-held/10 text-status-held",
    icon: CheckCircle,
  },
  PUBLISHED: {
    label: "Published",
    className: "bg-status-success/10 text-status-success",
    icon: Globe,
  },
  ARCHIVED: {
    label: "Archived",
    className: "bg-status-info/10 text-status-info",
    icon: Archive,
  },
};

interface IssueStatusBadgeProps {
  status: IssueStatus;
  className?: string;
}

export function IssueStatusBadge({ status, className }: IssueStatusBadgeProps) {
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
