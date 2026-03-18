import { vi } from "vitest";
import React from "react";
import { render, screen } from "@testing-library/react";

let mockInstance: unknown = {
  id: "i-1",
  domain: "spoke.example.com",
  instanceUrl: "https://spoke.example.com",
  status: "active",
  lastSeenAt: "2024-06-01",
  createdAt: "2024-01-01",
  metadata: { version: "1.0" },
};
let mockIsPending = false;

function resetMocks() {
  mockInstance = {
    id: "i-1",
    domain: "spoke.example.com",
    instanceUrl: "https://spoke.example.com",
    status: "active",
    lastSeenAt: "2024-06-01",
    createdAt: "2024-01-01",
    metadata: { version: "1.0" },
  };
  mockIsPending = false;
}

vi.mock("@/lib/trpc", () => ({
  trpc: {
    hub: {
      getInstanceById: {
        useQuery: () => ({
          data: mockInstance,
          isPending: mockIsPending,
          error: null,
        }),
      },
      suspendInstance: {
        useMutation: () => ({
          mutate: vi.fn(),
          isPending: false,
        }),
      },
      revokeInstance: {
        useMutation: () => ({
          mutate: vi.fn(),
          isPending: false,
        }),
      },
    },
    useUtils: () => ({
      hub: {
        getInstanceById: {
          invalidate: vi.fn(),
        },
        listInstances: {
          invalidate: vi.fn(),
        },
      },
    }),
  },
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/federation/hub/i-1",
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("next/link", () => ({
  __esModule: true,
  default: ({ children, href }: { children: React.ReactNode; href: string }) =>
    React.createElement("a", { href }, children),
}));

import { HubInstanceDetail } from "../hub-instance-detail";

describe("HubInstanceDetail", () => {
  beforeEach(resetMocks);

  it("renders loading skeleton when pending", () => {
    mockIsPending = true;
    mockInstance = undefined;
    render(<HubInstanceDetail instanceId="i-1" />);
    expect(screen.queryByText("spoke.example.com")).not.toBeInTheDocument();
  });

  it("renders not found when instance is null", () => {
    mockInstance = null;
    render(<HubInstanceDetail instanceId="i-1" />);
    expect(screen.getByText("Instance not found.")).toBeInTheDocument();
  });

  it("renders instance info fields", () => {
    render(<HubInstanceDetail instanceId="i-1" />);
    expect(screen.getByText("spoke.example.com")).toBeInTheDocument();
  });

  it("renders suspend and revoke buttons for active status", () => {
    render(<HubInstanceDetail instanceId="i-1" />);
    expect(
      screen.getByRole("button", { name: /suspend/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /revoke/i })).toBeInTheDocument();
  });

  it("renders only revoke for suspended status", () => {
    mockInstance = {
      ...(mockInstance as object),
      status: "suspended",
    };
    render(<HubInstanceDetail instanceId="i-1" />);
    expect(screen.getByRole("button", { name: /revoke/i })).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /suspend/i }),
    ).not.toBeInTheDocument();
  });
});
