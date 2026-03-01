"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface WriterAnalyticsFiltersProps {
  startDate: string;
  endDate: string;
  onStartDateChange: (value: string) => void;
  onEndDateChange: (value: string) => void;
}

export function WriterAnalyticsFilters({
  startDate,
  endDate,
  onStartDateChange,
  onEndDateChange,
}: WriterAnalyticsFiltersProps) {
  return (
    <div className="flex flex-wrap items-end gap-4">
      <div className="space-y-1">
        <Label htmlFor="start-date" className="text-sm">
          From
        </Label>
        <Input
          id="start-date"
          type="date"
          value={startDate}
          onChange={(e) => onStartDateChange(e.target.value)}
          className="w-40"
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor="end-date" className="text-sm">
          To
        </Label>
        <Input
          id="end-date"
          type="date"
          value={endDate}
          onChange={(e) => onEndDateChange(e.target.value)}
          className="w-40"
        />
      </div>
    </div>
  );
}
