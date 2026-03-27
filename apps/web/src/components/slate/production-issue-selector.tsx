"use client";

import { useEffect } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { format } from "date-fns";

interface ProductionIssueSelectorProps {
  selectedIssueId: string | null;
  onSelect: (id: string) => void;
}

export function ProductionIssueSelector({
  selectedIssueId,
  onSelect,
}: ProductionIssueSelectorProps) {
  const { data: issues, isPending: isLoading } =
    trpc.issues.activeIssues.useQuery();

  // Auto-select first issue if none selected
  useEffect(() => {
    if (!selectedIssueId && issues && issues.length > 0) {
      onSelect(issues[0].id);
    }
  }, [selectedIssueId, issues, onSelect]);

  if (isLoading) {
    return <div className="h-9 w-64 animate-pulse rounded-md bg-muted" />;
  }

  if (!issues || issues.length === 0) {
    return null;
  }

  return (
    <Select value={selectedIssueId ?? undefined} onValueChange={onSelect}>
      <SelectTrigger className="w-64">
        <SelectValue placeholder="Select an issue" />
      </SelectTrigger>
      <SelectContent>
        {issues.map((issue) => (
          <SelectItem key={issue.id} value={issue.id}>
            {issue.title}
            {issue.publicationDate && (
              <span className="ml-2 text-muted-foreground">
                — {format(new Date(issue.publicationDate), "MMM d, yyyy")}
              </span>
            )}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
