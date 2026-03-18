import { vi } from "vitest";
import React from "react";
import { render, screen } from "@testing-library/react";

let mockPeer: unknown = undefined;
let mockIsPending = false;
let mockError: unknown = null;

function resetMocks() {
  mockPeer = {
    id: "peer-1",
    organizationId: "org-1",
    domain: "remote.example.com",
    instanceUrl: "https://remote.example.com",
    publicKey: "-----BEGIN PUBLIC KEY-----\nMCowBQ...",
    keyId: "remote.example.com#main",
    grantedCapabilities: { "simsub.check": true },
    status: "active",
    initiatedBy: "local",
    protocolVersion: "1.0",
    lastVerifiedAt: "2026-01-01T00:00:00.000Z",
    createdAt: "2025-12-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
  mockIsPending = false;
  mockError = null;
}

vi.mock("@/lib/trpc", () => ({
  trpc: {
    federation: {
      getPeer: {
        useQuery: () => ({
          data: mockIsPending ? undefined : mockPeer,
          isPending: mockIsPending,
          error: mockError,
        }),
      },
      rejectPeer: {
        useMutation: () => ({
          mutate: vi.fn(),
          isPending: false,
        }),
      },
      revokePeer: {
        useMutation: () => ({
          mutate: vi.fn(),
          isPending: false,
        }),
      },
      acceptPeer: {
        useMutation: () => ({
          mutate: vi.fn(),
          isPending: false,
        }),
      },
    },
    useUtils: () => ({
      federation: {
        getPeer: { invalidate: vi.fn() },
        listPeers: { invalidate: vi.fn() },
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
  usePathname: () => "/federation/peers/peer-1",
  useRouter: () => ({
    push: vi.fn(),
  }),
}));

vi.mock("next/link", () => ({
  __esModule: true,
  default: ({ children, href }: { children: React.ReactNode; href: string }) =>
    React.createElement("a", { href }, children),
}));

import { PeerDetail } from "../peer-detail";

describe("PeerDetail", () => {
  beforeEach(resetMocks);

  it("renders peer info card with domain, status, key info", () => {
    render(<PeerDetail peerId="peer-1" />);
    expect(screen.getByText("remote.example.com")).toBeInTheDocument();
    expect(screen.getByText("active")).toBeInTheDocument();
    expect(screen.getByText("remote.example.com#main")).toBeInTheDocument();
  });

  it("shows Accept and Reject buttons for pending_inbound peer", () => {
    mockPeer = {
      ...(mockPeer as Record<string, unknown>),
      status: "pending_inbound",
    };
    render(<PeerDetail peerId="peer-1" />);
    expect(screen.getByText("Accept")).toBeInTheDocument();
    expect(screen.getByText("Reject")).toBeInTheDocument();
  });

  it("shows Revoke button for active peer", () => {
    render(<PeerDetail peerId="peer-1" />);
    expect(screen.getByText("Revoke Trust")).toBeInTheDocument();
  });

  it("shows no action buttons for rejected/revoked peers", () => {
    mockPeer = {
      ...(mockPeer as Record<string, unknown>),
      status: "revoked",
    };
    render(<PeerDetail peerId="peer-1" />);
    expect(screen.queryByText("Accept")).not.toBeInTheDocument();
    expect(screen.queryByText("Reject")).not.toBeInTheDocument();
    expect(screen.queryByText("Revoke Trust")).not.toBeInTheDocument();
    expect(
      screen.getByText(
        "This trust relationship has been revoked. No actions available.",
      ),
    ).toBeInTheDocument();
  });

  it("shows waiting message for pending_outbound peer", () => {
    mockPeer = {
      ...(mockPeer as Record<string, unknown>),
      status: "pending_outbound",
    };
    render(<PeerDetail peerId="peer-1" />);
    expect(
      screen.getByText(
        "Waiting for the remote instance to accept your trust request.",
      ),
    ).toBeInTheDocument();
  });
});
