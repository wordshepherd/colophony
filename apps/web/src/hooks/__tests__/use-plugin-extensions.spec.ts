import { renderHook } from "@testing-library/react";
import { usePluginExtensions } from "../use-plugin-extensions";

// --- Mutable mock state ---
let mockData: any[] | undefined;
let mockIsPending = false;
let mockError: Error | null = null;
let lastQueryArgs: any;
let lastQueryOptions: any;

jest.mock("@/lib/trpc", () => ({
  trpc: {
    plugins: {
      listExtensions: {
        useQuery: (args: any, opts: any) => {
          lastQueryArgs = args;
          lastQueryOptions = opts;
          return { data: mockData, isPending: mockIsPending, error: mockError };
        },
      },
    },
  },
}));

describe("usePluginExtensions", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockData = undefined;
    mockIsPending = false;
    mockError = null;
    lastQueryArgs = undefined;
    lastQueryOptions = undefined;
  });

  it("returns empty extensions while loading", () => {
    mockIsPending = true;
    mockData = undefined;

    const { result } = renderHook(() =>
      usePluginExtensions("dashboard.widget"),
    );

    expect(result.current.extensions).toEqual([]);
    expect(result.current.isLoading).toBe(true);
  });

  it("returns extensions from tRPC query", () => {
    mockData = [
      {
        point: "dashboard.widget",
        id: "test-widget",
        label: "Test",
        component: "test.widget",
      },
    ];

    const { result } = renderHook(() =>
      usePluginExtensions("dashboard.widget"),
    );

    expect(result.current.extensions).toHaveLength(1);
    expect(result.current.extensions[0].id).toBe("test-widget");
    expect(result.current.isLoading).toBe(false);
  });

  it("passes point parameter to query", () => {
    renderHook(() => usePluginExtensions("settings.section"));

    expect(lastQueryArgs).toEqual({ point: "settings.section" });
    expect(lastQueryOptions).toEqual({ staleTime: 5 * 60 * 1000 });
  });
});
