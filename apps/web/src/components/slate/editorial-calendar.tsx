"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { addMonths, subMonths, format } from "date-fns";
import { trpc } from "@/lib/trpc";
import { CalendarGrid } from "./calendar-grid";
import { IssueStatusBadge } from "./issue-status-badge";
import { Button } from "@/components/ui/button";
import {
  FilterTabs,
  FilterTabsList,
  FilterTabsTrigger,
} from "@/components/ui/tabs";
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
import {
  CalendarIcon,
  ChevronLeft,
  ChevronRight,
  LayoutGrid,
  List,
} from "lucide-react";
import type { IssueStatus } from "@colophony/types";

const STATUS_TABS: Array<{ value: IssueStatus | "ALL"; label: string }> = [
  { value: "ALL", label: "All" },
  { value: "PLANNING", label: "Planning" },
  { value: "ASSEMBLING", label: "Assembling" },
  { value: "READY", label: "Ready" },
  { value: "PUBLISHED", label: "Published" },
  { value: "ARCHIVED", label: "Archived" },
];

type ViewMode = "grid" | "list";

export function EditorialCalendar() {
  const router = useRouter();
  const [currentMonth, setCurrentMonth] = useState(() => new Date());
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [statusFilter, setStatusFilter] = useState<IssueStatus | "ALL">("ALL");
  const [publicationFilter, setPublicationFilter] = useState<string>("ALL");

  // Compute UTC month boundaries so the query window is timezone-independent.
  // publicationDate is stored as UTC midnight; local-timezone startOfMonth/endOfMonth
  // would shift the window and miss/include wrong dates near month edges.
  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();
  const utcMonthStart = new Date(Date.UTC(year, month, 1));
  const utcMonthEnd = new Date(Date.UTC(year, month + 1, 0, 23, 59, 59, 999));

  const { data: publications } = trpc.publications.list.useQuery({
    limit: 100,
  });

  const pubMap = new Map(publications?.items.map((p) => [p.id, p.name]) ?? []);

  const { data, isPending, error } = trpc.issues.list.useQuery({
    from: utcMonthStart.toISOString() as unknown as Date,
    to: utcMonthEnd.toISOString() as unknown as Date,
    status: statusFilter === "ALL" ? undefined : statusFilter,
    publicationId: publicationFilter === "ALL" ? undefined : publicationFilter,
    limit: 100,
  });

  const goToToday = () => setCurrentMonth(new Date());
  const goToPrevMonth = () => setCurrentMonth((m) => subMonths(m, 1));
  const goToNextMonth = () => setCurrentMonth((m) => addMonths(m, 1));

  const handleDayClick = (date: Date) => {
    const dateStr = format(date, "yyyy-MM-dd");
    router.push(`/slate/issues/new?publicationDate=${dateStr}`);
  };

  const handleStatusChange = (value: string) => {
    setStatusFilter(value as IssueStatus | "ALL");
  };

  if (isPending) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-[500px] w-full" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">Editorial Calendar</h1>
        <p className="text-destructive">
          Failed to load calendar: {error.message}
        </p>
      </div>
    );
  }

  const issues = data?.items ?? [];
  const isTruncated = data && data.total > 100;

  return (
    <div className="space-y-6">
      {/* Header with month nav */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold">Editorial Calendar</h1>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={goToPrevMonth}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={goToToday}>
            Today
          </Button>
          <Button variant="outline" size="sm" onClick={goToNextMonth}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <span className="min-w-[160px] text-center text-lg font-semibold">
            {format(currentMonth, "MMMM yyyy")}
          </span>
        </div>

        {/* View toggle */}
        <div className="flex items-center gap-1 rounded-md border p-0.5">
          <Button
            variant={viewMode === "grid" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setViewMode("grid")}
          >
            <LayoutGrid className="mr-1 h-4 w-4" />
            Grid
          </Button>
          <Button
            variant={viewMode === "list" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setViewMode("list")}
          >
            <List className="mr-1 h-4 w-4" />
            List
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        {publications && publications.items.length > 0 && (
          <Select
            value={publicationFilter}
            onValueChange={(v) => setPublicationFilter(v)}
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

        <FilterTabs value={statusFilter} onValueChange={handleStatusChange}>
          <FilterTabsList>
            {STATUS_TABS.map((tab) => (
              <FilterTabsTrigger key={tab.value} value={tab.value}>
                {tab.label}
              </FilterTabsTrigger>
            ))}
          </FilterTabsList>
        </FilterTabs>
      </div>

      {/* Truncation notice */}
      {isTruncated && (
        <p className="text-sm text-muted-foreground">
          Showing 100 of {data.total} issues — filter by publication or status
          to see all.
        </p>
      )}

      {/* Calendar grid or list view */}
      {viewMode === "grid" ? (
        <CalendarGrid
          currentMonth={currentMonth}
          issues={issues}
          onDayClick={handleDayClick}
        />
      ) : (
        <div>
          {issues.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Status</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead>Publication</TableHead>
                  <TableHead>Publication Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {issues.map((issue) => (
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
                      {issue.publicationDate
                        ? new Date(issue.publicationDate).toLocaleDateString(
                            undefined,
                            { timeZone: "UTC" },
                          )
                        : "\u2014"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <CalendarIcon className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-lg font-medium">No issues this month</p>
              <p className="text-sm text-muted-foreground mt-1">
                Click a day on the grid view to create an issue, or adjust your
                filters.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
