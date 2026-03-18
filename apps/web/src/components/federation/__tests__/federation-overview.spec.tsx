import { vi } from "vitest";
import React from "react";
import { render, screen } from "@testing-library/react";

let mockConfig: unknown = undefined;
let mockPeers: unknown[] = [];
let mockIsConfigLoading = false;
let mockIsPeersLoading = false;

function resetMocks() {
  mockConfig = {
    id: "cfg-1",
    publicKey: "-----BEGIN PUBLIC KEY-----\nMCowBQ...",
    keyId: "example.com#main",
    mode: "allowlist",
    contactEmail: null,
    capabilities: ["identity", "simsub.check"],
    enabled: true,
  };
  mockPeers = [
    { id: "p1", status: "active", domain: "a.com" },
    { id: "p2", status: "pending_inbound", domain: "b.com" },
    { id: "p3", status: "pending_outbound", domain: "c.com" },
    { id: "p4", status: "active", domain: "d.com" },
  ];
  mockIsConfigLoading = false;
  mockIsPeersLoading = false;
}

vi.mock("@/lib/trpc", () => ({
  trpc: {
    federation: {
      getConfig: {
        useQuery: () => ({
          data: mockIsConfigLoading ? undefined : mockConfig,
          isPending: mockIsConfigLoading,
        }),
      },
      updateConfig: {
        useMutation: () => ({
          mutate: vi.fn(),
          isPending: false,
        }),
      },
      listPeers: {
        useQuery: () => ({
          data: mockIsPeersLoading ? undefined : mockPeers,
          isPending: mockIsPeersLoading,
        }),
      },
    },
    useUtils: () => ({
      federation: {
        getConfig: { invalidate: vi.fn() },
      },
    }),
  },
}));

vi.mock("@/hooks/use-organization", () => ({
  useOrganization: () => ({
    isAdmin: true,
    isEditor: true,
  }),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/federation",
}));

vi.mock("next/link", () => ({
  __esModule: true,
  default: ({ children, href }: { children: React.ReactNode; href: string }) =>
    React.createElement("a", { href }, children),
}));

import { FederationOverview } from "../federation-overview";

describe("FederationOverview", () => {
  beforeEach(resetMocks);

  it("renders loading skeleton when config query is pending", () => {
    mockIsConfigLoading = true;
    mockIsPeersLoading = true;
    render(<FederationOverview />);
    expect(screen.queryByText("Federation")).not.toBeInTheDocument();
  });

  it("renders federation status with mode badge and capabilities when loaded", () => {
    render(<FederationOverview />);
    expect(screen.getByText("Federation")).toBeInTheDocument();
    expect(screen.getByText("Enabled")).toBeInTheDocument();
    expect(screen.getByText("allowlist")).toBeInTheDocument();
    expect(screen.getByText("identity")).toBeInTheDocument();
    expect(screen.getByText("simsub.check")).toBeInTheDocument();
  });

  it("renders peer count summary grouped by status", () => {
    render(<FederationOverview />);
    expect(screen.getByText("2 Active")).toBeInTheDocument();
    expect(screen.getByText("1 Pending Inbound")).toBeInTheDocument();
    expect(screen.getByText("1 Pending Outbound")).toBeInTheDocument();
  });

  it("renders disabled badge when enabled is false", () => {
    mockConfig = {
      ...(mockConfig as Record<string, unknown>),
      enabled: false,
    };
    render(<FederationOverview />);
    expect(screen.getByText("Disabled")).toBeInTheDocument();
    expect(screen.queryByText("Enabled")).not.toBeInTheDocument();
  });
});
