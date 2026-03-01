"use client";

import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { useDebounce } from "@/hooks/use-debounce";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PortfolioItemCard } from "./portfolio-item-card";
import { Layers, Search } from "lucide-react";
import type {
  CSRStatus,
  PortfolioSource,
  PortfolioItem,
} from "@colophony/types";

const STATUS_OPTIONS: Array<{ value: CSRStatus | "all"; label: string }> = [
  { value: "all", label: "All Statuses" },
  { value: "sent", label: "Sent" },
  { value: "in_review", label: "In Review" },
  { value: "hold", label: "On Hold" },
  { value: "accepted", label: "Accepted" },
  { value: "rejected", label: "Rejected" },
  { value: "withdrawn", label: "Withdrawn" },
  { value: "no_response", label: "No Response" },
  { value: "revise", label: "Revise" },
  { value: "unknown", label: "Unknown" },
];

const SOURCE_OPTIONS: Array<{
  value: PortfolioSource | "all";
  label: string;
}> = [
  { value: "all", label: "All Sources" },
  { value: "native", label: "Colophony" },
  { value: "external", label: "External" },
];

const SKELETON_ITEMS = Array.from({ length: 6 });

export function PortfolioList() {
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 300);
  const [status, setStatus] = useState<CSRStatus | "all">("all");
  const [source, setSource] = useState<PortfolioSource | "all">("all");
  const [groupByPiece, setGroupByPiece] = useState(false);
  const [page, setPage] = useState(1);
  const limit = 20;

  const [prevSearch, setPrevSearch] = useState(debouncedSearch);
  if (prevSearch !== debouncedSearch) {
    setPrevSearch(debouncedSearch);
    setPage(1);
  }

  const {
    data,
    isPending: isLoading,
    error,
  } = trpc.workspace.portfolio.useQuery({
    search: debouncedSearch || undefined,
    status: status === "all" ? undefined : status,
    source: source === "all" ? undefined : source,
    page,
    limit,
  });

  const items = data?.items;
  const groupedItems = useMemo(() => {
    if (!groupByPiece || !items) return null;
    const groups = new Map<string, { title: string; items: PortfolioItem[] }>();
    for (const item of items) {
      const key = item.manuscriptId ?? "__ungrouped__";
      const group = groups.get(key) ?? {
        title: item.manuscriptTitle ?? "Ungrouped",
        items: [],
      };
      group.items.push(item);
      groups.set(key, group);
    }
    return Array.from(groups.values());
  }, [groupByPiece, items]);

  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-destructive">
          Failed to load portfolio: {error.message}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2">
          <Layers className="h-6 w-6" />
          <h1 className="text-2xl font-bold">Portfolio</h1>
        </div>
        <p className="text-muted-foreground">
          Unified view of all submissions across Colophony and external journals
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search titles, journals..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        <Select
          value={status}
          onValueChange={(v) => {
            setStatus(v as CSRStatus | "all");
            setPage(1);
          }}
        >
          <SelectTrigger className="w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={source}
          onValueChange={(v) => {
            setSource(v as PortfolioSource | "all");
            setPage(1);
          }}
        >
          <SelectTrigger className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SOURCE_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="flex items-center gap-2">
          <Switch
            id="group-by-piece"
            checked={groupByPiece}
            onCheckedChange={setGroupByPiece}
          />
          <Label htmlFor="group-by-piece" className="text-sm">
            Group by piece
          </Label>
        </div>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {SKELETON_ITEMS.map((_, i) => (
            <Skeleton key={i} className="h-36 rounded-lg" />
          ))}
        </div>
      )}

      {/* Content */}
      {!isLoading && data && (
        <>
          {data.items.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              No submissions found
            </div>
          ) : groupedItems ? (
            <div className="space-y-6">
              {groupedItems.map((group) => (
                <div key={group.title} className="space-y-3">
                  <h2 className="text-lg font-semibold">{group.title}</h2>
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {group.items.map((item) => (
                      <PortfolioItemCard key={item.id} item={item} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {data.items.map((item) => (
                <PortfolioItemCard key={item.id} item={item} />
              ))}
            </div>
          )}

          {/* Pagination */}
          {data.totalPages > 1 && (
            <div className="flex items-center justify-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
              >
                Previous
              </Button>
              <span className="text-sm text-muted-foreground">
                Page {data.page} of {data.totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= data.totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
