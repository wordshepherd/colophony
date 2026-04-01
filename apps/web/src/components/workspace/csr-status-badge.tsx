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
  draft: "bg-status-info/10 text-status-info",
  sent: "bg-status-info/10 text-status-info",
  in_review: "bg-status-info/10 text-status-info",
  hold: "bg-status-held/10 text-status-held",
  accepted: "bg-status-success/10 text-status-success",
  rejected: "bg-status-error/10 text-status-error",
  withdrawn: "bg-status-held/10 text-status-held",
  no_response: "bg-status-info/10 text-status-info",
  revise: "bg-status-warning/10 text-status-warning",
  unknown: "bg-status-info/10 text-status-info",
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
