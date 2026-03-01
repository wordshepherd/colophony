"use client";

import { Badge } from "@/components/ui/badge";
import type { CSRStatus } from "@colophony/types";

const statusConfig: Record<
  CSRStatus,
  {
    label: string;
    variant: "default" | "secondary" | "destructive" | "outline";
  }
> = {
  draft: { label: "Draft", variant: "secondary" },
  sent: { label: "Sent", variant: "default" },
  in_review: { label: "In Review", variant: "default" },
  hold: { label: "On Hold", variant: "outline" },
  accepted: { label: "Accepted", variant: "default" },
  rejected: { label: "Rejected", variant: "destructive" },
  withdrawn: { label: "Withdrawn", variant: "secondary" },
  no_response: { label: "No Response", variant: "outline" },
  revise: { label: "Revise", variant: "default" },
  unknown: { label: "Unknown", variant: "outline" },
};

const statusColors: Record<CSRStatus, string> = {
  draft: "bg-gray-100 text-gray-800",
  sent: "bg-blue-100 text-blue-800",
  in_review: "bg-yellow-100 text-yellow-800",
  hold: "bg-orange-100 text-orange-800",
  accepted: "bg-green-100 text-green-800",
  rejected: "bg-red-100 text-red-800",
  withdrawn: "bg-gray-100 text-gray-800",
  no_response: "bg-gray-100 text-gray-600",
  revise: "bg-purple-100 text-purple-800",
  unknown: "bg-gray-100 text-gray-600",
};

interface CsrStatusBadgeProps {
  status: CSRStatus;
}

export function CsrStatusBadge({ status }: CsrStatusBadgeProps) {
  const config = statusConfig[status] ?? statusConfig.unknown;
  const colorClass = statusColors[status] ?? statusColors.unknown;

  return (
    <Badge variant="outline" className={colorClass}>
      {config.label}
    </Badge>
  );
}
