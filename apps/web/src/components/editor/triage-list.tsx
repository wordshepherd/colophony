"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { differenceInDays } from "date-fns";
import { trpc } from "@/lib/trpc";
import { StatusBadge } from "@/components/submissions/status-badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Inbox } from "lucide-react";
import type {
  SubmissionStatus,
  SubmissionSortBy,
  SortOrder,
} from "@colophony/types";

const STATUS_TABS: Array<{ value: SubmissionStatus | "ALL"; label: string }> = [
  { value: "ALL", label: "All" },
  { value: "SUBMITTED", label: "New" },
  { value: "UNDER_REVIEW", label: "Review" },
  { value: "HOLD", label: "Hold" },
];

const TERMINAL_STATUSES = new Set(["ACCEPTED", "REJECTED", "WITHDRAWN"]);

interface TriageListProps {
  selectedId: string | null;
  onSelect: (id: string) => void;
  /** Expose current item IDs for keyboard navigation from parent */
  onItemsChange?: (ids: string[]) => void;
}

/**
 * Compact submission list for the split pane left panel.
 * Shows title, submitter, content preview, status, and age.
 */
export function TriageList({
  selectedId,
  onSelect,
  onItemsChange,
}: TriageListProps) {
  const [statusFilter, setStatusFilter] = useState<SubmissionStatus | "ALL">(
    "ALL",
  );
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const selectedRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const { data, isPending } = trpc.submissions.list.useQuery({
    status: statusFilter === "ALL" ? undefined : statusFilter,
    search: debouncedSearch || undefined,
    sortBy: "createdAt" as SubmissionSortBy,
    sortOrder: "desc" as SortOrder,
    page: 1,
    limit: 50,
  });

  const items = useMemo(() => data?.items ?? [], [data?.items]);
  const itemIds = useMemo(() => items.map((item) => item.id), [items]);

  // Notify parent of available IDs for keyboard navigation
  useEffect(() => {
    onItemsChange?.(itemIds);
  }, [itemIds, onItemsChange]);

  // Scroll selected item into view
  useEffect(() => {
    selectedRef.current?.scrollIntoView({ block: "nearest" });
  }, [selectedId]);

  return (
    <div className="flex h-full flex-col border-r">
      {/* Search */}
      <div className="p-2 border-b">
        <Input
          placeholder="Search submissions..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-8 text-sm"
        />
      </div>

      {/* Status tabs */}
      <div className="px-2 py-1 border-b">
        <Tabs
          value={statusFilter}
          onValueChange={(v) => setStatusFilter(v as SubmissionStatus | "ALL")}
        >
          <TabsList className="h-7 w-full">
            {STATUS_TABS.map((tab) => (
              <TabsTrigger
                key={tab.value}
                value={tab.value}
                className="text-xs px-2 py-0.5"
              >
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>

      {/* Item list */}
      <div className="flex-1 overflow-y-auto">
        {isPending ? (
          <div className="space-y-2 p-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <Inbox className="h-8 w-8 mb-2" />
            <p className="text-sm">No submissions found</p>
          </div>
        ) : (
          <div className="divide-y">
            {items.map((item) => (
              <TriageItem
                key={item.id}
                ref={item.id === selectedId ? selectedRef : undefined}
                item={item}
                isSelected={item.id === selectedId}
                onSelect={() => onSelect(item.id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Count footer */}
      {data && (
        <div className="px-3 py-1.5 border-t text-xs text-muted-foreground">
          {data.total} submission{data.total !== 1 ? "s" : ""}
        </div>
      )}
    </div>
  );
}

// --- Triage item ---

interface TriageItemProps {
  item: {
    id: string;
    title: string | null;
    status: string;
    content: string | null;
    submitterEmail: string | null;
    submittedAt: string | null;
  };
  isSelected: boolean;
  onSelect: () => void;
}

const TriageItem = ({
  ref,
  item,
  isSelected,
  onSelect,
}: TriageItemProps & { ref?: React.Ref<HTMLButtonElement> }) => {
  return (
    <button
      ref={ref}
      onClick={onSelect}
      className={`w-full text-left px-3 py-2 transition-colors hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring ${
        isSelected ? "bg-accent" : ""
      }`}
      aria-selected={isSelected}
      role="option"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <StatusBadge status={item.status as SubmissionStatus} />
            <span className="text-sm font-medium truncate">
              {item.title ?? "(Untitled)"}
            </span>
          </div>
          <p className="text-xs text-muted-foreground truncate mt-0.5">
            {item.submitterEmail ?? "[Anonymous]"}
          </p>
          {item.content && (
            <p className="text-xs text-muted-foreground/70 line-clamp-2 mt-1 leading-relaxed">
              {item.content}
            </p>
          )}
        </div>
        <AgeBadge submittedAt={item.submittedAt} status={item.status} />
      </div>
    </button>
  );
};

function AgeBadge({
  submittedAt,
  status,
}: {
  submittedAt: string | null;
  status: string;
}) {
  if (TERMINAL_STATUSES.has(status) || !submittedAt) return null;

  const days = differenceInDays(new Date(), new Date(submittedAt));
  let colorClass = "bg-status-success/10 text-status-success";
  if (days > 30) {
    colorClass = "bg-status-error/10 text-status-error";
  } else if (days >= 14) {
    colorClass = "bg-status-warning/10 text-status-warning";
  }

  return (
    <span
      className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium flex-shrink-0 ${colorClass}`}
    >
      {days}d
    </span>
  );
}
