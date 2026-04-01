"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { format, differenceInDays } from "date-fns";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { useOrganization } from "@/hooks/use-organization";
import { toCsv, downloadFile } from "@/lib/csv-export";
import { StatusBadge } from "./status-badge";
import { BatchActionBar } from "./batch-action-bar";
import { useRowSelection } from "@/hooks/use-row-selection";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Inbox,
  MoreHorizontal,
  Eye,
  X,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  Download,
  Bookmark,
  BookmarkPlus,
} from "lucide-react";
import type {
  SubmissionStatus,
  SubmissionSortBy,
  SortOrder,
  PresetFilters,
} from "@colophony/types";

const STATUS_TABS: Array<{ value: SubmissionStatus | "ALL"; label: string }> = [
  { value: "ALL", label: "All" },
  { value: "SUBMITTED", label: "Submitted" },
  { value: "UNDER_REVIEW", label: "Under Review" },
  { value: "HOLD", label: "Hold" },
  { value: "ACCEPTED", label: "Accepted" },
  { value: "REJECTED", label: "Rejected" },
  { value: "WITHDRAWN", label: "Withdrawn" },
];

const TERMINAL_STATUSES = new Set(["ACCEPTED", "REJECTED", "WITHDRAWN"]);

function AgeBadge({
  submittedAt,
  status,
}: {
  submittedAt: string | null;
  status: string;
}) {
  if (TERMINAL_STATUSES.has(status) || !submittedAt) {
    return <span className="text-muted-foreground">{"\u2014"}</span>;
  }
  const days = differenceInDays(new Date(), new Date(submittedAt));
  let colorClass = "bg-status-success/10 text-status-success";
  if (days > 30) {
    colorClass = "bg-status-error/10 text-status-error";
  } else if (days >= 14) {
    colorClass = "bg-status-warning/10 text-status-warning";
  }
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${colorClass}`}
    >
      {days}d
    </span>
  );
}

const SORTABLE_COLUMNS: Array<{
  key: SubmissionSortBy;
  label: string;
  className?: string;
  id?: string;
}> = [
  { key: "status", label: "Status", className: "w-[100px]" },
  { key: "title", label: "Title" },
  { key: "submitterEmail", label: "Submitter" },
  { key: "submittedAt", label: "Submitted", className: "w-[140px]" },
  {
    key: "submittedAt",
    label: "Age",
    className: "w-[80px]",
    id: "age",
  },
];

const EXPORT_COLUMNS = [
  { key: "id", label: "ID" },
  { key: "title", label: "Title" },
  { key: "status", label: "Status" },
  { key: "submitterEmail", label: "Submitter Email" },
  { key: "submittedAt", label: "Submitted At" },
  { key: "createdAt", label: "Created At" },
  { key: "periodName", label: "Submission Period" },
];

function buildEditorHref(id: string, ids: string[], idx: number): string {
  const params = new URLSearchParams({
    queue: ids.join(","),
    idx: String(idx),
  });
  return `/editor/${id}?${params.toString()}`;
}

function SortIcon({
  column,
  currentSort,
  currentOrder,
}: {
  column: SubmissionSortBy;
  currentSort: SubmissionSortBy;
  currentOrder: SortOrder;
}) {
  if (column !== currentSort) {
    return <ArrowUpDown className="ml-1 inline h-3 w-3" />;
  }
  return currentOrder === "asc" ? (
    <ArrowUp className="ml-1 inline h-3 w-3" />
  ) : (
    <ArrowDown className="ml-1 inline h-3 w-3" />
  );
}

export function EditorSubmissionQueue() {
  const [statusFilter, setStatusFilter] = useState<SubmissionStatus | "ALL">(
    "ALL",
  );
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState<SubmissionSortBy>("createdAt");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");
  const [periodFilter, setPeriodFilter] = useState("");
  const [isExporting, setIsExporting] = useState(false);
  const [showSavePresetDialog, setShowSavePresetDialog] = useState(false);
  const [presetName, setPresetName] = useState("");
  const selection = useRowSelection<{ id: string }>();
  const { isAdmin } = useOrganization();

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Clear selection when page, filter, or search changes
  useEffect(() => {
    selection.clear();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, statusFilter, debouncedSearch, periodFilter]);

  const utils = trpc.useUtils();

  const { data: periods } = trpc.periods.list.useQuery({ limit: 100 });
  const { data: presets } = trpc.queuePresets.list.useQuery();
  const createPresetMutation = trpc.queuePresets.create.useMutation({
    onSuccess: () => {
      toast.success("Preset saved");
      setShowSavePresetDialog(false);
      setPresetName("");
      utils.queuePresets.list.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });
  const deletePresetMutation = trpc.queuePresets.delete.useMutation({
    onSuccess: () => {
      toast.success("Preset deleted");
      utils.queuePresets.list.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const { data, isPending, error } = trpc.submissions.list.useQuery({
    status: statusFilter === "ALL" ? undefined : statusFilter,
    search: debouncedSearch || undefined,
    submissionPeriodId: periodFilter || undefined,
    sortBy,
    sortOrder,
    page,
    limit: 20,
  });

  const handleStatusChange = (value: string) => {
    setStatusFilter(value as SubmissionStatus | "ALL");
    setPage(1);
  };

  const handleSort = useCallback(
    (column: SubmissionSortBy) => {
      if (column === sortBy) {
        setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"));
      } else {
        setSortBy(column);
        setSortOrder("desc");
      }
      setPage(1);
    },
    [sortBy],
  );

  const handlePeriodChange = useCallback((value: string) => {
    setPeriodFilter(value === "all" ? "" : value);
    setPage(1);
  }, []);

  const getCurrentFilters = useCallback((): PresetFilters => {
    return {
      status: statusFilter === "ALL" ? undefined : statusFilter,
      sortBy,
      sortOrder,
      periodFilter: periodFilter || undefined,
      search: debouncedSearch || undefined,
    };
  }, [statusFilter, sortBy, sortOrder, periodFilter, debouncedSearch]);

  const applyPreset = useCallback((filters: PresetFilters) => {
    setStatusFilter((filters.status as SubmissionStatus | "ALL") ?? "ALL");
    setSortBy((filters.sortBy as SubmissionSortBy) ?? "createdAt");
    setSortOrder((filters.sortOrder as SortOrder) ?? "desc");
    setPeriodFilter(filters.periodFilter ?? "");
    setSearch(filters.search ?? "");
    setDebouncedSearch(filters.search ?? "");
    setPage(1);
  }, []);

  const handleSavePreset = useCallback(() => {
    if (!presetName.trim()) return;
    createPresetMutation.mutate({
      name: presetName.trim(),
      filters: getCurrentFilters(),
    });
  }, [presetName, getCurrentFilters, createPresetMutation]);

  const handleExport = useCallback(
    async (exportFormat: "json" | "csv") => {
      setIsExporting(true);
      try {
        const result = await utils.submissions.export.fetch({
          status: statusFilter === "ALL" ? undefined : statusFilter,
          search: debouncedSearch || undefined,
          submissionPeriodId: periodFilter || undefined,
          format: exportFormat,
        });

        const timestamp = format(new Date(), "yyyy-MM-dd");
        if (exportFormat === "csv") {
          const csv = toCsv(
            result as unknown as Record<string, unknown>[],
            EXPORT_COLUMNS,
          );
          downloadFile(csv, `submissions-${timestamp}.csv`, "text/csv");
        } else {
          const json = JSON.stringify(result, null, 2);
          downloadFile(
            json,
            `submissions-${timestamp}.json`,
            "application/json",
          );
        }

        toast.success(
          `Exported ${result.length}${result.length === 10000 ? "+ (results truncated at 10,000)" : ""} submissions`,
        );
      } catch {
        toast.error("Failed to export submissions. Please try again.");
      } finally {
        setIsExporting(false);
      }
    },
    [utils, statusFilter, debouncedSearch, periodFilter],
  );

  if (isPending) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">Submissions</h1>
        <p className="text-destructive">
          Failed to load submissions: {error.message}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Submissions</h1>
        {isAdmin && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" disabled={isExporting}>
                <Download className="mr-2 h-4 w-4" />
                {isExporting ? "Exporting..." : "Export"}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => handleExport("csv")}>
                Export as CSV
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleExport("json")}>
                Export as JSON
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {/* Search + Period filter */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="relative max-w-sm flex-1">
          <Input
            placeholder="Search by title..."
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
        <Select
          value={periodFilter || "all"}
          onValueChange={handlePeriodChange}
        >
          <SelectTrigger className="w-48">
            <SelectValue placeholder="All periods" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All periods</SelectItem>
            {periods?.items.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Preset buttons */}
        {presets && presets.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <Bookmark className="mr-2 h-4 w-4" />
                Presets
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              {presets.map((preset) => (
                <DropdownMenuItem
                  key={preset.id}
                  className="flex items-center justify-between"
                  onClick={() => applyPreset(preset.filters as PresetFilters)}
                >
                  <span className="truncate">{preset.name}</span>
                  <button
                    type="button"
                    className="ml-2 text-muted-foreground hover:text-destructive"
                    onClick={(e) => {
                      e.stopPropagation();
                      deletePresetMutation.mutate({ id: preset.id });
                    }}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowSavePresetDialog(true)}
        >
          <BookmarkPlus className="mr-2 h-4 w-4" />
          Save Filter
        </Button>
      </div>

      {/* Status tabs */}
      <Tabs value={statusFilter} onValueChange={handleStatusChange}>
        <TabsList>
          {STATUS_TABS.map((tab) => (
            <TabsTrigger key={tab.value} value={tab.value}>
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {/* Table or empty state */}
      {data && data.items.length > 0 ? (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[40px]">
                  <Checkbox
                    checked={
                      selection.isAllSelected(data.items)
                        ? true
                        : selection.isIndeterminate(data.items)
                          ? "indeterminate"
                          : false
                    }
                    onCheckedChange={() => selection.toggleAll(data.items)}
                    aria-label="Select all"
                  />
                </TableHead>
                {SORTABLE_COLUMNS.map((col) => (
                  <TableHead key={col.id ?? col.key} className={col.className}>
                    <button
                      type="button"
                      className="inline-flex items-center hover:text-foreground"
                      onClick={() => handleSort(col.key)}
                    >
                      {col.label}
                      <SortIcon
                        column={col.key}
                        currentSort={sortBy}
                        currentOrder={sortOrder}
                      />
                    </button>
                  </TableHead>
                ))}
                <TableHead className="w-[60px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.items.map((item, idx) => {
                const ids = data.items.map((i) => i.id);
                const href = buildEditorHref(item.id, ids, idx);
                return (
                  <TableRow
                    key={item.id}
                    data-state={
                      selection.isSelected(item.id) ? "selected" : undefined
                    }
                  >
                    <TableCell>
                      <Checkbox
                        checked={selection.isSelected(item.id)}
                        onCheckedChange={() => selection.toggle(item.id)}
                        aria-label={`Select ${item.title ?? "submission"}`}
                      />
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={item.status as SubmissionStatus} />
                    </TableCell>
                    <TableCell>
                      <Link href={href} className="font-medium hover:underline">
                        {item.title ?? "(Untitled)"}
                      </Link>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {item.submitterEmail ?? "[Anonymous]"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {item.submittedAt
                        ? format(new Date(item.submittedAt), "MMM d, yyyy")
                        : "\u2014"}
                    </TableCell>
                    <TableCell>
                      <AgeBadge
                        submittedAt={item.submittedAt as string | null}
                        status={item.status as string}
                      />
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
                          <DropdownMenuItem asChild>
                            <Link href={href}>
                              <Eye className="mr-2 h-4 w-4" />
                              View
                            </Link>
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
          <Inbox className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-lg font-medium">No submissions</p>
          <p className="text-sm text-muted-foreground mt-1">
            {statusFilter !== "ALL"
              ? `No ${statusFilter.toLowerCase().replace("_", " ")} submissions found.`
              : debouncedSearch
                ? "No submissions match your search."
                : "Submissions will appear here once submitters send them in."}
          </p>
        </div>
      )}

      <BatchActionBar
        selectedCount={selection.count}
        selectedIds={[...selection.selectedIds]}
        statusFilter={statusFilter}
        onClear={selection.clear}
        onSuccess={() => {
          selection.clear();
          utils.submissions.list.invalidate();
        }}
      />

      {/* Save preset dialog */}
      <Dialog
        open={showSavePresetDialog}
        onOpenChange={setShowSavePresetDialog}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Save Filter Preset</DialogTitle>
            <DialogDescription>
              Save the current filter settings for quick access later.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="preset-name">Preset name</Label>
              <Input
                id="preset-name"
                placeholder="e.g. Pending reviews"
                value={presetName}
                onChange={(e) => setPresetName(e.target.value)}
                maxLength={100}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowSavePresetDialog(false);
                setPresetName("");
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSavePreset}
              disabled={!presetName.trim() || createPresetMutation.isPending}
            >
              {createPresetMutation.isPending ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
