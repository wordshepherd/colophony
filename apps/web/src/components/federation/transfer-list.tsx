"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format } from "date-fns";

const STATUS_COLORS: Record<string, string> = {
  PENDING: "border-status-warning text-status-warning",
  FILES_REQUESTED: "border-status-info text-status-info",
  COMPLETED: "border-status-success text-status-success",
  REJECTED: "border-status-error text-status-error",
  FAILED: "border-status-error text-status-error",
  CANCELLED: "border-status-info text-status-info",
  EXPIRED: "border-status-info text-status-info",
};

type Tab = "all" | "pending" | "completed" | "failed";

export function TransferList() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("all");
  const [page, setPage] = useState(1);

  const { data, isPending: isLoading } = trpc.transfers.list.useQuery({
    page,
    limit: 20,
  });

  const transfers = data?.transfers ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / 20);

  const filtered =
    tab === "all"
      ? transfers
      : tab === "pending"
        ? transfers.filter(
            (t) => t.status === "PENDING" || t.status === "FILES_REQUESTED",
          )
        : tab === "completed"
          ? transfers.filter((t) => t.status === "COMPLETED")
          : transfers.filter(
              (t) => t.status === "FAILED" || t.status === "REJECTED",
            );

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" asChild>
        <Link href="/federation">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Federation
        </Link>
      </Button>

      <h1 className="text-2xl font-bold">Piece Transfers</h1>

      <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)}>
        <TabsList>
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="pending">Pending</TabsTrigger>
          <TabsTrigger value="completed">Completed</TabsTrigger>
          <TabsTrigger value="failed">Failed</TabsTrigger>
        </TabsList>
      </Tabs>

      <Card>
        <CardHeader>
          <CardTitle>Transfers</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground">No transfers found.</p>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Target Domain</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Submission</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Completed</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((transfer) => (
                    <TableRow
                      key={transfer.id}
                      className="cursor-pointer"
                      onClick={() =>
                        router.push(`/federation/transfers/${transfer.id}`)
                      }
                    >
                      <TableCell>{transfer.targetDomain}</TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={STATUS_COLORS[transfer.status] ?? ""}
                        >
                          {transfer.status.replace(/_/g, " ")}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {transfer.submissionId.slice(0, 8)}...
                      </TableCell>
                      <TableCell>
                        {format(new Date(transfer.createdAt), "PP")}
                      </TableCell>
                      <TableCell>
                        {transfer.completedAt
                          ? format(new Date(transfer.completedAt), "PP")
                          : "—"}
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
