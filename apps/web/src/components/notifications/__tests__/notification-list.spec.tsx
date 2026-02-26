import { render, screen, fireEvent } from "@testing-library/react";
import "../../../../test/setup";

let mockData:
  | {
      items: Array<{
        id: string;
        eventType: string;
        title: string;
        body: string | null;
        link: string | null;
        readAt: Date | null;
        createdAt: Date;
      }>;
      total: number;
    }
  | undefined;
let mockIsPending: boolean;
let mockMarkReadMutate: jest.Mock;
let mockMarkAllReadMutate: jest.Mock;
const mockPush = jest.fn();

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

jest.mock("@/lib/trpc", () => ({
  trpc: {
    notifications: {
      list: {
        useQuery: () => ({
          data: mockData,
          isPending: mockIsPending,
        }),
      },
      markRead: {
        useMutation: (opts?: { onSuccess?: () => void }) => ({
          mutate: (...args: unknown[]) => {
            mockMarkReadMutate(...args);
            opts?.onSuccess?.();
          },
          isPending: false,
        }),
      },
      markAllRead: {
        useMutation: (opts?: { onSuccess?: () => void }) => ({
          mutate: (...args: unknown[]) => {
            mockMarkAllReadMutate(...args);
            opts?.onSuccess?.();
          },
          isPending: false,
        }),
      },
    },
    useUtils: () => ({
      notifications: {
        unreadCount: { invalidate: jest.fn() },
        list: { invalidate: jest.fn() },
      },
    }),
  },
}));

import { NotificationList } from "../notification-list";

beforeEach(() => {
  mockData = undefined;
  mockIsPending = false;
  mockMarkReadMutate = jest.fn();
  mockMarkAllReadMutate = jest.fn();
  mockPush.mockClear();
});

describe("NotificationList", () => {
  it("shows loading spinner while fetching", () => {
    mockIsPending = true;
    render(<NotificationList />);
    // Loader2 icon renders as an svg; we just check no list is shown
    expect(screen.queryByText("Notifications")).not.toBeInTheDocument();
  });

  it("shows empty state when no notifications", () => {
    mockData = { items: [], total: 0 };
    render(<NotificationList />);
    expect(screen.getByText("No notifications")).toBeInTheDocument();
  });

  it("renders notification items", () => {
    mockData = {
      items: [
        {
          id: "n1",
          eventType: "submission.received",
          title: "New submission: Test",
          body: null,
          link: "/submissions/123",
          readAt: null,
          createdAt: new Date(),
        },
      ],
      total: 1,
    };
    render(<NotificationList />);
    expect(screen.getByText("New submission: Test")).toBeInTheDocument();
  });

  it("calls markRead and navigates on click", () => {
    mockData = {
      items: [
        {
          id: "n1",
          eventType: "submission.received",
          title: "New submission: Test",
          body: null,
          link: "/submissions/123",
          readAt: null,
          createdAt: new Date(),
        },
      ],
      total: 1,
    };
    const onClose = jest.fn();
    render(<NotificationList onClose={onClose} />);
    fireEvent.click(screen.getByText("New submission: Test"));
    expect(mockMarkReadMutate).toHaveBeenCalledWith({ id: "n1" });
    expect(mockPush).toHaveBeenCalledWith("/submissions/123");
    expect(onClose).toHaveBeenCalled();
  });

  it("calls markAllRead on button click", () => {
    mockData = {
      items: [
        {
          id: "n1",
          eventType: "submission.received",
          title: "Test",
          body: null,
          link: null,
          readAt: null,
          createdAt: new Date(),
        },
      ],
      total: 1,
    };
    render(<NotificationList />);
    fireEvent.click(screen.getByText("Mark all read"));
    expect(mockMarkAllReadMutate).toHaveBeenCalled();
  });
});
