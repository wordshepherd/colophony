import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { PipelineStage } from "@colophony/types";
import {
  Ban,
  BookOpen,
  CheckCircle,
  Clock,
  Eye,
  Globe,
  Pencil,
} from "lucide-react";

const stageConfig: Record<
  PipelineStage,
  {
    label: string;
    className: string;
    icon: React.ComponentType<{ className?: string }>;
  }
> = {
  COPYEDIT_PENDING: {
    label: "Copyedit Pending",
    className: "bg-status-info/10 text-status-info",
    icon: Clock,
  },
  COPYEDIT_IN_PROGRESS: {
    label: "Copyediting",
    className: "bg-status-warning/10 text-status-warning",
    icon: Pencil,
  },
  AUTHOR_REVIEW: {
    label: "Author Review",
    className: "bg-status-held/10 text-status-held",
    icon: Eye,
  },
  PROOFREAD: {
    label: "Proofreading",
    className: "bg-status-info/10 text-status-info",
    icon: BookOpen,
  },
  READY_TO_PUBLISH: {
    label: "Ready to Publish",
    className: "bg-status-success/10 text-status-success",
    icon: CheckCircle,
  },
  PUBLISHED: {
    label: "Published",
    className: "bg-status-info/10 text-status-info",
    icon: Globe,
  },
  WITHDRAWN: {
    label: "Withdrawn",
    className: "bg-status-error/10 text-status-error",
    icon: Ban,
  },
};

interface PipelineStageBadgeProps {
  stage: PipelineStage;
  className?: string;
}

export function PipelineStageBadge({
  stage,
  className,
}: PipelineStageBadgeProps) {
  const config = stageConfig[stage];
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
