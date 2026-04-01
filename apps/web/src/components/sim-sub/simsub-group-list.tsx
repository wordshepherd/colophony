"use client";

import { useState } from "react";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { Copy, FileText, Plus } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  FilterTabs,
  FilterTabsList,
  FilterTabsTrigger,
} from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { GroupStatusBadge } from "./group-status-badge";
import { CreateGroupDialog } from "./create-group-dialog";
import type { SimsubGroupStatus } from "@colophony/types";

type StatusFilter = SimsubGroupStatus | "ALL";

export function SimsubGroupList() {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [page, setPage] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);
  const limit = 12;

  const { data, isPending: isLoading } = trpc.simsubGroups.list.useQuery({
    status: statusFilter === "ALL" ? undefined : statusFilter,
    page,
    limit,
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Sim-Sub Groups</h1>
          <p className="text-muted-foreground">
            Track which journals are considering the same piece. Withdraw
            promptly when one accepts.
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          New Group
        </Button>
      </div>

      {/* Status tabs */}
      <FilterTabs
        value={statusFilter}
        onValueChange={(v) => {
          setStatusFilter(v as StatusFilter);
          setPage(1);
        }}
      >
        <FilterTabsList>
          <FilterTabsTrigger value="ALL">All</FilterTabsTrigger>
          <FilterTabsTrigger value="ACTIVE">Active</FilterTabsTrigger>
          <FilterTabsTrigger value="RESOLVED">Resolved</FilterTabsTrigger>
          <FilterTabsTrigger value="WITHDRAWN">Withdrawn</FilterTabsTrigger>
        </FilterTabsList>
      </FilterTabs>

      {/* Loading */}
      {isLoading && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-36 rounded-lg" />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!isLoading && data?.items.length === 0 && (
        <div className="text-center py-12 border rounded-lg">
          <Copy className="mx-auto h-12 w-12 text-muted-foreground" />
          <h3 className="mt-4 text-lg font-semibold">No sim-sub groups</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            When you submit the same piece to multiple journals, a sim-sub group
            helps you keep track.
          </p>
          <Button className="mt-4" onClick={() => setCreateOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Create your first group
          </Button>
        </div>
      )}

      {/* Card grid */}
      {!isLoading && data && data.items.length > 0 && (
        <>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {data.items.map((group) => (
              <Link
                key={group.id}
                href={`/workspace/sim-sub/${group.id}`}
                className="block"
              >
                <Card className="hover:border-primary/50 transition-colors h-full">
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between gap-2">
                      <CardTitle className="text-base line-clamp-1">
                        {group.name}
                      </CardTitle>
                      <GroupStatusBadge status={group.status} />
                    </div>
                    {group.notes && (
                      <CardDescription className="line-clamp-2">
                        {group.notes}
                      </CardDescription>
                    )}
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <FileText className="h-3 w-3" />
                        {group.manuscriptId ? "Linked" : "No manuscript"}
                      </span>
                      <span>
                        Updated{" "}
                        {formatDistanceToNow(new Date(group.updatedAt), {
                          addSuffix: true,
                        })}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>

          {/* Pagination */}
          {data.totalPages > 1 && (
            <div className="flex justify-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                Previous
              </Button>
              <span className="flex items-center text-sm text-muted-foreground">
                Page {page} of {data.totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.min(data.totalPages, p + 1))}
                disabled={page === data.totalPages}
              >
                Next
              </Button>
            </div>
          )}
        </>
      )}

      <CreateGroupDialog open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  );
}
