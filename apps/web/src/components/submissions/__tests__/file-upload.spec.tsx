import { render, screen } from "@testing-library/react";
import { FileUpload } from "../file-upload";

// --- Mutable mock state ---
let mockUploads: Array<{
  id: string;
  file: { name: string; size: number };
  progress: number;
  status: string;
  error?: string;
  scanStatus?: string;
}>;
const mockUploadFiles = jest.fn();
const mockRemoveUpload = jest.fn();
const mockCancelUpload = jest.fn();

let mockExistingFiles: Array<{
  id: string;
  filename: string;
  size: number;
  scanStatus: string;
}>;
let mockIsLoading: boolean;
const mockDeleteMutateAsync = jest.fn();
const mockInvalidateFiles = jest.fn();

function resetMocks() {
  mockUploads = [];
  mockExistingFiles = [];
  mockIsLoading = false;
}

jest.mock("@/hooks/use-file-upload", () => ({
  useFileUpload: () => ({
    uploads: mockUploads,
    uploadFiles: mockUploadFiles,
    removeUpload: mockRemoveUpload,
    cancelUpload: mockCancelUpload,
    isUploading: mockUploads.some(
      (u) => u.status === "uploading" || u.status === "pending",
    ),
  }),
}));

jest.mock("@/lib/trpc", () => ({
  trpc: {
    useUtils: () => ({
      files: {
        listBySubmission: { invalidate: mockInvalidateFiles },
      },
    }),
    files: {
      listBySubmission: {
        useQuery: () => ({
          data: mockExistingFiles,
          isPending: mockIsLoading,
        }),
      },
      delete: {
        useMutation: () => ({
          mutateAsync: mockDeleteMutateAsync,
        }),
      },
    },
  },
}));

jest.mock("@colophony/types", () => ({
  MAX_FILE_SIZE: 50 * 1024 * 1024,
  MAX_FILES_PER_SUBMISSION: 10,
  ALLOWED_MIME_TYPES: ["application/pdf", "text/plain"],
}));

// --- Fixtures ---
function makeFileRecord(
  overrides?: Partial<{
    id: string;
    filename: string;
    size: number;
    scanStatus: string;
  }>,
) {
  return {
    id: "file-1",
    filename: "document.pdf",
    size: 1024,
    scanStatus: "CLEAN",
    ...overrides,
  };
}

describe("FileUpload", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetMocks();
  });

  // --- Drop zone ---
  describe("drop zone", () => {
    it("shows 'Drop files here or click to upload' when enabled", () => {
      render(<FileUpload submissionId="sub-1" disabled={false} />);

      expect(
        screen.getByText("Drop files here or click to upload"),
      ).toBeInTheDocument();
    });

    it("shows 'Upload limit reached' when disabled", () => {
      render(<FileUpload submissionId="sub-1" disabled />);

      expect(screen.getByText("Upload limit reached")).toBeInTheDocument();
    });
  });

  // --- Existing files ---
  describe("existing files", () => {
    it("renders file names with scan status badges", () => {
      mockExistingFiles = [
        makeFileRecord({ id: "f1", filename: "poem.pdf", scanStatus: "CLEAN" }),
        makeFileRecord({
          id: "f2",
          filename: "essay.docx",
          scanStatus: "PENDING",
        }),
      ];

      render(<FileUpload submissionId="sub-1" disabled={false} />);

      expect(screen.getByText("poem.pdf")).toBeInTheDocument();
      expect(screen.getByText("essay.docx")).toBeInTheDocument();
      expect(screen.getByText("Clean")).toBeInTheDocument();
      expect(screen.getByText("Pending scan")).toBeInTheDocument();
    });

    it("shows delete button when not disabled", () => {
      mockExistingFiles = [makeFileRecord()];

      render(<FileUpload submissionId="sub-1" disabled={false} />);

      expect(screen.getByText("Uploaded files")).toBeInTheDocument();
      // ExistingFileItem renders a button when canDelete=true
      const buttons = screen.getAllByRole("button");
      expect(buttons.length).toBeGreaterThan(0);
    });

    it("hides delete button when disabled", () => {
      mockExistingFiles = [makeFileRecord()];

      render(<FileUpload submissionId="sub-1" disabled />);

      expect(screen.getByText("document.pdf")).toBeInTheDocument();
      // With canDelete=false, no buttons should appear in the existing files section
      // The only "buttons" should be absent since upload is also disabled
      const uploadedSection = screen.getByText("Uploaded files").parentElement;
      const buttons = uploadedSection?.querySelectorAll("button");
      expect(buttons?.length ?? 0).toBe(0);
    });
  });

  // --- Active uploads ---
  describe("active uploads", () => {
    it("shows uploading file with progress percentage", () => {
      mockUploads = [
        {
          id: "up-1",
          file: { name: "story.pdf", size: 5000 },
          progress: 42,
          status: "uploading",
        },
      ];

      render(<FileUpload submissionId="sub-1" disabled={false} />);

      expect(screen.getByText("story.pdf")).toBeInTheDocument();
      expect(screen.getByText("42%")).toBeInTheDocument();
      expect(screen.getByText("Uploading")).toBeInTheDocument();
    });

    it("shows error state with error message", () => {
      mockUploads = [
        {
          id: "up-1",
          file: { name: "bad.exe", size: 1000 },
          progress: 0,
          status: "error",
          error: 'File type "application/x-msdownload" is not allowed',
        },
      ];

      render(<FileUpload submissionId="sub-1" disabled={false} />);

      expect(screen.getByText("bad.exe")).toBeInTheDocument();
      expect(
        screen.getByText('File type "application/x-msdownload" is not allowed'),
      ).toBeInTheDocument();
    });
  });

  // --- Warnings ---
  describe("warnings", () => {
    it("shows scanning warning when files PENDING/SCANNING", () => {
      mockExistingFiles = [makeFileRecord({ scanStatus: "PENDING" })];

      render(<FileUpload submissionId="sub-1" disabled={false} />);

      expect(screen.getByText(/still being scanned/)).toBeInTheDocument();
    });

    it("shows infected warning when files INFECTED", () => {
      mockExistingFiles = [makeFileRecord({ scanStatus: "INFECTED" })];

      render(<FileUpload submissionId="sub-1" disabled={false} />);

      expect(screen.getByText(/flagged as infected/)).toBeInTheDocument();
    });
  });
});
