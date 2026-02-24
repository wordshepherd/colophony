import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { PipelineStage } from "@colophony/types";

const stageConfig: Record<PipelineStage, { label: string; className: string }> =
  {
    COPYEDIT_PENDING: {
      label: "Copyedit Pending",
      className:
        "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
    },
    COPYEDIT_IN_PROGRESS: {
      label: "Copyediting",
      className:
        "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
    },
    AUTHOR_REVIEW: {
      label: "Author Review",
      className:
        "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
    },
    PROOFREAD: {
      label: "Proofreading",
      className:
        "bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-200",
    },
    READY_TO_PUBLISH: {
      label: "Ready to Publish",
      className:
        "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
    },
    PUBLISHED: {
      label: "Published",
      className:
        "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200",
    },
    WITHDRAWN: {
      label: "Withdrawn",
      className: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
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

  return (
    <Badge variant="secondary" className={cn(config.className, className)}>
      {config.label}
    </Badge>
  );
}
