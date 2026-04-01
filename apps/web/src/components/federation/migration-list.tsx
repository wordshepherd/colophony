"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, AlertTriangle } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { format } from "date-fns";

const STATUS_COLORS: Record<string, string> = {
  PENDING: "border-status-warning text-status-warning",
  PENDING_APPROVAL: "border-status-held text-status-held",
  APPROVED: "border-status-info text-status-info",
  BUNDLE_SENT: "border-status-info text-status-info",
  PROCESSING: "border-status-info text-status-info",
  COMPLETED: "border-status-success text-status-success",
  REJECTED: "border-status-error text-status-error",
  FAILED: "border-status-error text-status-error",
  EXPIRED: "border-status-info text-status-info",
  CANCELLED: "border-status-info text-status-info",
};

const DIRECTION_COLORS: Record<string, string> = {
  inbound: "border-status-info text-status-info",
  outbound: "border-status-held text-status-held",
};

type Tab =
  | "all"
  | "pending_approval"
  | "in_progress"
  | "completed"
  | "cancelled";

export function MigrationList() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("all");
  const [direction, setDirection] = useState<string>("all");
  const [page, setPage] = useState(1);

  const { data, isPending: isLoading } = trpc.migrations.list.useQuery({
    page,
    limit: 20,
    direction:
      direction === "all" ? undefined : (direction as "inbound" | "outbound"),
  });

  const { data: pendingApproval } = trpc.migrations.listPending.useQuery();

  const migrations = data?.migrations ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / 20);

  const IN_PROGRESS_STATUSES = new Set([
    "PENDING",
    "APPROVED",
    "BUNDLE_SENT",
    "PROCESSING",
  ]);

  const filtered =
    tab === "all"
      ? migrations
      : tab === "pending_approval"
        ? migrations.filter((m) => m.status === "PENDING_APPROVAL")
        : tab === "in_progress"
          ? migrations.filter((m) => IN_PROGRESS_STATUSES.has(m.status))
          : tab === "completed"
            ? migrations.filter((m) => m.status === "COMPLETED")
            : migrations.filter(
                (m) => m.status === "CANCELLED" || m.status === "EXPIRED",
              );

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" asChild>
        <Link href="/federation">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Federation
        </Link>
      </Button>

      <h1 className="text-2xl font-bold">Identity Migrations</h1>

      {/* Pending approval banner */}
      {pendingApproval && pendingApproval.length > 0 && (
        <Card className="border-status-held/30 bg-status-held/10">
          <CardContent className="flex items-center gap-3 py-3">
            <AlertTriangle className="h-5 w-5 text-status-held" />
            <p className="text-sm text-status-held">
              <strong>{pendingApproval.length}</strong> migration
              {pendingApproval.length === 1 ? "" : "s"} pending your approval
            </p>
          </CardContent>
        </Card>
      )}

      <div className="flex items-center gap-4">
        <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)}>
          <TabsList>
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="pending_approval">Pending Approval</TabsTrigger>
            <TabsTrigger value="in_progress">In Progress</TabsTrigger>
            <TabsTrigger value="completed">Completed</TabsTrigger>
            <TabsTrigger value="cancelled">Cancelled</TabsTrigger>
          </TabsList>
        </Tabs>

        <Select value={direction} onValueChange={setDirection}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Direction" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Directions</SelectItem>
            <SelectItem value="inbound">Inbound</SelectItem>
            <SelectItem value="outbound">Outbound</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Migrations</CardTitle>
          <CardDescription>
            Identity migration requests across federated instances
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No migrations found.
            </p>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Direction</TableHead>
                    <TableHead>Peer Domain</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>User DID</TableHead>
                    <TableHead>Created</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((migration) => (
                    <TableRow
                      key={migration.id}
                      className="cursor-pointer"
                      onClick={() =>
                        router.push(`/federation/migrations/${migration.id}`)
                      }
                    >
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={
                            DIRECTION_COLORS[migration.direction] ?? ""
                          }
                        >
                          {migration.direction}
                        </Badge>
                      </TableCell>
                      <TableCell>{migration.peerDomain}</TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={STATUS_COLORS[migration.status] ?? ""}
                        >
                          {migration.status.replace(/_/g, " ")}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {migration.userDid
                          ? `${migration.userDid.slice(0, 16)}...`
                          : "—"}
                      </TableCell>
                      <TableCell>
                        {format(new Date(migration.createdAt), "PP")}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {totalPages > 1 && (
                <div className="mt-4 flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">
                    Page {page} of {totalPages} ({total} total)
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page <= 1}
                      onClick={() => setPage((p) => p - 1)}
                    >
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page >= totalPages}
                      onClick={() => setPage((p) => p + 1)}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
