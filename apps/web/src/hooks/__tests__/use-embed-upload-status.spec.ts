import { renderHook, act } from "@testing-library/react";
import { useEmbedUploadStatus } from "../use-embed-upload-status";

const mockFetchUploadStatus = jest.fn();

jest.mock("@/lib/embed-api", () => ({
  fetchUploadStatus: (...args: unknown[]) => mockFetchUploadStatus(...args),
}));

describe("useEmbedUploadStatus", () => {
  const defaultOptions = {
    apiUrl: "http://localhost:4000",
    token: "col_emb_test",
    manuscriptVersionId: "mv-123",
    email: "test@example.com",
    enabled: true,
    uploadsInFlight: false,
  };

  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("polls every 3s when enabled", async () => {
    mockFetchUploadStatus.mockResolvedValue({
      files: [
        {
          id: "f1",
          filename: "a.pdf",
          size: 100,
          mimeType: "application/pdf",
          scanStatus: "PENDING",
        },
      ],
      allClean: false,
    });

    renderHook(() => useEmbedUploadStatus(defaultOptions));

    // Initial poll
    await act(async () => {
      await jest.advanceTimersByTimeAsync(0);
    });
    expect(mockFetchUploadStatus).toHaveBeenCalledTimes(1);

    // After 3 seconds
    await act(async () => {
      await jest.advanceTimersByTimeAsync(3000);
    });
    expect(mockFetchUploadStatus).toHaveBeenCalledTimes(2);

    // After 6 seconds total
    await act(async () => {
      await jest.advanceTimersByTimeAsync(3000);
    });
    expect(mockFetchUploadStatus).toHaveBeenCalledTimes(3);
  });

  it("stops when allClean and no uploads in flight", async () => {
    mockFetchUploadStatus.mockResolvedValue({
      files: [
        {
          id: "f1",
          filename: "a.pdf",
          size: 100,
          mimeType: "application/pdf",
          scanStatus: "CLEAN",
        },
      ],
      allClean: true,
    });

    const { result } = renderHook(() =>
      useEmbedUploadStatus({ ...defaultOptions, uploadsInFlight: false }),
    );

    await act(async () => {
      await jest.advanceTimersByTimeAsync(0);
    });

    expect(result.current.allClean).toBe(true);

    // After many more intervals, no additional calls
    const callCount = mockFetchUploadStatus.mock.calls.length;
    await act(async () => {
      await jest.advanceTimersByTimeAsync(9000);
    });
    expect(mockFetchUploadStatus).toHaveBeenCalledTimes(callCount);
  });

  it("keeps polling when uploads in flight even if no files yet", async () => {
    mockFetchUploadStatus.mockResolvedValue({
      files: [],
      allClean: false,
    });

    renderHook(() =>
      useEmbedUploadStatus({ ...defaultOptions, uploadsInFlight: true }),
    );

    await act(async () => {
      await jest.advanceTimersByTimeAsync(0);
    });
    const initial = mockFetchUploadStatus.mock.calls.length;

    await act(async () => {
      await jest.advanceTimersByTimeAsync(6000);
    });
    // Should keep polling
    expect(mockFetchUploadStatus.mock.calls.length).toBeGreaterThan(initial);
  });

  it("backs off on 429", async () => {
    const error = { status: 429, message: "Rate limited", retryAfter: 10 };
    mockFetchUploadStatus.mockRejectedValueOnce(error);
    mockFetchUploadStatus.mockResolvedValue({
      files: [
        {
          id: "f1",
          filename: "a.pdf",
          size: 100,
          mimeType: "application/pdf",
          scanStatus: "PENDING",
        },
      ],
      allClean: false,
    });

    renderHook(() => useEmbedUploadStatus(defaultOptions));

    // Initial poll triggers 429
    await act(async () => {
      await jest.advanceTimersByTimeAsync(0);
    });

    // After 3s (old interval), should not have polled again yet
    await act(async () => {
      await jest.advanceTimersByTimeAsync(3000);
    });
    const callsAt3s = mockFetchUploadStatus.mock.calls.length;

    // After 10s (retryAfter), should have polled again
    await act(async () => {
      await jest.advanceTimersByTimeAsync(7000);
    });
    expect(mockFetchUploadStatus.mock.calls.length).toBeGreaterThan(callsAt3s);
  });

  it("cleans up on unmount", async () => {
    mockFetchUploadStatus.mockResolvedValue({
      files: [
        {
          id: "f1",
          filename: "a.pdf",
          size: 100,
          mimeType: "application/pdf",
          scanStatus: "PENDING",
        },
      ],
      allClean: false,
    });

    const { unmount } = renderHook(() => useEmbedUploadStatus(defaultOptions));

    await act(async () => {
      await jest.advanceTimersByTimeAsync(0);
    });
    const callsBeforeUnmount = mockFetchUploadStatus.mock.calls.length;

    unmount();

    await act(async () => {
      await jest.advanceTimersByTimeAsync(9000);
    });
    // No additional calls after unmount
    expect(mockFetchUploadStatus).toHaveBeenCalledTimes(callsBeforeUnmount);
  });

  it("does not poll when disabled", async () => {
    renderHook(() =>
      useEmbedUploadStatus({ ...defaultOptions, enabled: false }),
    );

    await act(async () => {
      await jest.advanceTimersByTimeAsync(10000);
    });

    expect(mockFetchUploadStatus).not.toHaveBeenCalled();
  });
});
