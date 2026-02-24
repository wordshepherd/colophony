"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { trpc } from "@/lib/trpc";
import { useOrganization } from "@/hooks/use-organization";
import { IssueStatusBadge } from "./issue-status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { BookCopy, Plus, X } from "lucide-react";
import type { IssueStatus } from "@colophony/types";

const STATUS_TABS: Array<{ value: IssueStatus | "ALL"; label: string }> = [
  { value: "ALL", label: "All" },
  { value: "PLANNING", label: "Planning" },
  { value: "ASSEMBLING", label: "Assembling" },
  { value: "READY", label: "Ready" },
  { value: "PUBLISHED", label: "Published" },
  { value: "ARCHIVED", label: "Archived" },
];

export function IssueList() {
  const { isAdmin } = useOrganization();
  const [statusFilter, setStatusFilter] = useState<IssueStatus | "ALL">("ALL");
  const [publicationFilter, setPublicationFilter] = useState<string>("ALL");
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

  const { data: publications } = trpc.publications.list.useQuery({
    limit: 100,
  });

  const pubMap = new Map(publications?.items.map((p) => [p.id, p.name]) ?? []);

  const { data, isPending, error } = trpc.issues.list.useQuery({
    status: statusFilter === "ALL" ? undefined : statusFilter,
    publicationId: publicationFilter === "ALL" ? undefined : publicationFilter,
    search: debouncedSearch || undefined,
    page,
    limit: 20,
  });

  // Clamp page when data shrinks (render-time state adjustment)
  if (data && data.totalPages > 0 && page > data.totalPages) {
    setPage(data.totalPages);
  }

  const handleStatusChange = (value: string) => {
    setStatusFilter(value as IssueStatus | "ALL");
    setPage(1);
  };

  if (isPending) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-10 w-full max-w-sm" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">Issues</h1>
        <p className="text-destructive">
          Failed to load issues: {error.message}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Issues</h1>
        {isAdmin && (
          <Link href="/slate/issues/new">
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              New Issue
            </Button>
          </Link>
        )}
      </div>

      {/* Search + Publication filter */}
      <div className="flex items-center gap-4">
        <div className="relative max-w-sm flex-1">
          <Input
            placeholder="Search issues..."
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
        {publications && publications.items.length > 0 && (
          <Select
            value={publicationFilter}
            onValueChange={(v) => {
              setPublicationFilter(v);
              setPage(1);
            }}
          >
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="All Publications" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Publications</SelectItem>
              {publications.items.map((pub) => (
                <SelectItem key={pub.id} value={pub.id}>
                  {pub.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
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

      {/* Table or empty state */}
      {data && data.items.length > 0 ? (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Status</TableHead>
                <TableHead>Title</TableHead>
                <TableHead>Publication</TableHead>
                <TableHead>Vol / Issue</TableHead>
                <TableHead>Pub Date</TableHead>
                <TableHead>Updated</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.items.map((issue) => (
                <TableRow key={issue.id}>
                  <TableCell>
                    <IssueStatusBadge status={issue.status} />
                  </TableCell>
                  <TableCell>
                    <Link
                      href={`/slate/issues/${issue.id}`}
                      className="font-medium hover:underline"
                    >
                      {issue.title}
                    </Link>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {pubMap.get(issue.publicationId) ??
                      `${issue.publicationId.slice(0, 8)}\u2026`}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {issue.volume != null || issue.issueNumber != null
                      ? `${issue.volume ?? "\u2014"} / ${issue.issueNumber ?? "\u2014"}`
                      : "\u2014"}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {issue.publicationDate
                      ? new Date(issue.publicationDate).toLocaleDateString()
                      : "\u2014"}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatDistanceToNow(new Date(issue.updatedAt), {
                      addSuffix: true,
                    })}
                  </TableCell>
                </TableRow>
              ))}
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
          <BookCopy className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-lg font-medium">No issues</p>
          <p className="text-sm text-muted-foreground mt-1">
            {statusFilter !== "ALL"
              ? "No issues with this status."
              : debouncedSearch
                ? "No issues match your search."
                : "Create your first issue to start assembling a publication."}
          </p>
        </div>
      )}
    </div>
  );
}
