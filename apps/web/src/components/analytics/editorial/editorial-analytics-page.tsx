"use client";

import { useState, useMemo } from "react";
import type { EditorialAnalyticsFilter } from "@colophony/types";
import { EditorialAnalyticsFilters } from "./editorial-analytics-filters";
import { EditorialOverviewCards } from "./editorial-overview-cards";
import { AcceptanceByGenreChart } from "./acceptance-by-genre-chart";
import { AcceptanceByPeriodChart } from "./acceptance-by-period-chart";
import { ResponseTimeTrendChart } from "./response-time-trend-chart";
import { PipelineHealthChart } from "./pipeline-health-chart";
import { GenreDistributionChart } from "./genre-distribution-chart";
import { ContributorDiversityChart } from "./contributor-diversity-chart";
import { ReaderAlignmentTable } from "./reader-alignment-table";

export function EditorialAnalyticsPage() {
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [submissionPeriodId, setSubmissionPeriodId] = useState("all");
  const [genre, setGenre] = useState("all");

  const filter: EditorialAnalyticsFilter = useMemo(() => {
    const f: EditorialAnalyticsFilter = {};
    if (startDate) f.startDate = new Date(startDate);
    if (endDate) f.endDate = new Date(endDate);
    if (submissionPeriodId && submissionPeriodId !== "all")
      f.submissionPeriodId = submissionPeriodId;
    if (genre && genre !== "all") f.genre = genre;
    return f;
  }, [startDate, endDate, submissionPeriodId, genre]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Editorial Analytics</h1>
        <p className="text-muted-foreground mt-1">
          Editorial performance insights: acceptance rates, response times,
          pipeline health, and reader alignment.
        </p>
      </div>

      <EditorialAnalyticsFilters
        startDate={startDate}
        endDate={endDate}
        submissionPeriodId={submissionPeriodId}
        genre={genre}
        onStartDateChange={setStartDate}
        onEndDateChange={setEndDate}
        onPeriodChange={setSubmissionPeriodId}
        onGenreChange={setGenre}
      />

      <EditorialOverviewCards filter={filter} />

      <div className="grid gap-6 lg:grid-cols-2">
        <AcceptanceByGenreChart filter={filter} />
        <GenreDistributionChart filter={filter} />
      </div>

      <AcceptanceByPeriodChart filter={filter} />

      <div className="grid gap-6 lg:grid-cols-2">
        <ResponseTimeTrendChart filter={filter} />
        <PipelineHealthChart filter={filter} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <ContributorDiversityChart filter={filter} />
        <ReaderAlignmentTable filter={filter} />
      </div>
    </div>
  );
}
