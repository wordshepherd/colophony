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

const GENRES = [
  { value: "poetry", label: "Poetry" },
  { value: "fiction", label: "Fiction" },
  { value: "creative_nonfiction", label: "Creative Nonfiction" },
  { value: "nonfiction", label: "Nonfiction" },
  { value: "drama", label: "Drama" },
  { value: "translation", label: "Translation" },
  { value: "visual_art", label: "Visual Art" },
  { value: "comics", label: "Comics" },
  { value: "audio", label: "Audio" },
  { value: "other", label: "Other" },
] as const;

interface EditorialAnalyticsFiltersProps {
  startDate: string;
  endDate: string;
  submissionPeriodId: string;
  genre: string;
  onStartDateChange: (val: string) => void;
  onEndDateChange: (val: string) => void;
  onPeriodChange: (val: string) => void;
  onGenreChange: (val: string) => void;
}

export function EditorialAnalyticsFilters({
  startDate,
  endDate,
  submissionPeriodId,
  genre,
  onStartDateChange,
  onEndDateChange,
  onPeriodChange,
  onGenreChange,
}: EditorialAnalyticsFiltersProps) {
  const { data: periods } = trpc.periods.list.useQuery({});

  return (
    <div className="flex flex-wrap items-end gap-4">
      <div className="space-y-1">
        <Label htmlFor="start-date" className="text-xs">
          Start Date
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
        <Label htmlFor="end-date" className="text-xs">
          End Date
        </Label>
        <Input
          id="end-date"
          type="date"
          value={endDate}
          onChange={(e) => onEndDateChange(e.target.value)}
          className="w-40"
        />
      </div>

      <div className="space-y-1">
        <Label htmlFor="period" className="text-xs">
          Period
        </Label>
        <Select value={submissionPeriodId} onValueChange={onPeriodChange}>
          <SelectTrigger id="period" className="w-48">
            <SelectValue placeholder="All Periods" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Periods</SelectItem>
            {periods?.items?.map((p: { id: string; name: string | null }) => (
              <SelectItem key={p.id} value={p.id}>
                {p.name ?? "Unnamed Period"}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1">
        <Label htmlFor="genre" className="text-xs">
          Genre
        </Label>
        <Select value={genre} onValueChange={onGenreChange}>
          <SelectTrigger id="genre" className="w-44">
            <SelectValue placeholder="All Genres" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Genres</SelectItem>
            {GENRES.map((g) => (
              <SelectItem key={g.value} value={g.value}>
                {g.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
