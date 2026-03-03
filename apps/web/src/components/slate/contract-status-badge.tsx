import type { ContractStatus } from "@colophony/types";
import { Badge } from "@/components/ui/badge";
import { contractStatusConfig } from "@/lib/contract-utils";
import { cn } from "@/lib/utils";

interface ContractStatusBadgeProps {
  status: ContractStatus;
  className?: string;
}

export function ContractStatusBadge({
  status,
  className,
}: ContractStatusBadgeProps) {
  const config = contractStatusConfig[status];
  const Icon = config.icon;
  return (
    <Badge
      variant={config.variant}
      className={cn("gap-1", config.color, className)}
    >
      <Icon className="h-3 w-3" />
      {config.label}
    </Badge>
  );
}
