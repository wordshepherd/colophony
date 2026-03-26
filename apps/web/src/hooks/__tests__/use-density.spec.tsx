import { render, renderHook, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DensityProvider, useDensity } from "../use-density";

describe("useDensity", () => {
  it("provides comfortable density by default", () => {
    const { result } = renderHook(() => useDensity(), {
      wrapper: ({ children }) => (
        <DensityProvider density="comfortable">{children}</DensityProvider>
      ),
    });

    expect(result.current).toEqual({
      density: "comfortable",
      isCompact: false,
      isComfortable: true,
    });
  });

  it("provides compact density when specified", () => {
    const { result } = renderHook(() => useDensity(), {
      wrapper: ({ children }) => (
        <DensityProvider density="compact">{children}</DensityProvider>
      ),
    });

    expect(result.current).toEqual({
      density: "compact",
      isCompact: true,
      isComfortable: false,
    });
  });

  it("inner provider overrides outer", () => {
    const { result } = renderHook(() => useDensity(), {
      wrapper: ({ children }) => (
        <DensityProvider density="comfortable">
          <DensityProvider density="compact">{children}</DensityProvider>
        </DensityProvider>
      ),
    });

    expect(result.current.density).toBe("compact");
    expect(result.current.isCompact).toBe(true);
  });

  it("throws when used outside provider", () => {
    // Suppress console.error from React's error boundary
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});

    expect(() => {
      renderHook(() => useDensity());
    }).toThrow("useDensity must be used within a DensityProvider");

    spy.mockRestore();
  });

  it("sets data-density attribute on wrapper", () => {
    render(
      <DensityProvider density="comfortable">
        <span data-testid="child">content</span>
      </DensityProvider>,
    );

    const child = screen.getByTestId("child");
    const wrapper = child.closest("[data-density]");
    expect(wrapper).not.toBeNull();
    expect(wrapper?.getAttribute("data-density")).toBe("comfortable");
  });
});
