import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useDensity } from "@/hooks/use-density";
import { cn } from "@/lib/utils";
import type { SubmissionStatus } from "@colophony/types";
import {
  Ban,
  CheckCircle,
  Eye,
  FileEdit,
  Pause,
  RotateCcw,
  Send,
  XCircle,
} from "lucide-react";

const statusConfig: Record<
  SubmissionStatus,
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
  SUBMITTED: {
    label: "Submitted",
    className: "bg-status-info/10 text-status-info",
    icon: Send,
  },
  UNDER_REVIEW: {
    label: "Under Review",
    className: "bg-status-info/10 text-status-info",
    icon: Eye,
  },
  ACCEPTED: {
    label: "Accepted",
    className: "bg-status-success/10 text-status-success",
    icon: CheckCircle,
  },
  REJECTED: {
    label: "Rejected",
    className: "bg-status-error/10 text-status-error",
    icon: XCircle,
  },
  HOLD: {
    label: "On Hold",
    className: "bg-status-held/10 text-status-held",
    icon: Pause,
  },
  REVISE_AND_RESUBMIT: {
    label: "Revise & Resubmit",
    className: "bg-status-warning/10 text-status-warning",
    icon: RotateCcw,
  },
  WITHDRAWN: {
    label: "Withdrawn",
    className: "bg-status-held/10 text-status-held",
    icon: Ban,
  },
};

interface StatusBadgeProps {
  status: SubmissionStatus;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const { isCompact } = useDensity();
  const config = statusConfig[status];
  const Icon = config.icon;

  const badge = (
    <Badge
      variant="secondary"
      className={cn("gap-1", config.className, className)}
    >
      <Icon className="h-3 w-3" />
      {!isCompact && config.label}
    </Badge>
  );

  if (isCompact) {
    return (
      <TooltipProvider delayDuration={200}>
        <Tooltip>
          <TooltipTrigger asChild>{badge}</TooltipTrigger>
          <TooltipContent>{config.label}</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return badge;
}
