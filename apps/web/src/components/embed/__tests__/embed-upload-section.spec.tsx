import { render, screen } from "@testing-library/react";
import { EmbedUploadSection } from "../embed-upload-section";
import "../../../../test/setup";

// Mock upload hooks
const mockUseEmbedFileUpload = jest.fn();
const mockUseEmbedUploadStatus = jest.fn();

jest.mock("@/hooks/use-embed-file-upload", () => ({
  useEmbedFileUpload: (...args: unknown[]) => mockUseEmbedFileUpload(...args),
}));

jest.mock("@/hooks/use-embed-upload-status", () => ({
  useEmbedUploadStatus: (...args: unknown[]) =>
    mockUseEmbedUploadStatus(...args),
}));

const defaultProps = {
  token: "col_emb_test",
  apiUrl: "http://localhost:4000",
  uploadContext: {
    manuscriptVersionId: "mv-1",
    guestUserId: "gu-1",
    tusEndpoint: "http://localhost:1080/files/",
    maxFileSize: 50 * 1024 * 1024,
    maxFiles: 10,
    allowedMimeTypes: ["application/pdf"],
  },
  identity: { email: "test@example.com" },
  disabled: false,
  onUploadStateChange: jest.fn(),
};

describe("EmbedUploadSection", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseEmbedFileUpload.mockReturnValue({
      uploads: [],
      uploadFiles: jest.fn(),
      removeUpload: jest.fn(),
      cancelUpload: jest.fn(),
      isUploading: false,
    });
    mockUseEmbedUploadStatus.mockReturnValue({
      files: [],
      allClean: false,
      isPolling: false,
      error: null,
    });
  });

  it("renders drop zone with keyboard accessibility", () => {
    render(<EmbedUploadSection {...defaultProps} />);
    const dropZone = screen.getByRole("button", {
      name: "Drop files here or click to upload",
    });
    expect(dropZone).toBeInTheDocument();
    expect(dropZone).toHaveAttribute("tabindex", "0");
    expect(dropZone).toHaveAttribute("aria-disabled", "false");
  });

  it("disables when maxFiles reached", () => {
    mockUseEmbedUploadStatus.mockReturnValue({
      files: Array.from({ length: 10 }, (_, i) => ({
        id: `f-${i}`,
        filename: `file${i}.pdf`,
        size: 100,
        mimeType: "application/pdf",
        scanStatus: "CLEAN",
      })),
      allClean: true,
      isPolling: false,
      error: null,
    });

    render(<EmbedUploadSection {...defaultProps} />);
    expect(screen.getByText(/upload limit reached/i)).toBeInTheDocument();
  });

  it("shows scan status badges", () => {
    mockUseEmbedUploadStatus.mockReturnValue({
      files: [
        {
          id: "f1",
          filename: "clean.pdf",
          size: 100,
          mimeType: "application/pdf",
          scanStatus: "CLEAN",
        },
        {
          id: "f2",
          filename: "pending.pdf",
          size: 200,
          mimeType: "application/pdf",
          scanStatus: "PENDING",
        },
      ],
      allClean: false,
      isPolling: true,
      error: null,
    });

    render(<EmbedUploadSection {...defaultProps} />);
    expect(screen.getByText("Clean")).toBeInTheDocument();
    expect(screen.getByText("Pending scan")).toBeInTheDocument();
  });

  it("shows scanning warning in aria-live region", () => {
    mockUseEmbedUploadStatus.mockReturnValue({
      files: [
        {
          id: "f1",
          filename: "test.pdf",
          size: 100,
          mimeType: "application/pdf",
          scanStatus: "PENDING",
        },
      ],
      allClean: false,
      isPolling: true,
      error: null,
    });

    const { container } = render(<EmbedUploadSection {...defaultProps} />);
    expect(screen.getByText(/files are being scanned/i)).toBeInTheDocument();
    const liveRegion = container.querySelector('[aria-live="polite"]');
    expect(liveRegion).toBeInTheDocument();
    expect(liveRegion).toHaveTextContent(/files are being scanned/i);
  });
});
