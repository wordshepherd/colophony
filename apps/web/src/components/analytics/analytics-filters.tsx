"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { trpc } from "@/lib/trpc";

interface AnalyticsFiltersProps {
  startDate: string;
  endDate: string;
  submissionPeriodId: string;
  onStartDateChange: (val: string) => void;
  onEndDateChange: (val: string) => void;
  onPeriodChange: (val: string) => void;
}

export function AnalyticsFilters({
  startDate,
  endDate,
  submissionPeriodId,
  onStartDateChange,
  onEndDateChange,
  onPeriodChange,
}: AnalyticsFiltersProps) {
  const { data: periods } = trpc.periods.list.useQuery({
    limit: 100,
  });

  return (
    <div className="flex flex-wrap items-end gap-4">
      <div className="space-y-1">
        <Label htmlFor="startDate">Start Date</Label>
        <Input
          id="startDate"
          type="date"
          value={startDate}
          onChange={(e) => onStartDateChange(e.target.value)}
          className="w-40"
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor="endDate">End Date</Label>
        <Input
          id="endDate"
          type="date"
          value={endDate}
          onChange={(e) => onEndDateChange(e.target.value)}
          className="w-40"
        />
      </div>
      <div className="space-y-1">
        <Label>Submission Period</Label>
        <Select value={submissionPeriodId} onValueChange={onPeriodChange}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="All periods" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All periods</SelectItem>
            {periods?.items.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
