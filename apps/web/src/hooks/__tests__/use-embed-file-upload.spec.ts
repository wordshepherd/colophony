import { vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useEmbedFileUpload } from "../use-embed-file-upload";

let tusOnProgress:
  | ((bytesUploaded: number, bytesTotal: number) => void)
  | undefined;
let tusOnSuccess: (() => void) | undefined;
let tusOnError: ((error: Error) => void) | undefined;
let tusConstructorArgs: Record<string, unknown>;
const mockTusStart = vi.fn();
const mockTusAbort = vi.fn();

vi.mock("tus-js-client", () => ({
  Upload: vi.fn().mockImplementation(function (
    this: unknown,
    _file: File,
    options: {
      onProgress?: (bytesUploaded: number, bytesTotal: number) => void;
      onSuccess?: () => void;
      onError?: (error: Error) => void;
      headers?: Record<string, string>;
      metadata?: Record<string, string>;
    },
  ) {
    tusOnProgress = options.onProgress;
    tusOnSuccess = options.onSuccess;
    tusOnError = options.onError;
    tusConstructorArgs = options as unknown as Record<string, unknown>;
    return { start: mockTusStart, abort: mockTusAbort };
  }),
}));

describe("useEmbedFileUpload", () => {
  const defaultOptions = {
    manuscriptVersionId: "mv-123",
    guestUserId: "gu-456",
    tusEndpoint: "http://localhost:1080/files/",
    embedToken: "col_emb_testtoken",
    maxFileSize: 50 * 1024 * 1024,
    allowedMimeTypes: ["application/pdf", "text/plain"],
    onUploadComplete: vi.fn(),
    onError: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    tusOnProgress = undefined;
    tusOnSuccess = undefined;
    tusOnError = undefined;
  });

  it("sends X-Embed-Token header to tus", async () => {
    const { result } = renderHook(() => useEmbedFileUpload(defaultOptions));

    const file = new File(["content"], "test.pdf", { type: "application/pdf" });
    await act(async () => {
      await result.current.uploadFile(file);
    });

    expect(tusConstructorArgs.headers).toEqual({
      "X-Embed-Token": "col_emb_testtoken",
    });
  });

  it("includes guest-user-id in tus metadata", async () => {
    const { result } = renderHook(() => useEmbedFileUpload(defaultOptions));

    const file = new File(["content"], "test.pdf", { type: "application/pdf" });
    await act(async () => {
      await result.current.uploadFile(file);
    });

    expect(tusConstructorArgs.metadata).toEqual(
      expect.objectContaining({
        "guest-user-id": "gu-456",
        "manuscript-version-id": "mv-123",
        filename: "test.pdf",
        filetype: "application/pdf",
      }),
    );
  });

  it("rejects disallowed MIME type", async () => {
    const { result } = renderHook(() => useEmbedFileUpload(defaultOptions));

    const file = new File(["<svg>"], "bad.svg", { type: "image/svg+xml" });
    await act(async () => {
      await result.current.uploadFile(file);
    });

    expect(defaultOptions.onError).toHaveBeenCalledWith(
      expect.stringContaining("not allowed"),
    );
    expect(mockTusStart).not.toHaveBeenCalled();
  });

  it("rejects oversized file", async () => {
    const opts = { ...defaultOptions, maxFileSize: 100 };
    const { result } = renderHook(() => useEmbedFileUpload(opts));

    const file = new File(["x".repeat(200)], "big.pdf", {
      type: "application/pdf",
    });
    await act(async () => {
      await result.current.uploadFile(file);
    });

    expect(opts.onError).toHaveBeenCalledWith(
      expect.stringContaining("exceeds maximum"),
    );
    expect(mockTusStart).not.toHaveBeenCalled();
  });

  it("tracks upload progress", async () => {
    const { result } = renderHook(() => useEmbedFileUpload(defaultOptions));

    const file = new File(["content"], "test.pdf", { type: "application/pdf" });
    await act(async () => {
      await result.current.uploadFile(file);
    });

    act(() => {
      tusOnProgress?.(50, 100);
    });

    const uploading = result.current.uploads.find(
      (u) => u.status === "uploading",
    );
    expect(uploading?.progress).toBe(50);
  });

  it("handles tus error with status mapping", async () => {
    const { result } = renderHook(() => useEmbedFileUpload(defaultOptions));

    const file = new File(["content"], "test.pdf", { type: "application/pdf" });
    await act(async () => {
      await result.current.uploadFile(file);
    });

    const tusError = new Error("Upload failed") as Error & {
      originalResponse: { getStatus: () => number };
    };
    (
      tusError as unknown as { originalResponse: { getStatus: () => number } }
    ).originalResponse = { getStatus: () => 413 };

    act(() => {
      tusOnError?.(tusError);
    });

    expect(defaultOptions.onError).toHaveBeenCalledWith("File is too large");
  });

  it("cancelUpload calls abort", async () => {
    const { result } = renderHook(() => useEmbedFileUpload(defaultOptions));

    const file = new File(["content"], "test.pdf", { type: "application/pdf" });
    await act(async () => {
      await result.current.uploadFile(file);
    });

    const uploadId = result.current.uploads[0]?.id;
    expect(uploadId).toBeDefined();

    act(() => {
      result.current.cancelUpload(uploadId!);
    });

    expect(mockTusAbort).toHaveBeenCalledWith(true);
  });

  it("calls onUploadComplete on success", async () => {
    const { result } = renderHook(() => useEmbedFileUpload(defaultOptions));

    const file = new File(["content"], "test.pdf", { type: "application/pdf" });
    await act(async () => {
      await result.current.uploadFile(file);
    });

    act(() => {
      tusOnSuccess?.();
    });

    expect(defaultOptions.onUploadComplete).toHaveBeenCalled();
  });
});
