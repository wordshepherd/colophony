"use client";

import Link from "next/link";
import { format } from "date-fns";
import { Activity, Building2, Network, Webhook } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { HealthCardGrid } from "./health-card-grid";

// ---------------------------------------------------------------------------
// Quick links
// ---------------------------------------------------------------------------

const quickLinks = [
  {
    title: "Organization",
    description: "Members, email templates, voting and writer status settings.",
    href: "/organizations/settings",
    icon: Building2,
  },
  {
    title: "Webhooks",
    description: "Outbound webhook endpoints, delivery history, and secrets.",
    href: "/webhooks",
    icon: Webhook,
  },
  {
    title: "Federation",
    description: "Peer trust, sim-sub checks, transfers, and migrations.",
    href: "/federation",
    icon: Network,
  },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function OpsDashboard() {
  const { data: auditData, isPending: isAuditLoading } =
    trpc.audit.list.useQuery({ page: 1, limit: 10 });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Operations</h1>
        <p className="text-sm text-muted-foreground">
          System health at a glance
        </p>
      </div>

      {/* Health card grid */}
      <HealthCardGrid />

      {/* Quick links */}
      <section>
        <h2 className="mb-3 text-sm font-medium text-muted-foreground">
          Quick Links
        </h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {quickLinks.map((link) => (
            <Card key={link.href} className="transition-colors hover:bg-accent">
              <Link href={link.href} className="block">
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-2">
                    <link.icon className="h-4 w-4 text-muted-foreground" />
                    <CardTitle className="text-sm">{link.title}</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-muted-foreground">
                    {link.description}
                  </p>
                </CardContent>
              </Link>
            </Card>
          ))}
        </div>
      </section>

      {/* Recent activity */}
      <section>
        <h2 className="mb-3 flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
          <Activity className="h-3.5 w-3.5" />
          Recent Activity
        </h2>
        {isAuditLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-8 w-full" />
            ))}
          </div>
        ) : auditData && auditData.items.length > 0 ? (
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Time</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Resource</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {auditData.items.map((event) => (
                  <TableRow key={event.id}>
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                      {format(new Date(event.createdAt), "MMM d, HH:mm")}
                    </TableCell>
                    <TableCell className="text-xs font-medium">
                      {event.action}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {event.resource}
                      {event.resourceId
                        ? ` (${event.resourceId.slice(0, 8)}...)`
                        : ""}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        ) : (
          <p className="text-sm text-muted-foreground">No recent activity.</p>
        )}
      </section>
    </div>
  );
}
