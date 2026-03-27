"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CollectionCard } from "@/components/collections/collection-card";
import { CollectionForm } from "@/components/collections/collection-form";
import { Plus, Search } from "lucide-react";
import type {
  CollectionTypeHint,
  CollectionVisibility,
} from "@colophony/types";

export default function CollectionsPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [typeHint, setTypeHint] = useState<CollectionTypeHint | "all">("all");
  const [visibility, setVisibility] = useState<CollectionVisibility | "all">(
    "all",
  );
  const [showForm, setShowForm] = useState(false);

  const utils = trpc.useUtils();
  const { data, isPending: isLoading } = trpc.collections.list.useQuery({
    page,
    limit: 20,
    search: search || undefined,
    typeHint: typeHint === "all" ? undefined : typeHint,
    visibility: visibility === "all" ? undefined : visibility,
  });

  const createMutation = trpc.collections.create.useMutation({
    onSuccess: () => {
      utils.collections.list.invalidate();
      setShowForm(false);
    },
  });

  const collections = data?.items ?? [];
  const totalPages = data?.totalPages ?? 1;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Collections</h1>
          <p className="text-muted-foreground">
            Organize submissions into reading lists, holds, and working groups.
          </p>
        </div>
        <Button
          onClick={() => setShowForm(true)}
          data-testid="new-collection-btn"
        >
          <Plus className="mr-2 h-4 w-4" />
          New Collection
        </Button>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search collections..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="pl-8"
          />
        </div>
        <Select
          value={typeHint}
          onValueChange={(v) => {
            setTypeHint(v as CollectionTypeHint | "all");
            setPage(1);
          }}
        >
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="All types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            <SelectItem value="holds">Holds</SelectItem>
            <SelectItem value="reading_list">Reading List</SelectItem>
            <SelectItem value="comparison">Comparison</SelectItem>
            <SelectItem value="issue_planning">Issue Planning</SelectItem>
            <SelectItem value="custom">Custom</SelectItem>
          </SelectContent>
        </Select>
        <Select
          value={visibility}
          onValueChange={(v) => {
            setVisibility(v as CollectionVisibility | "all");
            setPage(1);
          }}
        >
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="All visibility" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All visibility</SelectItem>
            <SelectItem value="private">Private</SelectItem>
            <SelectItem value="team">Team</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }, (_, i) => (
            <div
              key={i}
              className="h-32 rounded-lg border bg-muted animate-pulse"
            />
          ))}
        </div>
      ) : collections.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          {search || typeHint !== "all" || visibility !== "all"
            ? "No collections match your filters."
            : "No collections yet. Create one to start organizing submissions."}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {collections.map((collection) => (
              <CollectionCard key={collection.id} collection={collection} />
            ))}
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
              >
                Previous
              </Button>
              <span className="text-sm text-muted-foreground">
                Page {page} of {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
              >
                Next
              </Button>
            </div>
          )}
        </>
      )}

      <CollectionForm
        open={showForm}
        onOpenChange={setShowForm}
        onSubmit={(data) => createMutation.mutate(data)}
        isSubmitting={createMutation.isPending}
      />
    </div>
  );
}
