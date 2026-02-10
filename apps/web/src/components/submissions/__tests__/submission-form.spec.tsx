import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SubmissionForm } from "../submission-form";

// Mock tRPC
const mockCreateMutateAsync = jest.fn();
const mockUpdateMutateAsync = jest.fn();
const mockSubmitMutateAsync = jest.fn();
const mockInvalidate = jest.fn();

let mockExistingSubmission:
  | {
      id: string;
      title: string;
      content: string | null;
      coverLetter: string | null;
      status: string;
    }
  | undefined = undefined;
let mockIsLoadingSubmission = false;
let mockExistingFiles:
  | Array<{
      id: string;
      filename: string;
      size: number;
      scanStatus: string;
    }>
  | undefined = undefined;

jest.mock("@/lib/trpc", () => ({
  trpc: {
    submissions: {
      getById: {
        useQuery: (_input: unknown, _opts: unknown) => ({
          data: mockExistingSubmission,
          isLoading: mockIsLoadingSubmission,
        }),
      },
      create: {
        useMutation: (opts: {
          onSuccess?: (data: { id: string }) => void;
          onError?: (err: Error) => void;
        }) => ({
          mutateAsync: async (input: unknown) => {
            const result = await mockCreateMutateAsync(input);
            opts?.onSuccess?.(result);
            return result;
          },
          isPending: false,
        }),
      },
      update: {
        useMutation: (opts: {
          onSuccess?: () => void;
          onError?: (err: Error) => void;
        }) => ({
          mutateAsync: async (input: unknown) => {
            const result = await mockUpdateMutateAsync(input);
            opts?.onSuccess?.();
            return result;
          },
          isPending: false,
        }),
      },
      submit: {
        useMutation: (opts: {
          onSuccess?: () => void;
          onError?: (err: Error) => void;
        }) => ({
          mutateAsync: async (input: unknown) => {
            const result = await mockSubmitMutateAsync(input);
            opts?.onSuccess?.();
            return result;
          },
          isPending: false,
        }),
      },
    },
    files: {
      getBySubmission: {
        useQuery: () => ({
          data: mockExistingFiles,
        }),
      },
    },
    useUtils: () => ({
      submissions: {
        getById: { invalidate: mockInvalidate },
      },
    }),
  },
}));

// Mock sonner
jest.mock("sonner", () => ({
  toast: { success: jest.fn(), error: jest.fn() },
}));

// Mock FileUpload component
jest.mock("../file-upload", () => ({
  FileUpload: ({ submissionId }: { submissionId: string }) => (
    <div data-testid="file-upload">File Upload for {submissionId}</div>
  ),
}));

describe("SubmissionForm", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockExistingSubmission = undefined;
    mockIsLoadingSubmission = false;
    mockExistingFiles = undefined;
    mockCreateMutateAsync.mockResolvedValue({ id: "new-sub-1" });
    mockUpdateMutateAsync.mockResolvedValue(undefined);
    mockSubmitMutateAsync.mockResolvedValue(undefined);
  });

  describe("create mode", () => {
    it("should render title, content, and cover letter fields", () => {
      render(<SubmissionForm mode="create" />);
      expect(screen.getByText("New Submission")).toBeInTheDocument();
      expect(screen.getByLabelText(/title/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/content/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/cover letter/i)).toBeInTheDocument();
    });

    it("should not show file upload in create mode", () => {
      render(<SubmissionForm mode="create" />);
      expect(screen.queryByTestId("file-upload")).not.toBeInTheDocument();
    });

    it('should show "Create Draft" button', () => {
      render(<SubmissionForm mode="create" />);
      expect(
        screen.getByRole("button", { name: /create draft/i }),
      ).toBeInTheDocument();
    });

    it("should call create mutation on submit", async () => {
      const user = userEvent.setup();
      render(<SubmissionForm mode="create" />);

      await user.type(screen.getByLabelText(/title/i), "My Submission");
      await user.click(screen.getByRole("button", { name: /create draft/i }));

      await waitFor(() => {
        expect(mockCreateMutateAsync).toHaveBeenCalledWith(
          expect.objectContaining({ title: "My Submission" }),
        );
      });
    });
  });

  describe("edit mode", () => {
    beforeEach(() => {
      mockExistingSubmission = {
        id: "sub-1",
        title: "Existing Title",
        content: "Existing content",
        coverLetter: "Existing cover letter",
        status: "DRAFT",
      };
      mockExistingFiles = [];
    });

    it("should render Edit Submission heading", () => {
      render(<SubmissionForm mode="edit" submissionId="sub-1" />);
      expect(screen.getByText("Edit Submission")).toBeInTheDocument();
    });

    it("should show file upload section", () => {
      render(<SubmissionForm mode="edit" submissionId="sub-1" />);
      expect(screen.getByTestId("file-upload")).toBeInTheDocument();
    });

    it("should show Submit for Review button", () => {
      render(<SubmissionForm mode="edit" submissionId="sub-1" />);
      expect(
        screen.getByRole("button", { name: /submit for review/i }),
      ).toBeInTheDocument();
    });

    it("should show loading state when fetching submission", () => {
      mockIsLoadingSubmission = true;
      mockExistingSubmission = undefined;
      render(<SubmissionForm mode="edit" submissionId="sub-1" />);
      // Should show spinner, not the form
      expect(screen.queryByLabelText(/title/i)).not.toBeInTheDocument();
    });

    it("should show alert when submission is not a draft", () => {
      mockExistingSubmission = {
        id: "sub-1",
        title: "Submitted",
        content: null,
        coverLetter: null,
        status: "SUBMITTED",
      };
      render(<SubmissionForm mode="edit" submissionId="sub-1" />);
      expect(screen.getByText(/cannot be edited/i)).toBeInTheDocument();
    });
  });
});
