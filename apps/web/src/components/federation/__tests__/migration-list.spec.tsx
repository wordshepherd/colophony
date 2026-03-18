import { vi } from "vitest";
import React from "react";
import { render, screen } from "@testing-library/react";

let mockMigrations: unknown[] = [
  {
    id: "m1",
    direction: "outbound",
    peerDomain: "other.org",
    status: "PENDING_APPROVAL",
    userDid: "did:example:user1234567890",
    createdAt: "2024-01-01",
  },
];
let mockPending: unknown[] = [{ id: "m1" }];
let mockIsPending = false;

function resetMocks() {
  mockMigrations = [
    {
      id: "m1",
      direction: "outbound",
      peerDomain: "other.org",
      status: "PENDING_APPROVAL",
      userDid: "did:example:user1234567890",
      createdAt: "2024-01-01",
    },
  ];
  mockPending = [{ id: "m1" }];
  mockIsPending = false;
}

vi.mock("@/lib/trpc", () => ({
  trpc: {
    migrations: {
      list: {
        useQuery: () => ({
          data: { migrations: mockMigrations, total: mockMigrations.length },
          isPending: mockIsPending,
        }),
      },
      listPending: {
        useQuery: () => ({
          data: mockPending,
        }),
      },
    },
  },
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/federation/migrations",
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("next/link", () => ({
  __esModule: true,
  default: ({ children, href }: { children: React.ReactNode; href: string }) =>
    React.createElement("a", { href }, children),
}));

import { MigrationList } from "../migration-list";

describe("MigrationList", () => {
  beforeEach(resetMocks);

  it("renders loading skeleton when pending", () => {
    mockIsPending = true;
    render(<MigrationList />);
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("renders empty state when no migrations", () => {
    mockMigrations = [];
    mockPending = [];
    render(<MigrationList />);
    expect(screen.getByText("No migrations found.")).toBeInTheDocument();
  });

  it("renders migration table with direction and status badges", () => {
    render(<MigrationList />);
    expect(screen.getByText("outbound")).toBeInTheDocument();
    expect(screen.getByText("other.org")).toBeInTheDocument();
    expect(screen.getByText("PENDING APPROVAL")).toBeInTheDocument();
  });

  it("renders pending approval banner", () => {
    render(<MigrationList />);
    expect(screen.getByText(/pending your approval/i)).toBeInTheDocument();
  });

  it("renders tab controls", () => {
    render(<MigrationList />);
    expect(screen.getByRole("tab", { name: /all/i })).toBeInTheDocument();
    expect(
      screen.getByRole("tab", { name: /pending approval/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("tab", { name: /in progress/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /completed/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /cancelled/i })).toBeInTheDocument();
  });
});
