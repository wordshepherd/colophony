import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Network } from "lucide-react";
import { HealthCard } from "../health-card";

describe("HealthCard", () => {
  it("renders title, metric, and subtitle", () => {
    render(
      <HealthCard
        title="Federation"
        status="healthy"
        metric="12 active"
        subtitle="2 pending"
        icon={Network}
      />,
    );

    expect(screen.getByText("Federation")).toBeInTheDocument();
    expect(screen.getByText("12 active")).toBeInTheDocument();
    expect(screen.getByText("2 pending")).toBeInTheDocument();
  });

  it("applies green styling for healthy status", () => {
    render(
      <HealthCard title="Test" status="healthy" metric="OK" icon={Network} />,
    );

    const metric = screen.getByText("OK");
    expect(metric.className).toContain("text-status-success");
  });

  it("applies yellow styling for degraded status", () => {
    render(
      <HealthCard
        title="Test"
        status="degraded"
        metric="3 stale"
        icon={Network}
      />,
    );

    const metric = screen.getByText("3 stale");
    expect(metric.className).toContain("text-status-warning");
  });

  it("applies red styling for unhealthy status", () => {
    render(
      <HealthCard
        title="Test"
        status="unhealthy"
        metric="5 failed"
        icon={Network}
      />,
    );

    const metric = screen.getByText("5 failed");
    expect(metric.className).toContain("text-status-error");
  });

  it("renders skeleton when status is loading", () => {
    const { container } = render(
      <HealthCard title="Test" status="loading" metric="" icon={Network} />,
    );

    expect(screen.queryByText("Test")).not.toBeInTheDocument();
    const skeletons = container.querySelectorAll('[class*="animate-pulse"]');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it("wraps in Link when href is provided", () => {
    const { container } = render(
      <HealthCard
        title="Federation"
        status="healthy"
        metric="12 active"
        icon={Network}
        href="/federation"
      />,
    );

    const link = container.querySelector("a");
    expect(link).toBeInTheDocument();
    expect(link?.getAttribute("href")).toBe("/federation");
  });

  it("calls onClick when clicked without href", () => {
    const handleClick = vi.fn();
    render(
      <HealthCard
        title="Queues"
        status="healthy"
        metric="0 waiting"
        icon={Network}
        onClick={handleClick}
      />,
    );

    fireEvent.click(screen.getByText("0 waiting"));
    expect(handleClick).toHaveBeenCalledOnce();
  });
});
