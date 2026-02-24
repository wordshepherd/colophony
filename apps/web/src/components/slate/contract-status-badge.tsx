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
  return (
    <Badge variant={config.variant} className={cn(config.color, className)}>
      {config.label}
    </Badge>
  );
}
