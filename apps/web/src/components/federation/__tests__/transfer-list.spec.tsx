import { vi } from "vitest";
import React from "react";
import { render, screen } from "@testing-library/react";

let mockTransfers: unknown[] = [
  {
    id: "t1",
    targetDomain: "peer.com",
    status: "PENDING",
    submissionId: "sub-1234-5678",
    createdAt: "2024-01-01",
    completedAt: null,
  },
];
let mockIsPending = false;

function resetMocks() {
  mockTransfers = [
    {
      id: "t1",
      targetDomain: "peer.com",
      status: "PENDING",
      submissionId: "sub-1234-5678",
      createdAt: "2024-01-01",
      completedAt: null,
    },
  ];
  mockIsPending = false;
}

vi.mock("@/lib/trpc", () => ({
  trpc: {
    transfers: {
      list: {
        useQuery: () => ({
          data: { transfers: mockTransfers, total: mockTransfers.length },
          isPending: mockIsPending,
        }),
      },
    },
  },
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/federation/transfers",
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("next/link", () => ({
  __esModule: true,
  default: ({ children, href }: { children: React.ReactNode; href: string }) =>
    React.createElement("a", { href }, children),
}));

import { TransferList } from "../transfer-list";

describe("TransferList", () => {
  beforeEach(resetMocks);

  it("renders loading skeleton when pending", () => {
    mockIsPending = true;
    render(<TransferList />);
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("renders empty state when no transfers", () => {
    mockTransfers = [];
    render(<TransferList />);
    expect(screen.getByText("No transfers found.")).toBeInTheDocument();
  });

  it("renders transfer table with status badges", () => {
    render(<TransferList />);
    expect(screen.getByText("peer.com")).toBeInTheDocument();
    expect(screen.getByText("PENDING")).toBeInTheDocument();
  });

  it("renders tab controls", () => {
    render(<TransferList />);
    expect(screen.getByRole("button", { name: /all/i })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /pending/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /completed/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /failed/i })).toBeInTheDocument();
  });
});
