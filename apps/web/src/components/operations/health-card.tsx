"use client";

import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export type HealthStatus =
  | "healthy"
  | "degraded"
  | "unhealthy"
  | "unknown"
  | "loading";

export interface HealthCardProps {
  title: string;
  status: HealthStatus;
  metric: string;
  subtitle?: string;
  icon: LucideIcon;
  href?: string;
  onClick?: () => void;
}

const STATUS_STYLES: Record<
  Exclude<HealthStatus, "loading">,
  { text: string; border: string }
> = {
  healthy: {
    text: "text-green-700 dark:text-green-400",
    border: "border-l-green-500",
  },
  degraded: {
    text: "text-yellow-700 dark:text-yellow-400",
    border: "border-l-yellow-500",
  },
  unhealthy: {
    text: "text-red-700 dark:text-red-400",
    border: "border-l-red-500",
  },
  unknown: {
    text: "text-muted-foreground",
    border: "border-l-muted-foreground/40",
  },
};

export function HealthCard({
  title,
  status,
  metric,
  subtitle,
  icon: Icon,
  href,
  onClick,
}: HealthCardProps) {
  if (status === "loading") {
    return (
      <Card className="border-l-4 border-l-muted">
        <CardHeader className="py-2 px-3">
          <Skeleton className="h-3 w-20" />
        </CardHeader>
        <CardContent className="py-1 px-3 pb-2">
          <Skeleton className="h-7 w-16" />
          <Skeleton className="mt-1 h-3 w-24" />
        </CardContent>
      </Card>
    );
  }

  const styles = STATUS_STYLES[status];

  const card = (
    <Card
      className={`border-l-4 ${styles.border} transition-colors ${
        href || onClick ? "cursor-pointer hover:bg-muted/50" : ""
      }`}
      onClick={!href ? onClick : undefined}
    >
      <CardHeader className="py-2 px-3">
        <CardTitle className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
          <Icon className="h-3.5 w-3.5" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="py-1 px-3 pb-2">
        <p className={`text-2xl font-bold ${styles.text}`}>{metric}</p>
        {subtitle && (
          <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>
        )}
      </CardContent>
    </Card>
  );

  if (href) {
    return <Link href={href}>{card}</Link>;
  }

  return card;
}
