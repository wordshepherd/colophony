import { renderHook, act } from "@testing-library/react";
import { useFileUpload } from "../use-file-upload";

// Track tus Upload instances
let tusOnProgress:
  | ((bytesUploaded: number, bytesTotal: number) => void)
  | undefined;
let tusOnSuccess: (() => void) | undefined;
let tusOnError: ((error: Error) => void) | undefined;
const mockTusStart = jest.fn();
const mockTusAbort = jest.fn();

jest.mock("tus-js-client", () => ({
  Upload: jest.fn().mockImplementation(
    (
      _file: File,
      options: {
        onProgress?: (bytesUploaded: number, bytesTotal: number) => void;
        onSuccess?: () => void;
        onError?: (error: Error) => void;
      },
    ) => {
      tusOnProgress = options.onProgress;
      tusOnSuccess = options.onSuccess;
      tusOnError = options.onError;
      return { start: mockTusStart, abort: mockTusAbort };
    },
  ),
}));

// Mock tRPC
const trpcMock = {
  invalidateFiles: jest.fn(),
};

jest.mock("@/lib/trpc", () => ({
  trpc: {
    useUtils: () => ({
      files: {
        listBySubmission: {
          invalidate: (...args: unknown[]) => trpcMock.invalidateFiles(...args),
        },
      },
    }),
  },
  getAccessToken: jest.fn(() => Promise.resolve("test-token")),
  getCurrentOrgId: jest.fn(() => "org-123"),
  getTusEndpoint: jest.fn(() => "http://localhost:1080/files/"),
}));

const mockInvalidateFiles = trpcMock.invalidateFiles;

describe("useFileUpload", () => {
  const defaultOptions = {
    submissionId: "sub-123",
    onUploadComplete: jest.fn(),
    onError: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    tusOnProgress = undefined;
    tusOnSuccess = undefined;
    tusOnError = undefined;
  });

  it("should start with no uploads", () => {
    const { result } = renderHook(() => useFileUpload(defaultOptions));
    expect(result.current.uploads).toEqual([]);
    expect(result.current.isUploading).toBe(false);
  });

  it("should add file to uploads and start tus upload", async () => {
    const { result } = renderHook(() => useFileUpload(defaultOptions));
    const file = new File(["content"], "test.pdf", {
      type: "application/pdf",
    });

    await act(async () => {
      await result.current.uploadFile(file);
    });

    expect(mockTusStart).toHaveBeenCalled();
    expect(result.current.uploads.length).toBe(1);
    expect(result.current.uploads[0].status).toBe("uploading");
    expect(result.current.isUploading).toBe(true);
  });

  it("should track upload progress", async () => {
    const { result } = renderHook(() => useFileUpload(defaultOptions));
    const file = new File(["content"], "test.pdf", {
      type: "application/pdf",
    });

    await act(async () => {
      await result.current.uploadFile(file);
    });

    act(() => {
      tusOnProgress?.(50, 100);
    });

    expect(result.current.uploads[0].progress).toBe(50);
  });

  it("should handle upload success", async () => {
    jest.useFakeTimers();
    const { result } = renderHook(() => useFileUpload(defaultOptions));
    const file = new File(["content"], "test.pdf", {
      type: "application/pdf",
    });

    await act(async () => {
      await result.current.uploadFile(file);
    });

    act(() => {
      tusOnSuccess?.();
    });

    expect(result.current.uploads[0].status).toBe("processing");
    expect(result.current.uploads[0].scanStatus).toBe("PENDING");

    // Invalidation is delayed to allow post-finish webhook to complete
    expect(mockInvalidateFiles).not.toHaveBeenCalled();

    await act(async () => {
      jest.advanceTimersByTime(1500);
    });

    expect(mockInvalidateFiles).toHaveBeenCalledWith({
      submissionId: "sub-123",
    });
    expect(defaultOptions.onUploadComplete).toHaveBeenCalled();
    jest.useRealTimers();
  });

  it("should handle upload error", async () => {
    const { result } = renderHook(() => useFileUpload(defaultOptions));
    const file = new File(["content"], "test.pdf", {
      type: "application/pdf",
    });

    await act(async () => {
      await result.current.uploadFile(file);
    });

    act(() => {
      tusOnError?.(new Error("Network failure"));
    });

    expect(result.current.uploads[0].status).toBe("error");
    expect(result.current.uploads[0].error).toBe("Network failure");
    expect(defaultOptions.onError).toHaveBeenCalledWith("Network failure");
  });

  it("should reject disallowed MIME types client-side", async () => {
    const { result } = renderHook(() => useFileUpload(defaultOptions));
    const file = new File(["content"], "test.exe", {
      type: "application/x-msdownload",
    });

    await act(async () => {
      await result.current.uploadFile(file);
    });

    expect(mockTusStart).not.toHaveBeenCalled();
    expect(result.current.uploads[0].status).toBe("error");
    expect(result.current.uploads[0].error).toContain("not allowed");
    expect(defaultOptions.onError).toHaveBeenCalled();
  });

  it("should reject files exceeding max size client-side", async () => {
    const { result } = renderHook(() => useFileUpload(defaultOptions));
    // Create a file object that reports a large size
    const file = new File(["x"], "large.pdf", { type: "application/pdf" });
    Object.defineProperty(file, "size", { value: 100 * 1024 * 1024 });

    await act(async () => {
      await result.current.uploadFile(file);
    });

    expect(mockTusStart).not.toHaveBeenCalled();
    expect(result.current.uploads[0].status).toBe("error");
    expect(result.current.uploads[0].error).toContain("maximum size");
    expect(defaultOptions.onError).toHaveBeenCalled();
  });

  it("should cancel upload and call abort", async () => {
    const { result } = renderHook(() => useFileUpload(defaultOptions));
    const file = new File(["content"], "test.pdf", {
      type: "application/pdf",
    });

    await act(async () => {
      await result.current.uploadFile(file);
    });

    const uploadId = result.current.uploads[0].id;

    act(() => {
      result.current.cancelUpload(uploadId);
    });

    expect(mockTusAbort).toHaveBeenCalledWith(true);
    expect(result.current.uploads).toEqual([]);
  });

  it("should remove upload from list", async () => {
    const { result } = renderHook(() => useFileUpload(defaultOptions));
    const file = new File(["content"], "test.pdf", {
      type: "application/pdf",
    });

    await act(async () => {
      await result.current.uploadFile(file);
    });

    const uploadId = result.current.uploads[0].id;

    act(() => {
      result.current.removeUpload(uploadId);
    });

    expect(result.current.uploads).toEqual([]);
  });

  it("should report isUploading correctly", async () => {
    const { result } = renderHook(() => useFileUpload(defaultOptions));
    const file = new File(["content"], "test.pdf", {
      type: "application/pdf",
    });

    await act(async () => {
      await result.current.uploadFile(file);
    });

    expect(result.current.isUploading).toBe(true);

    act(() => {
      tusOnSuccess?.();
    });

    expect(result.current.isUploading).toBe(false);
  });

  it("should upload multiple files sequentially", async () => {
    const { result } = renderHook(() => useFileUpload(defaultOptions));
    const file1 = new File(["a"], "a.pdf", { type: "application/pdf" });
    const file2 = new File(["b"], "b.pdf", { type: "application/pdf" });

    await act(async () => {
      await result.current.uploadFiles([file1, file2]);
    });

    // Both files should be in the uploads list
    expect(result.current.uploads.length).toBe(2);
    expect(mockTusStart).toHaveBeenCalledTimes(2);
  });
});
