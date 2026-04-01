"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { CsrStatusBadge } from "./csr-status-badge";
import { formatDistanceToNow } from "date-fns";
import { Globe, ShieldCheck, UserPen } from "lucide-react";
import type { PortfolioItem } from "@colophony/types";

const ENTRY_TYPE_CONFIG = {
  colophony_verified: {
    label: "Verified",
    icon: ShieldCheck,
    variant: "default" as const,
  },
  federation_verified: {
    label: "Federated",
    icon: Globe,
    variant: "secondary" as const,
  },
  external: {
    label: "Self-reported",
    icon: UserPen,
    variant: "outline" as const,
  },
};

interface PortfolioItemCardProps {
  item: PortfolioItem;
}

export function PortfolioItemCard({ item }: PortfolioItemCardProps) {
  const typeConfig = ENTRY_TYPE_CONFIG[item.entryType];
  const TypeIcon = typeConfig.icon;

  return (
    <Card>
      <CardContent className="p-4 space-y-2">
        <div className="flex items-center gap-2">
          <Badge variant={typeConfig.variant} className="gap-1">
            <TypeIcon className="h-3 w-3" />
            {typeConfig.label}
          </Badge>
          <CsrStatusBadge status={item.status} />
        </div>

        <h3 className="font-medium text-sm truncate">
          {item.title ?? "Untitled"}
        </h3>

        {item.journalName && (
          <p className="text-xs text-muted-foreground truncate">
            {item.journalName}
          </p>
        )}

        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          {item.sentAt && (
            <span>
              Sent{" "}
              {formatDistanceToNow(new Date(item.sentAt), { addSuffix: true })}
            </span>
          )}
          {item.respondedAt && (
            <span>
              Responded{" "}
              {formatDistanceToNow(new Date(item.respondedAt), {
                addSuffix: true,
              })}
            </span>
          )}
        </div>

        {item.manuscriptTitle && (
          <p className="text-xs text-muted-foreground truncate">
            Manuscript: {item.manuscriptTitle}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
