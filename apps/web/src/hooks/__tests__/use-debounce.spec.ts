import { renderHook, act } from "@testing-library/react";
import { useDebounce } from "../use-debounce";

describe("useDebounce", () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  it("returns initial value immediately", () => {
    const { result } = renderHook(() => useDebounce("hello", 300));
    expect(result.current).toBe("hello");
  });

  it("debounces value updates by specified delay", () => {
    jest.useFakeTimers();

    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebounce(value, delay),
      { initialProps: { value: "a", delay: 300 } },
    );

    expect(result.current).toBe("a");

    // Update value
    rerender({ value: "b", delay: 300 });
    expect(result.current).toBe("a"); // not yet updated

    // Advance partially
    act(() => jest.advanceTimersByTime(200));
    expect(result.current).toBe("a"); // still waiting

    // Advance past delay
    act(() => jest.advanceTimersByTime(150));
    expect(result.current).toBe("b"); // now updated
  });

  it("cancels pending debounce on unmount", () => {
    jest.useFakeTimers();

    const { result, rerender, unmount } = renderHook(
      ({ value, delay }) => useDebounce(value, delay),
      { initialProps: { value: "a", delay: 300 } },
    );

    rerender({ value: "b", delay: 300 });
    expect(result.current).toBe("a");

    unmount();

    // Timer should have been cleared — no errors from state update after unmount
    act(() => jest.advanceTimersByTime(500));
  });
});
