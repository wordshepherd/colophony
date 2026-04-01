import { vi } from "vitest";
import React from "react";
import { render, screen } from "@testing-library/react";

let mockInstances: unknown[] = [
  {
    id: "i1",
    domain: "spoke.example.com",
    instanceUrl: "https://spoke.example.com",
    status: "active",
    lastSeenAt: "2024-06-01",
    createdAt: "2024-01-01",
  },
];
let mockIsPending = false;
let mockError: unknown = null;

function resetMocks() {
  mockInstances = [
    {
      id: "i1",
      domain: "spoke.example.com",
      instanceUrl: "https://spoke.example.com",
      status: "active",
      lastSeenAt: "2024-06-01",
      createdAt: "2024-01-01",
    },
  ];
  mockIsPending = false;
  mockError = null;
}

vi.mock("@/lib/trpc", () => ({
  trpc: {
    hub: {
      listInstances: {
        useQuery: () => ({
          data: mockInstances,
          isPending: mockIsPending,
          error: mockError,
        }),
      },
    },
  },
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/federation/hub",
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("next/link", () => ({
  __esModule: true,
  default: ({ children, href }: { children: React.ReactNode; href: string }) =>
    React.createElement("a", { href }, children),
}));

import { HubAdmin } from "../hub-admin";

describe("HubAdmin", () => {
  beforeEach(resetMocks);

  it("renders loading skeleton when pending", () => {
    mockIsPending = true;
    mockInstances = [];
    render(<HubAdmin />);
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("renders hub not enabled message when error is NOT_FOUND", () => {
    mockError = { data: { code: "NOT_FOUND" }, message: "not found" };
    mockInstances = [];
    render(<HubAdmin />);
    expect(screen.getByText(/hub mode is not enabled/i)).toBeInTheDocument();
  });

  it("renders instance table with status badges", () => {
    render(<HubAdmin />);
    expect(screen.getByText("spoke.example.com")).toBeInTheDocument();
    expect(screen.getByText("active")).toBeInTheDocument();
  });

  it("renders tab controls", () => {
    render(<HubAdmin />);
    expect(screen.getByRole("button", { name: /all/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /active/i })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /suspended/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /revoked/i }),
    ).toBeInTheDocument();
  });
});
