import { describe, it, expect } from "vitest";
import {
  analyticsFilterSchema,
  submissionOverviewStatsSchema,
  timeSeriesFilterSchema,
  agingFilterSchema,
  responseTimeDistributionSchema,
} from "../analytics";

describe("analyticsFilterSchema", () => {
  it("accepts empty object", () => {
    const result = analyticsFilterSchema.parse({});
    expect(result).toEqual({});
  });

  it("coerces date strings to Date", () => {
    const result = analyticsFilterSchema.parse({
      startDate: "2026-01-01T00:00:00Z",
      endDate: "2026-01-31T23:59:59Z",
    });
    expect(result.startDate).toBeInstanceOf(Date);
    expect(result.endDate).toBeInstanceOf(Date);
  });

  it("rejects invalid UUID", () => {
    const result = analyticsFilterSchema.safeParse({
      submissionPeriodId: "not-a-uuid",
    });
    expect(result.success).toBe(false);
  });
});

describe("submissionOverviewStatsSchema", () => {
  it("validates complete object", () => {
    const data = {
      totalSubmissions: 50,
      acceptanceRate: 40.5,
      avgResponseTimeDays: 12.3,
      pendingCount: 10,
      submissionsThisMonth: 8,
      submissionsLastMonth: 15,
    };
    const result = submissionOverviewStatsSchema.parse(data);
    expect(result).toEqual(data);
  });

  it("allows null avgResponseTimeDays", () => {
    const data = {
      totalSubmissions: 0,
      acceptanceRate: 0,
      avgResponseTimeDays: null,
      pendingCount: 0,
      submissionsThisMonth: 0,
      submissionsLastMonth: 0,
    };
    const result = submissionOverviewStatsSchema.parse(data);
    expect(result.avgResponseTimeDays).toBeNull();
  });
});

describe("timeSeriesFilterSchema", () => {
  it("rejects invalid granularity", () => {
    const result = timeSeriesFilterSchema.safeParse({
      granularity: "hourly",
    });
    expect(result.success).toBe(false);
  });

  it("defaults granularity to monthly", () => {
    const result = timeSeriesFilterSchema.parse({});
    expect(result.granularity).toBe("monthly");
  });
});

describe("agingFilterSchema", () => {
  it("defaults thresholdDays to 14", () => {
    const result = agingFilterSchema.parse({});
    expect(result.thresholdDays).toBe(14);
  });

  it("rejects zero thresholdDays", () => {
    const result = agingFilterSchema.safeParse({ thresholdDays: 0 });
    expect(result.success).toBe(false);
  });
});

describe("responseTimeDistributionSchema", () => {
  it("validates bucket structure", () => {
    const data = {
      buckets: [
        { label: "< 7 days", count: 10, minDays: 0, maxDays: 7 },
        { label: "7-14 days", count: 5, minDays: 7, maxDays: 14 },
      ],
      medianDays: 9.5,
    };
    const result = responseTimeDistributionSchema.parse(data);
    expect(result.buckets).toHaveLength(2);
    expect(result.medianDays).toBe(9.5);
  });

  it("allows null medianDays", () => {
    const data = {
      buckets: [],
      medianDays: null,
    };
    const result = responseTimeDistributionSchema.parse(data);
    expect(result.medianDays).toBeNull();
  });
});
