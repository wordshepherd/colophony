import type { ContractStatus } from "@colophony/types";
import {
  CheckCheck,
  CheckCircle,
  Eye,
  FileEdit,
  PenLine,
  Send,
  XCircle,
} from "lucide-react";

export const contractStatusConfig: Record<
  ContractStatus,
  {
    label: string;
    color: string;
    variant: "default" | "secondary" | "destructive" | "outline";
    icon: React.ComponentType<{ className?: string }>;
  }
> = {
  DRAFT: {
    label: "Draft",
    color: "bg-gray-100 text-gray-800",
    variant: "secondary",
    icon: FileEdit,
  },
  SENT: {
    label: "Sent",
    color: "bg-blue-100 text-blue-800",
    variant: "default",
    icon: Send,
  },
  VIEWED: {
    label: "Viewed",
    color: "bg-cyan-100 text-cyan-800",
    variant: "outline",
    icon: Eye,
  },
  SIGNED: {
    label: "Signed",
    color: "bg-amber-100 text-amber-800",
    variant: "default",
    icon: PenLine,
  },
  COUNTERSIGNED: {
    label: "Countersigned",
    color: "bg-orange-100 text-orange-800",
    variant: "default",
    icon: CheckCheck,
  },
  COMPLETED: {
    label: "Completed",
    color: "bg-green-100 text-green-800",
    variant: "default",
    icon: CheckCircle,
  },
  VOIDED: {
    label: "Voided",
    color: "bg-red-100 text-red-800",
    variant: "destructive",
    icon: XCircle,
  },
};

export const contractStatusTabs: {
  value: ContractStatus | "ALL";
  label: string;
}[] = [
  { value: "ALL", label: "All" },
  { value: "DRAFT", label: "Draft" },
  { value: "SENT", label: "Sent" },
  { value: "SIGNED", label: "Signed" },
  { value: "COMPLETED", label: "Completed" },
  { value: "VOIDED", label: "Voided" },
];
