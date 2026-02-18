import { describe, it, expect, vi } from "vitest";
import { createColophonyClient, createSafeColophonyClient } from "./client.js";

/**
 * Creates a mock fetch that captures the request and returns a minimal
 * successful JSON response.
 */
function createMockFetch(
  responseBody: unknown = {
    items: [],
    total: 0,
    page: 1,
    limit: 20,
    totalPages: 0,
  },
) {
  const captured: { request: Request }[] = [];

  const mockFetch = vi.fn(async (request: Request) => {
    captured.push({ request });
    return new Response(JSON.stringify(responseBody), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  });

  return { mockFetch, captured };
}

function clientOptions(overrides: Record<string, unknown> = {}) {
  const { mockFetch } = createMockFetch();
  return {
    baseUrl: "http://localhost:4000/v1",
    auth: { type: "bearer" as const, token: "test-token" },
    fetch: mockFetch,
    ...overrides,
  };
}

describe("createColophonyClient", () => {
  it("sends Bearer token in Authorization header", async () => {
    const { mockFetch, captured } = createMockFetch();
    const client = createColophonyClient({
      ...clientOptions(),
      auth: { type: "bearer", token: "my-jwt-token" },
      fetch: mockFetch,
    });

    await client.submissions.list({});

    expect(captured.length).toBe(1);
    expect(captured[0]!.request.headers.get("Authorization")).toBe(
      "Bearer my-jwt-token",
    );
  });

  it("sends API key in X-Api-Key header", async () => {
    const { mockFetch, captured } = createMockFetch();
    const client = createColophonyClient({
      ...clientOptions(),
      auth: { type: "apiKey", key: "col_live_abc123def456" },
      fetch: mockFetch,
    });

    await client.submissions.list({});

    expect(captured.length).toBe(1);
    expect(captured[0]!.request.headers.get("X-Api-Key")).toBe(
      "col_live_abc123def456",
    );
    expect(captured[0]!.request.headers.get("Authorization")).toBeNull();
  });

  it("calls dynamic token function per-request", async () => {
    const { mockFetch, captured } = createMockFetch();
    let callCount = 0;
    const tokenFn = vi.fn(async () => {
      callCount++;
      return `token-${callCount}`;
    });

    const client = createColophonyClient({
      ...clientOptions(),
      auth: { type: "bearer", token: tokenFn },
      fetch: mockFetch,
    });

    await client.submissions.list({});
    await client.submissions.list({});

    expect(tokenFn).toHaveBeenCalledTimes(2);
    expect(captured[0]!.request.headers.get("Authorization")).toBe(
      "Bearer token-1",
    );
    expect(captured[1]!.request.headers.get("Authorization")).toBe(
      "Bearer token-2",
    );
  });

  it("sends X-Organization-Id header when orgId is provided", async () => {
    const { mockFetch, captured } = createMockFetch();
    const client = createColophonyClient({
      ...clientOptions(),
      orgId: "org-uuid-123",
      fetch: mockFetch,
    });

    await client.submissions.list({});

    expect(captured[0]!.request.headers.get("X-Organization-Id")).toBe(
      "org-uuid-123",
    );
  });

  it("calls dynamic orgId function per-request", async () => {
    const { mockFetch, captured } = createMockFetch();
    let callCount = 0;
    const orgIdFn = vi.fn(async () => {
      callCount++;
      return `org-${callCount}`;
    });

    const client = createColophonyClient({
      ...clientOptions(),
      orgId: orgIdFn,
      fetch: mockFetch,
    });

    await client.submissions.list({});
    await client.submissions.list({});

    expect(orgIdFn).toHaveBeenCalledTimes(2);
    expect(captured[0]!.request.headers.get("X-Organization-Id")).toBe("org-1");
    expect(captured[1]!.request.headers.get("X-Organization-Id")).toBe("org-2");
  });

  it("omits X-Organization-Id header when orgId is not provided", async () => {
    const { mockFetch, captured } = createMockFetch();
    const client = createColophonyClient({
      ...clientOptions(),
      fetch: mockFetch,
    });

    await client.submissions.list({});

    expect(captured[0]!.request.headers.get("X-Organization-Id")).toBeNull();
  });
});

describe("createSafeColophonyClient", () => {
  it("returns 4-value success tuple [null, data, false, true]", async () => {
    const responseBody = {
      items: [],
      total: 0,
      page: 1,
      limit: 20,
      totalPages: 0,
    };
    const { mockFetch } = createMockFetch(responseBody);
    const client = createSafeColophonyClient({
      ...clientOptions(),
      fetch: mockFetch,
    });

    const result = await client.submissions.list({});
    const [error, data, isDefined, isSuccess] = result;

    expect(isSuccess).toBe(true);
    expect(error).toBeNull();
    expect(isDefined).toBe(false);
    expect(data).toEqual(responseBody);
  });

  it("returns 4-value error tuple on failure", async () => {
    const mockFetch = vi.fn(async () => {
      return new Response(
        JSON.stringify({
          code: "UNAUTHORIZED",
          status: 401,
          message: "Not authenticated",
        }),
        {
          status: 401,
          headers: { "Content-Type": "application/json" },
        },
      );
    });

    const client = createSafeColophonyClient({
      ...clientOptions(),
      fetch: mockFetch,
    });

    const result = await client.submissions.list({});
    const [error, data, _isDefined, isSuccess] = result;

    expect(isSuccess).toBe(false);
    expect(data).toBeUndefined();
    expect(error).toBeDefined();
  });
});
