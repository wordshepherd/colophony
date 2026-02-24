"use client";

import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  isToday,
  format,
} from "date-fns";
import { cn } from "@/lib/utils";
import { CalendarIssueBadge } from "./calendar-issue-badge";
import type { IssueStatus } from "@colophony/types";

const DAY_HEADERS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MAX_VISIBLE_ISSUES = 3;

interface CalendarGridProps {
  currentMonth: Date;
  issues: Array<{
    id: string;
    title: string;
    status: IssueStatus;
    publicationDate: string | null;
    publicationId: string;
  }>;
  onDayClick?: (date: Date) => void;
}

export function CalendarGrid({
  currentMonth,
  issues,
  onDayClick,
}: CalendarGridProps) {
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calendarStart = startOfWeek(monthStart);
  const calendarEnd = endOfWeek(monthEnd);

  const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  // Group issues by date string (YYYY-MM-DD)
  const issuesByDate = new Map<string, typeof issues>();
  for (const issue of issues) {
    if (!issue.publicationDate) continue;
    const dateKey = format(new Date(issue.publicationDate), "yyyy-MM-dd");
    const existing = issuesByDate.get(dateKey) ?? [];
    existing.push(issue);
    issuesByDate.set(dateKey, existing);
  }

  return (
    <div className="border rounded-lg overflow-hidden">
      {/* Day-of-week headers */}
      <div className="grid grid-cols-7 border-b bg-muted/50">
        {DAY_HEADERS.map((day) => (
          <div
            key={day}
            className="px-2 py-2 text-center text-xs font-medium text-muted-foreground"
          >
            {day}
          </div>
        ))}
      </div>

      {/* Day cells */}
      <div className="grid grid-cols-7">
        {days.map((day) => {
          const dateKey = format(day, "yyyy-MM-dd");
          const dayIssues = issuesByDate.get(dateKey) ?? [];
          const inCurrentMonth = isSameMonth(day, currentMonth);
          const today = isToday(day);
          const overflowCount = dayIssues.length - MAX_VISIBLE_ISSUES;

          return (
            <div
              key={dateKey}
              className={cn(
                "min-h-[100px] border-b border-r p-1 transition-colors",
                !inCurrentMonth && "bg-muted/30",
                onDayClick && "cursor-pointer hover:bg-accent/30",
              )}
              onClick={() => onDayClick?.(day)}
            >
              {/* Date number */}
              <div className="flex justify-end">
                <span
                  className={cn(
                    "inline-flex h-6 w-6 items-center justify-center rounded-full text-xs",
                    today && "bg-primary text-primary-foreground font-bold",
                    !inCurrentMonth && "text-muted-foreground/50",
                    inCurrentMonth && !today && "text-foreground",
                  )}
                >
                  {format(day, "d")}
                </span>
              </div>

              {/* Issue badges */}
              <div className="mt-0.5 space-y-0.5">
                {dayIssues.slice(0, MAX_VISIBLE_ISSUES).map((issue) => (
                  <div key={issue.id} onClick={(e) => e.stopPropagation()}>
                    <CalendarIssueBadge issue={issue} />
                  </div>
                ))}
                {overflowCount > 0 && (
                  <span className="block text-xs text-muted-foreground px-1.5">
                    +{overflowCount} more
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
