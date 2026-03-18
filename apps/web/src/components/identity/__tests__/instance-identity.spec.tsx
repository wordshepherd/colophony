import { vi } from "vitest";
import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { InstanceIdentity } from "../instance-identity";

const fullMetadata = {
  software: "colophony",
  version: "2.0.0-dev",
  domain: "magazine.example",
  publicKey: "-----BEGIN PUBLIC KEY-----\nMCowBQ...\n-----END PUBLIC KEY-----",
  keyId: "magazine.example#main",
  capabilities: ["identity.verify", "simsub.check"],
  mode: "allowlist",
  contactEmail: "admin@magazine.example",
  publications: [
    {
      id: "pub-1",
      name: "Literary Review",
      slug: "literary-review",
      organizationSlug: "lit-org",
    },
  ],
  trustedPeers: ["peer1.example", "peer2.example"],
};

function mockFetchSuccess(data: unknown) {
  global.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve(data),
  } as Response);
}

function mockFetch503Disabled() {
  global.fetch = vi.fn().mockResolvedValue({
    ok: false,
    status: 503,
    json: () => Promise.resolve({ error: "federation_disabled" }),
  } as unknown as Response);
}

function mockFetchFailure() {
  global.fetch = vi.fn().mockRejectedValue(new Error("Network error"));
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("InstanceIdentity", () => {
  it("renders loading skeletons initially", () => {
    // Never-resolving fetch to keep loading state
    global.fetch = vi.fn().mockReturnValue(new Promise(() => {}));

    render(<InstanceIdentity apiUrl="http://localhost:4000" />);

    expect(screen.getByTestId("loading-skeletons")).toBeInTheDocument();
  });

  it("renders instance metadata on successful fetch", async () => {
    mockFetchSuccess(fullMetadata);

    render(<InstanceIdentity apiUrl="http://localhost:4000" />);

    await waitFor(() => {
      expect(screen.getByTestId("version-badge")).toHaveTextContent(
        "v2.0.0-dev",
      );
    });

    expect(screen.getByTestId("instance-domain")).toHaveTextContent(
      "magazine.example",
    );
    expect(screen.getByTestId("mode-label")).toHaveTextContent("Allowlist");
    expect(screen.getByText("Literary Review")).toBeInTheDocument();
    expect(screen.getByText("peer1.example")).toBeInTheDocument();
    expect(screen.getByText("peer2.example")).toBeInTheDocument();
    expect(screen.getByText("AGPL-3.0-or-later")).toBeInTheDocument();
    expect(screen.getByText("Contributing Guide")).toBeInTheDocument();
  });

  it("renders federation disabled state", async () => {
    mockFetch503Disabled();

    render(<InstanceIdentity apiUrl="http://localhost:4000" />);

    await waitFor(() => {
      expect(screen.getByText("Federation Not Enabled")).toBeInTheDocument();
    });

    // Governance section should still render
    expect(screen.getByText("AGPL-3.0-or-later")).toBeInTheDocument();
  });

  it("renders error state on fetch failure", async () => {
    mockFetchFailure();

    render(<InstanceIdentity apiUrl="http://localhost:4000" />);

    await waitFor(() => {
      expect(screen.getByText("Unable to Load")).toBeInTheDocument();
    });
  });

  it("renders empty states for publications and peers", async () => {
    mockFetchSuccess({
      ...fullMetadata,
      publications: [],
      trustedPeers: [],
    });

    render(<InstanceIdentity apiUrl="http://localhost:4000" />);

    await waitFor(() => {
      expect(screen.getByText("No publications listed.")).toBeInTheDocument();
    });

    expect(
      screen.getByText("No trusted peers configured yet."),
    ).toBeInTheDocument();
  });

  it("handles missing trustedPeers field", async () => {
    const metadataWithoutPeers = { ...fullMetadata };
    delete (metadataWithoutPeers as Record<string, unknown>).trustedPeers;
    mockFetchSuccess(metadataWithoutPeers);

    render(<InstanceIdentity apiUrl="http://localhost:4000" />);

    await waitFor(() => {
      expect(screen.getByTestId("version-badge")).toBeInTheDocument();
    });

    // Should not crash — renders empty state for peers
    expect(
      screen.getByText("No trusted peers configured yet."),
    ).toBeInTheDocument();
  });
});
