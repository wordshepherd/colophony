import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ProductionStatsCards } from "../production-stats-cards";

describe("ProductionStatsCards", () => {
  it("renders all five stat cards with correct values", () => {
    render(
      <ProductionStatsCards
        summary={{
          total: 12,
          onTrack: 7,
          atRisk: 3,
          overdue: 2,
          waiting: 5,
        }}
      />,
    );

    expect(screen.getByText("Total Pieces")).toBeInTheDocument();
    expect(screen.getByText("12")).toBeInTheDocument();
    expect(screen.getByText("On Track")).toBeInTheDocument();
    expect(screen.getByText("7")).toBeInTheDocument();
    expect(screen.getByText("At Risk")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByText("Overdue")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getByText("Waiting")).toBeInTheDocument();
    expect(screen.getByText("5")).toBeInTheDocument();
  });

  it("renders skeleton loader when loading", () => {
    const { container } = render(
      <ProductionStatsCards
        summary={{
          total: 0,
          onTrack: 0,
          atRisk: 0,
          overdue: 0,
          waiting: 0,
        }}
        isLoading
      />,
    );

    // Should have skeleton elements, not real values
    expect(screen.queryByText("Total Pieces")).not.toBeInTheDocument();
    const skeletons = container.querySelectorAll('[class*="animate-pulse"]');
    expect(skeletons.length).toBeGreaterThan(0);
  });
});
