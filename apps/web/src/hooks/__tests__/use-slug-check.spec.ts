import { vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useSlugCheck } from "../use-slug-check";

// --- Mutable mock state ---
let mockData: { available: boolean } | undefined;
let mockIsFetching = false;
let lastQueryArgs: { slug: string } | undefined;
let lastQueryOptions: { enabled: boolean } | undefined;

vi.mock("@/lib/trpc", () => ({
  trpc: {
    organizations: {
      checkSlug: {
        useQuery: (args: { slug: string }, opts: { enabled: boolean }) => {
          lastQueryArgs = args;
          lastQueryOptions = opts;
          return { data: mockData, isFetching: mockIsFetching };
        },
      },
    },
  },
}));

describe("useSlugCheck", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    mockData = undefined;
    mockIsFetching = false;
    lastQueryArgs = undefined;
    lastQueryOptions = undefined;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("debouncing", () => {
    it("should not update debouncedSlug before 300ms", () => {
      const { result, rerender } = renderHook(
        ({ slug }) => useSlugCheck(slug, true),
        { initialProps: { slug: "abc" } },
      );

      rerender({ slug: "abcd" });

      // Before timer fires, debouncedSlug should still be initial value
      expect(result.current.debouncedSlug).toBe("abc");
    });

    it("should update debouncedSlug after 300ms", () => {
      const { result, rerender } = renderHook(
        ({ slug }) => useSlugCheck(slug, true),
        { initialProps: { slug: "abc" } },
      );

      rerender({ slug: "abcd" });

      act(() => {
        vi.advanceTimersByTime(300);
      });

      expect(result.current.debouncedSlug).toBe("abcd");
    });

    it("should reset timer on rapid input changes", () => {
      const { result, rerender } = renderHook(
        ({ slug }) => useSlugCheck(slug, true),
        { initialProps: { slug: "abc" } },
      );

      rerender({ slug: "abcd" });
      act(() => {
        vi.advanceTimersByTime(200);
      });

      rerender({ slug: "abcde" });
      act(() => {
        vi.advanceTimersByTime(200);
      });

      // Only 200ms passed since last change — still old value
      expect(result.current.debouncedSlug).toBe("abc");

      act(() => {
        vi.advanceTimersByTime(100);
      });

      expect(result.current.debouncedSlug).toBe("abcde");
    });
  });

  describe("format validation", () => {
    it("should return null isAvailable for slugs < 3 chars", () => {
      renderHook(() => useSlugCheck("ab", true));
      act(() => {
        vi.advanceTimersByTime(300);
      });
      // Query should not be enabled for invalid format
      expect(lastQueryOptions?.enabled).toBe(false);
    });

    it("should return null isAvailable for slugs > 63 chars", () => {
      const longSlug = "a".repeat(64);
      renderHook(() => useSlugCheck(longSlug, true));
      act(() => {
        vi.advanceTimersByTime(300);
      });
      expect(lastQueryOptions?.enabled).toBe(false);
    });

    it("should return null isAvailable for uppercase slugs", () => {
      renderHook(() => useSlugCheck("ABC", true));
      act(() => {
        vi.advanceTimersByTime(300);
      });
      expect(lastQueryOptions?.enabled).toBe(false);
    });

    it("should return null isAvailable for slugs with special chars", () => {
      renderHook(() => useSlugCheck("abc_def", true));
      act(() => {
        vi.advanceTimersByTime(300);
      });
      expect(lastQueryOptions?.enabled).toBe(false);
    });
  });

  describe("API integration", () => {
    it("should disable query when enabled prop is false", () => {
      renderHook(() => useSlugCheck("valid-slug", false));
      act(() => {
        vi.advanceTimersByTime(300);
      });
      expect(lastQueryOptions?.enabled).toBe(false);
    });

    it("should pass slug to query when valid format", () => {
      renderHook(() => useSlugCheck("valid-slug", true));
      act(() => {
        vi.advanceTimersByTime(300);
      });
      expect(lastQueryArgs?.slug).toBe("valid-slug");
      expect(lastQueryOptions?.enabled).toBe(true);
    });

    it("should return isAvailable from API data", () => {
      mockData = { available: true };
      const { result } = renderHook(() => useSlugCheck("valid-slug", true));
      act(() => {
        vi.advanceTimersByTime(300);
      });
      expect(result.current.isAvailable).toBe(true);
    });

    it("should reflect isFetching as isChecking", () => {
      mockIsFetching = true;
      const { result } = renderHook(() => useSlugCheck("valid-slug", true));
      act(() => {
        vi.advanceTimersByTime(300);
      });
      expect(result.current.isChecking).toBe(true);
    });
  });
});
