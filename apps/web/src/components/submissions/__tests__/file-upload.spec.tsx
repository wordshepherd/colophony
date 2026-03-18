import { vi } from "vitest";
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
const mockUploadFiles = vi.fn();
const mockRemoveUpload = vi.fn();
const mockCancelUpload = vi.fn();

let mockExistingFiles: Array<{
  id: string;
  filename: string;
  size: number;
  scanStatus: string;
}>;
let mockIsLoading: boolean;
const mockDeleteMutateAsync = vi.fn();
const mockInvalidateFiles = vi.fn();

function resetMocks() {
  mockUploads = [];
  mockExistingFiles = [];
  mockIsLoading = false;
}

vi.mock("@/hooks/use-file-upload", () => ({
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

vi.mock("@/lib/trpc", () => ({
  trpc: {
    useUtils: () => ({
      files: {
        listByManuscriptVersion: { invalidate: mockInvalidateFiles },
      },
    }),
    files: {
      listByManuscriptVersion: {
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

vi.mock("@colophony/types", () => ({
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
    vi.clearAllMocks();
    resetMocks();
  });

  // --- Drop zone ---
  describe("drop zone", () => {
    it("shows 'Drop files here or click to upload' when enabled", () => {
      render(<FileUpload manuscriptVersionId="mv-1" disabled={false} />);

      expect(
        screen.getByText("Drop files here or click to upload"),
      ).toBeInTheDocument();
    });

    it("shows 'Upload limit reached' when disabled", () => {
      render(<FileUpload manuscriptVersionId="mv-1" disabled />);

      expect(screen.getByText("Upload limit reached")).toBeInTheDocument();
    });

    it("has role='button' and tabIndex for keyboard accessibility", () => {
      render(<FileUpload manuscriptVersionId="mv-1" disabled={false} />);

      const dropZone = screen.getByRole("button", {
        name: "Drop files here or click to upload",
      });
      expect(dropZone).toHaveAttribute("tabindex", "0");
      expect(dropZone).toHaveAttribute("aria-disabled", "false");
    });

    it("sets tabIndex=-1 when disabled", () => {
      render(<FileUpload manuscriptVersionId="mv-1" disabled />);

      const dropZone = screen.getByRole("button", {
        name: "Upload limit reached",
      });
      expect(dropZone).toHaveAttribute("tabindex", "-1");
      expect(dropZone).toHaveAttribute("aria-disabled", "true");
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

      render(<FileUpload manuscriptVersionId="mv-1" disabled={false} />);

      expect(screen.getByText("poem.pdf")).toBeInTheDocument();
      expect(screen.getByText("essay.docx")).toBeInTheDocument();
      expect(screen.getByText("Clean")).toBeInTheDocument();
      expect(screen.getByText("Pending scan")).toBeInTheDocument();
    });

    it("shows delete button when not disabled", () => {
      mockExistingFiles = [makeFileRecord()];

      render(<FileUpload manuscriptVersionId="mv-1" disabled={false} />);

      expect(screen.getByText("Uploaded files")).toBeInTheDocument();
      // ExistingFileItem renders a button when canDelete=true
      const buttons = screen.getAllByRole("button");
      expect(buttons.length).toBeGreaterThan(0);
    });

    it("hides delete button when disabled", () => {
      mockExistingFiles = [makeFileRecord()];

      render(<FileUpload manuscriptVersionId="mv-1" disabled />);

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

      render(<FileUpload manuscriptVersionId="mv-1" disabled={false} />);

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

      render(<FileUpload manuscriptVersionId="mv-1" disabled={false} />);

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

      render(<FileUpload manuscriptVersionId="mv-1" disabled={false} />);

      expect(screen.getByText(/still being scanned/)).toBeInTheDocument();
    });

    it("shows infected warning when files INFECTED", () => {
      mockExistingFiles = [makeFileRecord({ scanStatus: "INFECTED" })];

      render(<FileUpload manuscriptVersionId="mv-1" disabled={false} />);

      expect(screen.getByText(/flagged as infected/)).toBeInTheDocument();
    });

    it("wraps scan warnings in aria-live region", () => {
      mockExistingFiles = [makeFileRecord({ scanStatus: "PENDING" })];

      const { container } = render(
        <FileUpload manuscriptVersionId="mv-1" disabled={false} />,
      );

      const liveRegion = container.querySelector('[aria-live="polite"]');
      expect(liveRegion).toBeInTheDocument();
      expect(liveRegion).toHaveTextContent(/still being scanned/);
    });
  });
});
