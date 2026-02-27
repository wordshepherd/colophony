"use client";

import { useState } from "react";
import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { useDebounce } from "@/hooks/use-debounce";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { ManuscriptCard } from "./manuscript-card";
import { Plus, BookOpen, Search } from "lucide-react";

const SKELETON_ITEMS = Array.from({ length: 6 });

export function ManuscriptList() {
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 300);
  const [page, setPage] = useState(1);
  const limit = 12;

  // Reset page when search changes (render-time state adjustment)
  const [prevSearch, setPrevSearch] = useState(debouncedSearch);
  if (prevSearch !== debouncedSearch) {
    setPrevSearch(debouncedSearch);
    setPage(1);
  }

  const {
    data,
    isPending: isLoading,
    error,
  } = trpc.manuscripts.list.useQuery({
    search: debouncedSearch || undefined,
    page,
    limit,
  });

  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-destructive">
          Failed to load manuscripts: {error.message}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">My Manuscripts</h1>
          <p className="text-muted-foreground">
            Manage your creative works and versions
          </p>
        </div>
        <Link href="/manuscripts/new">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            New Manuscript
          </Button>
        </Link>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search manuscripts..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Loading state */}
      {isLoading && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {SKELETON_ITEMS.map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!isLoading && data?.items.length === 0 && (
        <div className="text-center py-12 border rounded-lg">
          <BookOpen className="mx-auto h-12 w-12 text-muted-foreground" />
          <h3 className="mt-4 text-lg font-semibold">No manuscripts</h3>
          <p className="text-muted-foreground">
            {debouncedSearch
              ? "No manuscripts match your search."
              : "You haven't created any manuscripts yet."}
          </p>
          {!debouncedSearch && (
            <Link href="/manuscripts/new">
              <Button className="mt-4">
                <Plus className="mr-2 h-4 w-4" />
                Create your first manuscript
              </Button>
            </Link>
          )}
        </div>
      )}

      {/* Manuscripts grid */}
      {!isLoading && data && data.items.length > 0 && (
        <>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {data.items.map((manuscript) => (
              <ManuscriptCard key={manuscript.id} manuscript={manuscript} />
            ))}
          </div>

          {/* Pagination */}
          {data.totalPages > 1 && (
            <div className="flex justify-center gap-2">
              <Button
                variant="outline"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                Previous
              </Button>
              <span className="flex items-center px-4 text-sm text-muted-foreground">
                Page {page} of {data.totalPages}
              </span>
              <Button
                variant="outline"
                onClick={() => setPage((p) => Math.min(data.totalPages, p + 1))}
                disabled={page === data.totalPages}
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
