"use client";

import { Badge } from "@/components/ui/badge";
import type { CSRStatus } from "@colophony/types";
import {
  Ban,
  CheckCircle,
  Clock,
  Eye,
  FileEdit,
  HelpCircle,
  Pause,
  RotateCcw,
  Send,
  XCircle,
} from "lucide-react";

const statusConfig: Record<
  CSRStatus,
  {
    label: string;
    variant: "default" | "secondary" | "destructive" | "outline";
    icon: React.ComponentType<{ className?: string }>;
  }
> = {
  draft: { label: "Draft", variant: "secondary", icon: FileEdit },
  sent: { label: "Sent", variant: "default", icon: Send },
  in_review: { label: "In Review", variant: "default", icon: Eye },
  hold: { label: "On Hold", variant: "outline", icon: Pause },
  accepted: { label: "Accepted", variant: "default", icon: CheckCircle },
  rejected: { label: "Rejected", variant: "destructive", icon: XCircle },
  withdrawn: { label: "Withdrawn", variant: "secondary", icon: Ban },
  no_response: { label: "No Response", variant: "outline", icon: Clock },
  revise: { label: "Revise", variant: "default", icon: RotateCcw },
  unknown: { label: "Unknown", variant: "outline", icon: HelpCircle },
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
  const Icon = config.icon;

  return (
    <Badge variant="outline" className={`gap-1 ${colorClass}`}>
      <Icon className="h-3 w-3" />
      {config.label}
    </Badge>
  );
}
