import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { EmbedForm } from "../embed-form";
import "../../../../test/setup";

const mockFetchEmbedForm = jest.fn();
const mockSubmitEmbedForm = jest.fn();
const mockPrepareEmbedUpload = jest.fn();

jest.mock("@/lib/embed-api", () => ({
  fetchEmbedForm: (...args: unknown[]) => mockFetchEmbedForm(...args),
  submitEmbedForm: (...args: unknown[]) => mockSubmitEmbedForm(...args),
  prepareEmbedUpload: (...args: unknown[]) => mockPrepareEmbedUpload(...args),
  fetchUploadStatus: jest
    .fn()
    .mockResolvedValue({ files: [], allClean: false }),
}));

// Mock tus-js-client
jest.mock("tus-js-client", () => ({
  Upload: jest.fn().mockImplementation(() => ({
    start: jest.fn(),
    abort: jest.fn(),
  })),
}));

const validFormResponse = {
  period: {
    id: "p-1",
    name: "Spring 2026",
    opensAt: "2026-01-01T00:00:00Z",
    closesAt: "2026-06-01T00:00:00Z",
  },
  form: {
    id: "f-1",
    name: "Poetry Form",
    fields: [
      {
        fieldKey: "bio",
        fieldType: "textarea",
        label: "Bio",
        description: null,
        placeholder: "Short bio",
        required: false,
        config: null,
        sortOrder: 0,
      },
    ],
    pages: [],
  },
  theme: null,
  organizationId: "org-1",
};

describe("EmbedForm", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("shows loading spinner initially", () => {
    mockFetchEmbedForm.mockReturnValue(new Promise(() => {})); // never resolves
    render(<EmbedForm token="col_emb_test" apiUrl="http://localhost:4000" />);

    // Loader2 renders as an SVG with animate-spin
    expect(document.querySelector(".animate-spin")).toBeInTheDocument();
  });

  it("shows error for invalid token", async () => {
    mockFetchEmbedForm.mockRejectedValue({
      status: 404,
      error: "Not Found",
      message: "Invalid embed token",
    });

    render(<EmbedForm token="col_emb_bad" apiUrl="http://localhost:4000" />);

    await waitFor(() => {
      expect(screen.getByText(/invalid link/i)).toBeInTheDocument();
    });
  });

  it("shows error for closed period", async () => {
    mockFetchEmbedForm.mockRejectedValue({
      status: 410,
      error: "Gone",
      message: "Submission period closed",
    });

    render(<EmbedForm token="col_emb_old" apiUrl="http://localhost:4000" />);

    await waitFor(() => {
      expect(screen.getByText(/submissions closed/i)).toBeInTheDocument();
    });
  });

  it("transitions identity to form", async () => {
    const user = userEvent.setup();
    mockFetchEmbedForm.mockResolvedValue(validFormResponse);

    render(<EmbedForm token="col_emb_ok" apiUrl="http://localhost:4000" />);

    // Wait for identity step
    await waitFor(() => {
      expect(screen.getByText("Spring 2026")).toBeInTheDocument();
    });

    // Fill email and continue
    await user.type(screen.getByLabelText(/email/i), "writer@test.com");
    await user.click(screen.getByRole("button", { name: /continue/i }));

    // Form step should appear with title input
    await waitFor(() => {
      expect(screen.getByLabelText(/title/i)).toBeInTheDocument();
    });
  });

  it("submits successfully", async () => {
    const user = userEvent.setup();
    mockFetchEmbedForm.mockResolvedValue(validFormResponse);
    mockSubmitEmbedForm.mockResolvedValue({
      success: true,
      submissionId: "sub-123",
      message: "Done",
    });

    render(<EmbedForm token="col_emb_ok" apiUrl="http://localhost:4000" />);

    // Identity step
    await waitFor(() => {
      expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    });
    await user.type(screen.getByLabelText(/email/i), "writer@test.com");
    await user.click(screen.getByRole("button", { name: /continue/i }));

    // Form step
    await waitFor(() => {
      expect(screen.getByLabelText(/title/i)).toBeInTheDocument();
    });
    await user.type(screen.getByLabelText(/title/i), "My Poem");
    await user.click(screen.getByRole("button", { name: /submit/i }));

    // Success screen
    await waitFor(() => {
      expect(screen.getByText(/submission received/i)).toBeInTheDocument();
      expect(screen.getByText(/sub-123/)).toBeInTheDocument();
    });
  });
});
