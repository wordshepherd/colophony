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
    className: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
    icon: Clock,
  },
  COPYEDIT_IN_PROGRESS: {
    label: "Copyediting",
    className:
      "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
    icon: Pencil,
  },
  AUTHOR_REVIEW: {
    label: "Author Review",
    className:
      "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
    icon: Eye,
  },
  PROOFREAD: {
    label: "Proofreading",
    className: "bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-200",
    icon: BookOpen,
  },
  READY_TO_PUBLISH: {
    label: "Ready to Publish",
    className:
      "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
    icon: CheckCircle,
  },
  PUBLISHED: {
    label: "Published",
    className: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200",
    icon: Globe,
  },
  WITHDRAWN: {
    label: "Withdrawn",
    className: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
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
