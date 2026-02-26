import { render, screen, fireEvent } from "@testing-library/react";
import { NotificationPreferencesCard } from "../notification-preferences-card";
import "../../../../test/setup";

// --- Mutable mock state ---
let mockPreferences: Array<{ eventType: string; enabled: boolean }> | undefined;
let mockIsPending: boolean;
let mockError: { message: string } | null;
let mockRefetch: jest.Mock;
let mockMutate: jest.Mock;
let mockMutationPending: boolean;
let mockCurrentOrg: { id: string; name: string; slug: string } | null;

function resetMocks() {
  mockPreferences = undefined;
  mockIsPending = false;
  mockError = null;
  mockRefetch = jest.fn();
  mockMutate = jest.fn();
  mockMutationPending = false;
  mockCurrentOrg = { id: "org-1", name: "Test Magazine", slug: "test-mag" };
}

jest.mock("@/lib/trpc", () => ({
  trpc: {
    notificationPreferences: {
      list: {
        useQuery: () => ({
          data: mockPreferences,
          isPending: mockIsPending,
          error: mockError,
          refetch: mockRefetch,
        }),
      },
      upsert: {
        useMutation: (opts?: {
          onSuccess?: () => void;
          onError?: (err: { message: string }) => void;
        }) => ({
          mutate: (...args: unknown[]) => {
            mockMutate(...args);
            opts?.onSuccess?.();
          },
          isPending: mockMutationPending,
        }),
      },
    },
    useUtils: () => ({
      notificationPreferences: { list: { invalidate: jest.fn() } },
    }),
  },
}));

jest.mock("sonner", () => ({
  toast: { success: jest.fn(), error: jest.fn() },
}));

jest.mock("@/hooks/use-organization", () => ({
  useOrganization: () => ({
    currentOrg: mockCurrentOrg,
  }),
}));

beforeEach(() => {
  resetMocks();
});

describe("NotificationPreferencesCard", () => {
  it("shows org selection message when no org is selected", () => {
    mockCurrentOrg = null;
    render(<NotificationPreferencesCard />);
    expect(screen.getByText(/select an organization/i)).toBeInTheDocument();
    expect(screen.queryAllByRole("switch")).toHaveLength(0);
  });

  it("shows loading skeleton while fetching", () => {
    mockIsPending = true;
    render(<NotificationPreferencesCard />);
    expect(
      screen.getByTestId("notification-prefs-skeleton"),
    ).toBeInTheDocument();
    expect(screen.queryAllByRole("switch")).toHaveLength(0);
  });

  it("shows error state with retry button", () => {
    mockError = { message: "Network error" };
    render(<NotificationPreferencesCard />);
    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent(/network error/i);
    fireEvent.click(screen.getByText("Try again"));
    expect(mockRefetch).toHaveBeenCalled();
  });

  it("renders all 6 toggles with correct labels", () => {
    mockPreferences = [];
    render(<NotificationPreferencesCard />);
    const switches = screen.getAllByRole("switch");
    expect(switches).toHaveLength(6);
    expect(screen.getByText("Submission Received")).toBeInTheDocument();
    expect(screen.getByText("Submission Accepted")).toBeInTheDocument();
    expect(screen.getByText("Submission Rejected")).toBeInTheDocument();
    expect(screen.getByText("Submission Withdrawn")).toBeInTheDocument();
    expect(screen.getByText("Contract Ready")).toBeInTheDocument();
    expect(screen.getByText("Copyeditor Assigned")).toBeInTheDocument();
  });

  it("defaults all toggles to enabled when no preferences exist", () => {
    mockPreferences = [];
    render(<NotificationPreferencesCard />);
    const switches = screen.getAllByRole("switch");
    switches.forEach((sw) => {
      expect(sw).toBeChecked();
    });
  });

  it("reflects disabled state from existing preference records", () => {
    mockPreferences = [
      { eventType: "submission.received", enabled: false },
      { eventType: "contract.ready", enabled: false },
    ];
    render(<NotificationPreferencesCard />);
    expect(
      screen.getByLabelText("Toggle Submission Received notifications"),
    ).not.toBeChecked();
    expect(
      screen.getByLabelText("Toggle Contract Ready notifications"),
    ).not.toBeChecked();
    expect(
      screen.getByLabelText("Toggle Submission Accepted notifications"),
    ).toBeChecked();
    expect(
      screen.getByLabelText("Toggle Submission Rejected notifications"),
    ).toBeChecked();
  });

  it("calls upsert mutation on toggle click", () => {
    mockPreferences = [];
    render(<NotificationPreferencesCard />);
    fireEvent.click(
      screen.getByLabelText("Toggle Submission Received notifications"),
    );
    expect(mockMutate).toHaveBeenCalledWith({
      channel: "email",
      eventType: "submission.received",
      enabled: false,
    });
  });

  it("displays org name in card description", () => {
    mockPreferences = [];
    mockCurrentOrg = {
      id: "org-1",
      name: "The Paris Review",
      slug: "paris-review",
    };
    render(<NotificationPreferencesCard />);
    expect(screen.getByText(/The Paris Review/)).toBeInTheDocument();
  });

  it("disables switches while mutation is pending", () => {
    mockMutationPending = true;
    mockPreferences = [];
    render(<NotificationPreferencesCard />);
    const switches = screen.getAllByRole("switch");
    switches.forEach((sw) => {
      expect(sw).toBeDisabled();
    });
  });

  it("shows Submissions and Publication Pipeline group headings", () => {
    mockPreferences = [];
    render(<NotificationPreferencesCard />);
    expect(screen.getByText("Submissions")).toBeInTheDocument();
    expect(screen.getByText("Publication Pipeline")).toBeInTheDocument();
  });
});
