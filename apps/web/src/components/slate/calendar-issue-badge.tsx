"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";
import type { IssueStatus } from "@colophony/types";

const statusBorderColor: Record<IssueStatus, string> = {
  PLANNING: "border-l-blue-500",
  ASSEMBLING: "border-l-yellow-500",
  READY: "border-l-purple-500",
  PUBLISHED: "border-l-green-500",
  ARCHIVED: "border-l-gray-400",
};

interface CalendarIssueBadgeProps {
  issue: { id: string; title: string; status: IssueStatus };
}

export function CalendarIssueBadge({ issue }: CalendarIssueBadgeProps) {
  return (
    <Link
      href={`/slate/issues/${issue.id}`}
      className={cn(
        "block truncate rounded-sm border-l-2 bg-accent/50 px-1.5 py-0.5 text-xs leading-tight hover:bg-accent transition-colors",
        statusBorderColor[issue.status],
      )}
      title={issue.title}
    >
      {issue.title}
    </Link>
  );
}
