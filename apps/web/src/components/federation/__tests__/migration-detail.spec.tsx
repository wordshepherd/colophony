import { vi } from "vitest";
import React from "react";
import { render, screen } from "@testing-library/react";

let mockMigration: unknown = {
  id: "m-1",
  direction: "outbound",
  status: "PENDING_APPROVAL",
  userDid: "did:example:user",
  peerUserDid: "did:example:peer",
  peerDomain: "other.org",
  peerInstanceUrl: "https://other.org",
  callbackUrl: "https://other.org/callback",
  createdAt: "2024-01-01",
  approvedAt: null,
  completedAt: null,
  failureReason: null,
};
let mockIsPending = false;

function resetMocks() {
  mockMigration = {
    id: "m-1",
    direction: "outbound",
    status: "PENDING_APPROVAL",
    userDid: "did:example:user",
    peerUserDid: "did:example:peer",
    peerDomain: "other.org",
    peerInstanceUrl: "https://other.org",
    callbackUrl: "https://other.org/callback",
    createdAt: "2024-01-01",
    approvedAt: null,
    completedAt: null,
    failureReason: null,
  };
  mockIsPending = false;
}

vi.mock("@/lib/trpc", () => ({
  trpc: {
    migrations: {
      getById: {
        useQuery: () => ({
          data: mockMigration,
          isPending: mockIsPending,
          error: null,
        }),
      },
      approve: {
        useMutation: () => ({
          mutate: vi.fn(),
          isPending: false,
        }),
      },
      reject: {
        useMutation: () => ({
          mutate: vi.fn(),
          isPending: false,
        }),
      },
      cancel: {
        useMutation: () => ({
          mutate: vi.fn(),
          isPending: false,
        }),
      },
    },
    useUtils: () => ({
      migrations: {
        getById: {
          invalidate: vi.fn(),
        },
        list: {
          invalidate: vi.fn(),
        },
        listPending: {
          invalidate: vi.fn(),
        },
      },
    }),
  },
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/federation/migrations/m-1",
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("next/link", () => ({
  __esModule: true,
  default: ({ children, href }: { children: React.ReactNode; href: string }) =>
    React.createElement("a", { href }, children),
}));

import { MigrationDetail } from "../migration-detail";

describe("MigrationDetail", () => {
  beforeEach(resetMocks);

  it("renders loading skeleton when pending", () => {
    mockIsPending = true;
    mockMigration = undefined;
    render(<MigrationDetail migrationId="m-1" />);
    expect(screen.queryByText("other.org")).not.toBeInTheDocument();
  });

  it("renders not found when migration is null", () => {
    mockMigration = null;
    render(<MigrationDetail migrationId="m-1" />);
    expect(screen.getByText("Migration not found.")).toBeInTheDocument();
  });

  it("renders approve and reject buttons for PENDING_APPROVAL outbound", () => {
    render(<MigrationDetail migrationId="m-1" />);
    expect(
      screen.getByRole("button", { name: /approve/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /reject/i })).toBeInTheDocument();
  });

  it("renders cancel button for non-terminal status", () => {
    mockMigration = {
      ...(mockMigration as object),
      status: "APPROVED",
      direction: "inbound",
    };
    render(<MigrationDetail migrationId="m-1" />);
    expect(
      screen.getByRole("button", { name: /cancel migration/i }),
    ).toBeInTheDocument();
  });

  it("renders terminal message for completed", () => {
    mockMigration = {
      ...(mockMigration as object),
      status: "COMPLETED",
      completedAt: "2024-06-01",
    };
    render(<MigrationDetail migrationId="m-1" />);
    expect(screen.getByText(/terminal state/i)).toBeInTheDocument();
  });
});
