import { vi } from "vitest";
import { render, screen } from "@testing-library/react";

let mockCurrentOrg: { id: string; name: string; slug: string } | null;
let mockUnreadCount: number;

vi.mock("@/hooks/use-organization", () => ({
  useOrganization: () => ({
    currentOrg: mockCurrentOrg,
  }),
}));

vi.mock("@/hooks/use-notification-stream", () => ({
  useNotificationStream: vi.fn(),
}));

vi.mock("@/lib/trpc", () => ({
  trpc: {
    notifications: {
      unreadCount: {
        useQuery: () => ({
          data: mockCurrentOrg ? { count: mockUnreadCount } : undefined,
        }),
      },
    },
    useUtils: () => ({}),
  },
}));

// Mock Popover to just render children for testability
vi.mock("@/components/ui/popover", () => ({
  Popover: ({
    children,
    open,
  }: {
    children: React.ReactNode;
    open: boolean;
    onOpenChange: (open: boolean) => void;
  }) => <div data-open={open}>{children}</div>,
  PopoverTrigger: ({
    children,
  }: {
    children: React.ReactNode;
    asChild?: boolean;
  }) => <>{children}</>,
  PopoverContent: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="popover-content">{children}</div>
  ),
}));

vi.mock("../notification-list", () => ({
  NotificationList: (_props: { onClose?: () => void }) => (
    <div data-testid="notification-list">NotificationList</div>
  ),
}));

import { NotificationBell } from "../notification-bell";

beforeEach(() => {
  mockCurrentOrg = { id: "org-1", name: "Test Mag", slug: "test" };
  mockUnreadCount = 0;
});

describe("NotificationBell", () => {
  it("renders nothing when no current org", () => {
    mockCurrentOrg = null;
    const { container } = render(<NotificationBell />);
    expect(container.innerHTML).toBe("");
  });

  it("renders bell without badge when count is 0", () => {
    mockUnreadCount = 0;
    render(<NotificationBell />);
    expect(screen.getByRole("button")).toBeInTheDocument();
    expect(screen.getByText("Notifications")).toBeInTheDocument();
    expect(screen.queryByText("0")).not.toBeInTheDocument();
  });

  it("renders badge with unread count", () => {
    mockUnreadCount = 5;
    render(<NotificationBell />);
    expect(screen.getByText("5")).toBeInTheDocument();
  });

  it("caps badge at 99+", () => {
    mockUnreadCount = 150;
    render(<NotificationBell />);
    expect(screen.getByText("99+")).toBeInTheDocument();
  });

  it("includes NotificationList in popover", () => {
    render(<NotificationBell />);
    expect(screen.getByTestId("notification-list")).toBeInTheDocument();
  });
});
