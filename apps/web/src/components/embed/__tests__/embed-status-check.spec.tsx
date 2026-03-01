import { render, screen, waitFor } from "@testing-library/react";
import { EmbedStatusCheck } from "../embed-status-check";
import "../../../../test/setup";

// Mock embed-api module
jest.mock("@/lib/embed-api", () => ({
  fetchSubmissionStatus: jest.fn(),
}));

import { fetchSubmissionStatus } from "@/lib/embed-api";
import type { EmbedApiError } from "@/lib/embed-api";

const mockFetch = fetchSubmissionStatus as jest.MockedFunction<
  typeof fetchSubmissionStatus
>;

const defaultProps = {
  statusToken: "col_sta_abc123",
  apiUrl: "http://localhost:4000",
};

describe("EmbedStatusCheck", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("shows loading spinner initially", () => {
    mockFetch.mockReturnValue(new Promise(() => {})); // never resolves
    render(<EmbedStatusCheck {...defaultProps} />);

    expect(
      screen.getByText("", { selector: ".animate-spin" }),
    ).toBeInTheDocument();
  });

  it("renders submission status on success", async () => {
    mockFetch.mockResolvedValue({
      title: "My Poem",
      status: "Under Review",
      submittedAt: "2026-02-15T00:00:00.000Z",
      organizationName: "Test Journal",
      periodName: "Spring 2026",
    });

    render(<EmbedStatusCheck {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText("My Poem")).toBeInTheDocument();
    });
    expect(screen.getByText("Under Review")).toBeInTheDocument();
    expect(screen.getByText("Test Journal")).toBeInTheDocument();
    expect(screen.getByText("Spring 2026")).toBeInTheDocument();
  });

  it("shows not found for 404 response", async () => {
    const err: EmbedApiError = {
      status: 404,
      error: "not_found",
      message: "Submission not found",
    };
    mockFetch.mockRejectedValue(err);

    render(<EmbedStatusCheck {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText("Submission Not Found")).toBeInTheDocument();
    });
  });

  it("shows expired message for 410 response", async () => {
    const err: EmbedApiError = {
      status: 410,
      error: "token_expired",
      message:
        "This status link has expired. Please contact the publication for an update.",
    };
    mockFetch.mockRejectedValue(err);

    render(<EmbedStatusCheck {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText("Status Link Expired")).toBeInTheDocument();
    });
    expect(
      screen.getByText(/contact the publication directly/),
    ).toBeInTheDocument();
  });

  it("shows generic error for other failures", async () => {
    const err: EmbedApiError = {
      status: 500,
      error: "internal",
      message: "Server error",
    };
    mockFetch.mockRejectedValue(err);

    render(<EmbedStatusCheck {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText("Something Went Wrong")).toBeInTheDocument();
    });
  });
});
