"use client";

import { useState, useEffect } from "react";
import { format } from "date-fns";
import { trpc } from "@/lib/trpc";
import { computePeriodStatus } from "@colophony/types";
import type { PeriodStatus } from "@colophony/types";
import { PeriodStatusBadge } from "./period-status-badge";
import { PeriodFormDialog } from "./period-form-dialog";
import { PeriodDeleteDialog } from "./period-delete-dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  FilterTabs,
  FilterTabsList,
  FilterTabsTrigger,
} from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Calendar,
  MoreHorizontal,
  Pencil,
  Plus,
  Trash2,
  Trophy,
  X,
} from "lucide-react";

const BLIND_REVIEW_LABELS: Record<string, string> = {
  single_blind: "Single Blind",
  double_blind: "Double Blind",
};

const SKELETON_ITEMS = Array.from({ length: 5 });

const STATUS_TABS: Array<{ value: PeriodStatus | "ALL"; label: string }> = [
  { value: "ALL", label: "All" },
  { value: "UPCOMING", label: "Upcoming" },
  { value: "OPEN", label: "Open" },
  { value: "CLOSED", label: "Closed" },
];

function formatFee(fee: number | null): string {
  if (fee == null || fee === 0) return "Free";
  return `$${fee.toFixed(2)}`;
}

export function PeriodList() {
  const [statusFilter, setStatusFilter] = useState<PeriodStatus | "ALL">("ALL");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);

  // Dialogs — period items from tRPC have serialized dates (string | Date)
  type PeriodItem = NonNullable<typeof data>["items"][number];
  const [createOpen, setCreateOpen] = useState(false);
  const [editPeriod, setEditPeriod] = useState<PeriodItem | undefined>();
  const [deletePeriod, setDeletePeriod] = useState<{
    id: string;
    name: string;
  } | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const { data, isPending, error } = trpc.periods.list.useQuery({
    status: statusFilter === "ALL" ? undefined : statusFilter,
    search: debouncedSearch || undefined,
    page,
    limit: 20,
  });

  const handleStatusChange = (value: string) => {
    setStatusFilter(value as PeriodStatus | "ALL");
    setPage(1);
  };

  if (isPending) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="space-y-2">
          {SKELETON_ITEMS.map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">Submission Periods</h1>
        <p className="text-destructive">
          Failed to load periods: {error.message}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Submission Periods</h1>
          <p className="text-muted-foreground">
            Submission periods control when your publication accepts new work.
            Each period has open and close dates, and can optionally require a
            fee or run as a contest.
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Create Period
        </Button>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Input
          placeholder="Search by name..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        {search && (
          <button
            type="button"
            onClick={() => setSearch("")}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Status tabs */}
      <FilterTabs value={statusFilter} onValueChange={handleStatusChange}>
        <FilterTabsList>
          {STATUS_TABS.map((tab) => (
            <FilterTabsTrigger key={tab.value} value={tab.value}>
              {tab.label}
            </FilterTabsTrigger>
          ))}
        </FilterTabsList>
      </FilterTabs>

      {/* Table or empty state */}
      {data && data.items.length > 0 ? (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[100px]">Status</TableHead>
                <TableHead>Name</TableHead>
                <TableHead className="w-[160px]">Opens</TableHead>
                <TableHead className="w-[160px]">Closes</TableHead>
                <TableHead className="w-[80px]">Fee</TableHead>
                <TableHead className="w-[60px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.items.map((item) => {
                const status = computePeriodStatus(
                  new Date(item.opensAt),
                  new Date(item.closesAt),
                );
                return (
                  <TableRow key={item.id}>
                    <TableCell>
                      <PeriodStatusBadge status={status} />
                    </TableCell>
                    <TableCell className="font-medium">
                      {item.name}
                      {item.isContest && (
                        <Badge
                          variant="outline"
                          className="ml-2 text-xs text-status-warning border-status-warning/30"
                        >
                          <Trophy className="mr-1 h-3 w-3" />
                          Contest
                        </Badge>
                      )}
                      {item.blindReviewMode &&
                        item.blindReviewMode !== "none" && (
                          <Badge variant="secondary" className="ml-2 text-xs">
                            {BLIND_REVIEW_LABELS[item.blindReviewMode] ??
                              item.blindReviewMode}
                          </Badge>
                        )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {format(new Date(item.opensAt), "MMM d, yyyy h:mm a")}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {format(new Date(item.closesAt), "MMM d, yyyy h:mm a")}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatFee(item.fee)}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => setEditPeriod(item)}>
                            <Pencil className="mr-2 h-4 w-4" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() =>
                              setDeletePeriod({
                                id: item.id,
                                name: item.name,
                              })
                            }
                            className="text-destructive focus:text-destructive"
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>

          {/* Pagination */}
          {data.totalPages > 1 && (
            <div className="flex items-center justify-center gap-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
              >
                Previous
              </Button>
              <span className="text-sm text-muted-foreground">
                Page {page} of {data.totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.min(data.totalPages, p + 1))}
                disabled={page >= data.totalPages}
              >
                Next
              </Button>
            </div>
          )}
        </>
      ) : (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <Calendar className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-lg font-medium">No submission periods</p>
          <p className="text-sm text-muted-foreground mt-1">
            {statusFilter !== "ALL"
              ? `No ${statusFilter.toLowerCase()} periods found.`
              : debouncedSearch
                ? "No periods match your search."
                : "Create a submission period to start accepting submissions."}
          </p>
        </div>
      )}

      {/* Dialogs */}
      <PeriodFormDialog open={createOpen} onOpenChange={setCreateOpen} />
      <PeriodFormDialog
        open={!!editPeriod}
        onOpenChange={(open) => {
          if (!open) setEditPeriod(undefined);
        }}
        period={editPeriod}
      />
      {deletePeriod && (
        <PeriodDeleteDialog
          open={!!deletePeriod}
          onOpenChange={(open) => {
            if (!open) setDeletePeriod(null);
          }}
          periodId={deletePeriod.id}
          periodName={deletePeriod.name}
        />
      )}
    </div>
  );
}
