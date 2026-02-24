"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { useOrganization } from "@/hooks/use-organization";
import { PublicationCard } from "./publication-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Library, Plus, X } from "lucide-react";
import { toast } from "sonner";
import type { PublicationStatus } from "@colophony/types";

const STATUS_TABS: Array<{ value: PublicationStatus | "ALL"; label: string }> =
  [
    { value: "ALL", label: "All" },
    { value: "ACTIVE", label: "Active" },
    { value: "ARCHIVED", label: "Archived" },
  ];

export function PublicationList() {
  const { isAdmin } = useOrganization();
  const [statusFilter, setStatusFilter] = useState<PublicationStatus | "ALL">(
    "ALL",
  );
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const { data, isPending, error } = trpc.publications.list.useQuery({
    status: statusFilter === "ALL" ? undefined : statusFilter,
    search: debouncedSearch || undefined,
    page,
    limit: 20,
  });

  // Clamp page when data shrinks (render-time state adjustment)
  if (data && data.totalPages > 0 && page > data.totalPages) {
    setPage(data.totalPages);
  }

  const utils = trpc.useUtils();

  const archiveMutation = trpc.publications.archive.useMutation({
    onSuccess: () => {
      toast.success("Publication archived");
      utils.publications.list.invalidate();
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });

  const handleStatusChange = (value: string) => {
    setStatusFilter(value as PublicationStatus | "ALL");
    setPage(1);
  };

  const handleArchive = isAdmin
    ? (id: string) => archiveMutation.mutate({ id })
    : undefined;

  if (isPending) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-40 w-full" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">Publications</h1>
        <p className="text-destructive">
          Failed to load publications: {error.message}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Publications</h1>
        {isAdmin && (
          <Link href="/slate/publications/new">
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              New Publication
            </Button>
          </Link>
        )}
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
      <Tabs value={statusFilter} onValueChange={handleStatusChange}>
        <TabsList>
          {STATUS_TABS.map((tab) => (
            <TabsTrigger key={tab.value} value={tab.value}>
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {/* Grid or empty state */}
      {data && data.items.length > 0 ? (
        <>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {data.items.map((publication) => (
              <PublicationCard
                key={publication.id}
                publication={publication}
                onArchive={handleArchive}
                isAdmin={isAdmin}
              />
            ))}
          </div>

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
          <Library className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-lg font-medium">No publications</p>
          <p className="text-sm text-muted-foreground mt-1">
            {statusFilter !== "ALL"
              ? `No ${statusFilter.toLowerCase()} publications found.`
              : debouncedSearch
                ? "No publications match your search."
                : "Get started by creating your first publication."}
          </p>
          {isAdmin && !debouncedSearch && statusFilter === "ALL" && (
            <Link href="/slate/publications/new" className="mt-4">
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                New Publication
              </Button>
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
