"use client";

import { useState, useMemo } from "react";
import type { AnalyticsFilter } from "@colophony/types";
import { AnalyticsFilters } from "./analytics-filters";
import { OverviewStatsCards } from "./overview-stats-cards";
import { StatusBreakdownChart } from "./status-breakdown-chart";
import { FunnelChart } from "./funnel-chart";
import { TimeSeriesChart } from "./time-series-chart";
import { ResponseTimeChart } from "./response-time-chart";
import { AgingTable } from "./aging-table";

export function SubmissionAnalyticsPage() {
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [submissionPeriodId, setSubmissionPeriodId] = useState("all");

  const filter: AnalyticsFilter = useMemo(() => {
    const f: AnalyticsFilter = {};
    if (startDate) f.startDate = new Date(startDate);
    if (endDate) f.endDate = new Date(endDate);
    if (submissionPeriodId && submissionPeriodId !== "all")
      f.submissionPeriodId = submissionPeriodId;
    return f;
  }, [startDate, endDate, submissionPeriodId]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Submission Analytics</h1>
        <p className="text-muted-foreground mt-1">
          Track submission trends, response times, and workflow performance.
        </p>
      </div>

      <AnalyticsFilters
        startDate={startDate}
        endDate={endDate}
        submissionPeriodId={submissionPeriodId}
        onStartDateChange={setStartDate}
        onEndDateChange={setEndDate}
        onPeriodChange={setSubmissionPeriodId}
      />

      <OverviewStatsCards filter={filter} />

      <div className="grid gap-6 lg:grid-cols-2">
        <StatusBreakdownChart filter={filter} />
        <FunnelChart filter={filter} />
      </div>

      <TimeSeriesChart filter={filter} />

      <div className="grid gap-6 lg:grid-cols-2">
        <ResponseTimeChart filter={filter} />
        <AgingTable filter={filter} />
      </div>
    </div>
  );
}
