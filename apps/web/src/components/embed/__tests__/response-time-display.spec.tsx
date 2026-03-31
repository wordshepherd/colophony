import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ResponseTimeDisplay } from "../response-time-display";
import type { PublicResponseTimeStats } from "@colophony/types";

function makeStats(
  overrides: Partial<PublicResponseTimeStats> = {},
): PublicResponseTimeStats {
  return {
    medianDays: 18.5,
    buckets: [
      {
        label: "Under 1 week",
        count: 2,
        percentage: 8,
        minDays: 0,
        maxDays: 7,
      },
      {
        label: "1\u20132 weeks",
        count: 5,
        percentage: 20,
        minDays: 7,
        maxDays: 14,
      },
      {
        label: "2\u20134 weeks",
        count: 10,
        percentage: 40,
        minDays: 14,
        maxDays: 28,
      },
      {
        label: "1\u20132 months",
        count: 5,
        percentage: 20,
        minDays: 28,
        maxDays: 60,
      },
      {
        label: "2\u20133 months",
        count: 2,
        percentage: 8,
        minDays: 60,
        maxDays: 90,
      },
      {
        label: "Over 3 months",
        count: 1,
        percentage: 4,
        minDays: 90,
        maxDays: null,
      },
    ],
    trend: [
      { month: "2026-01", medianDays: 22.0 },
      { month: "2026-02", medianDays: 18.5 },
    ],
    sampleSize: 25,
    source: "local",
    updatedAt: "2026-03-30T12:00:00.000Z",
    ...overrides,
  };
}

describe("ResponseTimeDisplay", () => {
  it("renders nothing when stats are null", () => {
    const { container } = render(<ResponseTimeDisplay stats={null} />);
    expect(container.firstChild).toBeNull();
  });

  it("renders median days headline", () => {
    render(<ResponseTimeDisplay stats={makeStats()} />);
    expect(screen.getByText(/~3 weeks/)).toBeInTheDocument();
    expect(screen.getByText(/typical response/)).toBeInTheDocument();
  });

  it("renders bucket bars with percentages", () => {
    render(<ResponseTimeDisplay stats={makeStats()} />);
    expect(screen.getByText("Under 1 week")).toBeInTheDocument();
    expect(screen.getAllByText("8%")).toHaveLength(2); // Under 1 week + 2-3 months
    expect(screen.getByText("40%")).toBeInTheDocument();
  });

  it("renders sample size", () => {
    render(<ResponseTimeDisplay stats={makeStats()} />);
    expect(
      screen.getByText(/based on 25 decided submissions/i),
    ).toBeInTheDocument();
  });

  it("shows trend indicator when trend data available", () => {
    render(<ResponseTimeDisplay stats={makeStats()} />);
    // Trend is going down (22 → 18.5), should show "Getting faster"
    expect(screen.getByText("Getting faster")).toBeInTheDocument();
  });

  it("hides empty buckets", () => {
    const stats = makeStats({
      buckets: [
        {
          label: "Under 1 week",
          count: 0,
          percentage: 0,
          minDays: 0,
          maxDays: 7,
        },
        {
          label: "2\u20134 weeks",
          count: 10,
          percentage: 100,
          minDays: 14,
          maxDays: 28,
        },
      ],
    });
    render(<ResponseTimeDisplay stats={stats} />);
    expect(screen.queryByText("Under 1 week")).not.toBeInTheDocument();
    expect(screen.getByText("2\u20134 weeks")).toBeInTheDocument();
  });
});
