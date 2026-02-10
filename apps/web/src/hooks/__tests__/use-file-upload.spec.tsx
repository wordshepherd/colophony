import { renderHook, act } from "@testing-library/react";
import { useFileUpload } from "../use-file-upload";

// Track tus Upload instances
let tusOnProgress:
  | ((bytesUploaded: number, bytesTotal: number) => void)
  | undefined;
let tusOnSuccess: (() => void) | undefined;
let tusOnError: ((error: Error) => void) | undefined;
const mockTusStart = jest.fn();

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
      return { start: mockTusStart };
    },
  ),
}));

// Mock tRPC - use module-level refs to avoid hoisting issues
const trpcMock = {
  initiateUploadMutateAsync: jest.fn(),
  invalidateFiles: jest.fn(),
};

jest.mock("@/lib/trpc", () => ({
  trpc: {
    files: {
      initiateUpload: {
        useMutation: () => ({
          mutateAsync: (...args: unknown[]) =>
            trpcMock.initiateUploadMutateAsync(...args),
        }),
      },
    },
    useUtils: () => ({
      files: {
        getBySubmission: {
          invalidate: (...args: unknown[]) => trpcMock.invalidateFiles(...args),
        },
      },
    }),
  },
  getAccessToken: jest.fn(() => "test-token"),
}));

const mockInitiateUploadMutateAsync = trpcMock.initiateUploadMutateAsync;
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

  it("should add file to uploads and initiate tus upload", async () => {
    mockInitiateUploadMutateAsync.mockResolvedValue({
      fileId: "file-1",
      uploadUrl: "https://upload.example.com/files/file-1",
    });

    const { result } = renderHook(() => useFileUpload(defaultOptions));
    const file = new File(["content"], "test.pdf", { type: "application/pdf" });

    await act(async () => {
      await result.current.uploadFile(file);
    });

    expect(mockInitiateUploadMutateAsync).toHaveBeenCalledWith({
      submissionId: "sub-123",
      filename: "test.pdf",
      mimeType: "application/pdf",
      size: 7,
    });
    expect(mockTusStart).toHaveBeenCalled();
    expect(result.current.uploads.length).toBe(1);
    expect(result.current.uploads[0].status).toBe("uploading");
  });

  it("should track upload progress", async () => {
    mockInitiateUploadMutateAsync.mockResolvedValue({
      fileId: "file-1",
      uploadUrl: "https://upload.example.com/files/file-1",
    });

    const { result } = renderHook(() => useFileUpload(defaultOptions));
    const file = new File(["content"], "test.pdf", { type: "application/pdf" });

    await act(async () => {
      await result.current.uploadFile(file);
    });

    await act(async () => {
      tusOnProgress?.(50, 100);
    });

    expect(result.current.uploads[0].progress).toBe(50);
  });

  it("should handle upload success", async () => {
    mockInitiateUploadMutateAsync.mockResolvedValue({
      fileId: "file-1",
      uploadUrl: "https://upload.example.com/files/file-1",
    });

    const { result } = renderHook(() => useFileUpload(defaultOptions));
    const file = new File(["content"], "test.pdf", { type: "application/pdf" });

    await act(async () => {
      await result.current.uploadFile(file);
    });

    await act(async () => {
      tusOnSuccess?.();
    });

    expect(result.current.uploads[0].status).toBe("processing");
    expect(result.current.uploads[0].scanStatus).toBe("PENDING");
    expect(mockInvalidateFiles).toHaveBeenCalledWith({
      submissionId: "sub-123",
    });
    expect(defaultOptions.onUploadComplete).toHaveBeenCalledWith("file-1");
  });

  it("should handle upload error", async () => {
    mockInitiateUploadMutateAsync.mockResolvedValue({
      fileId: "file-1",
      uploadUrl: "https://upload.example.com/files/file-1",
    });

    const { result } = renderHook(() => useFileUpload(defaultOptions));
    const file = new File(["content"], "test.pdf", { type: "application/pdf" });

    await act(async () => {
      await result.current.uploadFile(file);
    });

    await act(async () => {
      tusOnError?.(new Error("Network failure"));
    });

    expect(result.current.uploads[0].status).toBe("error");
    expect(result.current.uploads[0].error).toBe("Network failure");
    expect(defaultOptions.onError).toHaveBeenCalledWith("Network failure");
  });

  it("should handle initiate upload failure", async () => {
    mockInitiateUploadMutateAsync.mockRejectedValue(
      new Error("Quota exceeded"),
    );

    const { result } = renderHook(() => useFileUpload(defaultOptions));
    const file = new File(["content"], "test.pdf", { type: "application/pdf" });

    await act(async () => {
      await result.current.uploadFile(file);
    });

    expect(result.current.uploads[0].status).toBe("error");
    expect(result.current.uploads[0].error).toBe("Quota exceeded");
  });

  it("should remove upload from list", async () => {
    mockInitiateUploadMutateAsync.mockResolvedValue({
      fileId: "file-1",
      uploadUrl: "https://upload.example.com/files/file-1",
    });

    const { result } = renderHook(() => useFileUpload(defaultOptions));
    const file = new File(["content"], "test.pdf", { type: "application/pdf" });

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
    mockInitiateUploadMutateAsync.mockResolvedValue({
      fileId: "file-1",
      uploadUrl: "https://upload.example.com/files/file-1",
    });

    const { result } = renderHook(() => useFileUpload(defaultOptions));
    const file = new File(["content"], "test.pdf", { type: "application/pdf" });

    await act(async () => {
      await result.current.uploadFile(file);
    });

    expect(result.current.isUploading).toBe(true);

    await act(async () => {
      tusOnSuccess?.();
    });

    expect(result.current.isUploading).toBe(false);
  });
});
