"use client";

import { useState } from "react";
import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  FilterTabs,
  FilterTabsList,
  FilterTabsTrigger,
} from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { FormCard } from "./form-card";
import { Plus, FileText, Search } from "lucide-react";
import { toast } from "sonner";
import type { FormStatus } from "@colophony/types";

const SKELETON_ITEMS = Array.from({ length: 6 });

const statusTabs: Array<{ value: FormStatus | "ALL"; label: string }> = [
  { value: "ALL", label: "All" },
  { value: "DRAFT", label: "Drafts" },
  { value: "PUBLISHED", label: "Published" },
  { value: "ARCHIVED", label: "Archived" },
];

export function FormList() {
  const [statusFilter, setStatusFilter] = useState<FormStatus | "ALL">("ALL");
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const limit = 12;
  const utils = trpc.useUtils();

  const {
    data,
    isPending: isLoading,
    error,
  } = trpc.forms.list.useQuery({
    status: statusFilter === "ALL" ? undefined : statusFilter,
    search: search || undefined,
    page,
    limit,
  });

  const publishMutation = trpc.forms.publish.useMutation({
    onSuccess: () => {
      utils.forms.list.invalidate();
      toast.success("Form published");
    },
    onError: (err) => toast.error(err.message),
  });

  const archiveMutation = trpc.forms.archive.useMutation({
    onSuccess: () => {
      utils.forms.list.invalidate();
      toast.success("Form archived");
    },
    onError: (err) => toast.error(err.message),
  });

  const duplicateMutation = trpc.forms.duplicate.useMutation({
    onSuccess: () => {
      utils.forms.list.invalidate();
      toast.success("Form duplicated");
    },
    onError: (err) => toast.error(err.message),
  });

  const deleteMutation = trpc.forms.delete.useMutation({
    onSuccess: () => {
      utils.forms.list.invalidate();
      toast.success("Form deleted");
    },
    onError: (err) => toast.error(err.message),
  });

  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-destructive">
          Failed to load forms: {error.message}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Forms</h1>
          <p className="text-muted-foreground">
            Create and manage submission forms
          </p>
        </div>
        <Link href="/editor/forms/new">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            New Form
          </Button>
        </Link>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4">
        <FilterTabs
          value={statusFilter}
          onValueChange={(v) => {
            setStatusFilter(v as FormStatus | "ALL");
            setPage(1);
          }}
        >
          <FilterTabsList>
            {statusTabs.map((tab) => (
              <FilterTabsTrigger key={tab.value} value={tab.value}>
                {tab.label}
              </FilterTabsTrigger>
            ))}
          </FilterTabsList>
        </FilterTabs>
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search forms..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="pl-9"
          />
        </div>
      </div>

      {/* Loading state */}
      {isLoading && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {SKELETON_ITEMS.map((_, i) => (
            <Skeleton key={i} className="h-36" />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!isLoading && data?.items.length === 0 && (
        <div className="text-center py-12 border rounded-lg">
          <FileText className="mx-auto h-12 w-12 text-muted-foreground" />
          <h3 className="mt-4 text-lg font-semibold">No forms</h3>
          <p className="text-muted-foreground">
            {search
              ? "No forms match your search."
              : statusFilter === "ALL"
                ? "Create your first form to start collecting submissions."
                : `No ${statusFilter.toLowerCase()} forms.`}
          </p>
          {statusFilter === "ALL" && !search && (
            <Link href="/editor/forms/new">
              <Button className="mt-4">
                <Plus className="mr-2 h-4 w-4" />
                Create your first form
              </Button>
            </Link>
          )}
        </div>
      )}

      {/* Forms grid */}
      {!isLoading && data && data.items.length > 0 && (
        <>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {data.items.map((form) => (
              <FormCard
                key={form.id}
                form={form}
                onPublish={(id) => publishMutation.mutate({ id })}
                onArchive={(id) => archiveMutation.mutate({ id })}
                onDuplicate={(id) => duplicateMutation.mutate({ id })}
                onDelete={(id) => deleteMutation.mutate({ id })}
              />
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
