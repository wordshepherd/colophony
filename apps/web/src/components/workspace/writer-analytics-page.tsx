"use client";

import { useState } from "react";
import { BarChart3 } from "lucide-react";
import { WriterAnalyticsFilters } from "./writer-analytics-filters";
import { WriterOverviewCards } from "./writer-overview-cards";
import { WriterStatusChart } from "./writer-status-chart";
import { WriterTimeSeriesChart } from "./writer-time-series-chart";
import { WriterResponseTimeChart } from "./writer-response-time-chart";
import type { WriterAnalyticsFilter } from "@colophony/types";

export function WriterAnalyticsPage() {
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const filter: WriterAnalyticsFilter = {
    ...(startDate ? { startDate: new Date(startDate) } : {}),
    ...(endDate ? { endDate: new Date(endDate) } : {}),
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2">
          <BarChart3 className="h-6 w-6" />
          <h1 className="text-2xl font-bold">Writer Analytics</h1>
        </div>
        <p className="text-muted-foreground">
          How your submissions are performing over time. Includes both Colophony
          and externally-tracked submissions.
        </p>
      </div>

      {/* Filters */}
      <WriterAnalyticsFilters
        startDate={startDate}
        endDate={endDate}
        onStartDateChange={setStartDate}
        onEndDateChange={setEndDate}
      />

      {/* Overview cards */}
      <WriterOverviewCards filter={filter} />

      {/* Charts — 2-col grid */}
      <div className="grid gap-6 lg:grid-cols-2">
        <div>
          <p className="text-sm text-muted-foreground mb-2">
            Breakdown of your submissions by their current status.
          </p>
          <WriterStatusChart filter={filter} />
        </div>
        <div>
          <p className="text-sm text-muted-foreground mb-2">
            Submissions sent over time.
          </p>
          <WriterTimeSeriesChart filter={filter} />
        </div>
      </div>

      {/* Response time chart — full width */}
      <p className="text-sm text-muted-foreground mb-2">
        How long journals typically take to respond, from submission to first
        decision.
      </p>
      <WriterResponseTimeChart filter={filter} />
    </div>
  );
}
