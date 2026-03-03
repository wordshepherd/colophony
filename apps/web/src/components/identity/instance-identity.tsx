"use client";

import { useEffect, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";

// ---------------------------------------------------------------------------
// Local types (display-only — not shared with backend)
// ---------------------------------------------------------------------------

interface FederationPublication {
  id: string;
  name: string;
  slug: string;
  organizationSlug: string;
}

interface InstanceMetadata {
  software: string;
  version: string;
  domain: string;
  publicKey: string;
  keyId: string;
  capabilities: string[];
  mode: "allowlist" | "open" | "managed_hub";
  contactEmail: string | null;
  publications: FederationPublication[];
  trustedPeers?: string[];
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CAPABILITY_DESCRIPTIONS: Record<string, string> = {
  "identity.verify": "Verify writer identity across instances",
  "identity.migrate": "Support writer identity migration",
  "simsub.check": "Check simultaneous submission status",
  "simsub.respond": "Respond to simultaneous submission queries",
  "transfer.initiate": "Initiate piece transfers to other instances",
  "transfer.receive": "Receive piece transfers from other instances",
};

const MODE_LABELS: Record<string, { label: string; description: string }> = {
  allowlist: {
    label: "Allowlist",
    description:
      "This instance federates with explicitly approved peer instances only.",
  },
  open: {
    label: "Open",
    description:
      "This instance accepts federation requests from any compatible instance.",
  },
  managed_hub: {
    label: "Managed Hub",
    description:
      "This instance federates through a managed hub for coordinated trust.",
  },
};

const GITHUB_REPO = "https://github.com/wordshepherd/colophony/blob/main";

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface InstanceIdentityProps {
  apiUrl: string;
}

type FetchState =
  | { status: "loading" }
  | { status: "federation_disabled" }
  | { status: "fetch_failed" }
  | { status: "success"; data: InstanceMetadata };

export function InstanceIdentity({ apiUrl }: InstanceIdentityProps) {
  const [state, setState] = useState<FetchState>({ status: "loading" });

  useEffect(() => {
    const url = `${apiUrl}/.well-known/colophony`;
    fetch(url)
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          if (
            res.status === 503 &&
            (body as Record<string, unknown>).error === "federation_disabled"
          ) {
            setState({ status: "federation_disabled" });
            return;
          }
          setState({ status: "fetch_failed" });
          return;
        }
        const data = (await res.json()) as InstanceMetadata;
        setState({ status: "success", data });
      })
      .catch(() => {
        setState({ status: "fetch_failed" });
      });
  }, [apiUrl]);

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto px-4 py-12 space-y-8">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">Colophony</h1>
          <p className="text-muted-foreground text-lg">Instance Identity</p>
        </div>

        {/* Loading */}
        {state.status === "loading" && <LoadingSkeletons />}

        {/* Federation disabled */}
        {state.status === "federation_disabled" && (
          <>
            <Alert>
              <AlertTitle>Federation Not Enabled</AlertTitle>
              <AlertDescription>
                Federation is not enabled on this instance. The instance
                operator has not configured cross-instance communication.
              </AlertDescription>
            </Alert>
            <GovernanceSection />
          </>
        )}

        {/* Fetch failed */}
        {state.status === "fetch_failed" && (
          <Alert variant="destructive">
            <AlertTitle>Unable to Load</AlertTitle>
            <AlertDescription>
              Unable to load instance metadata. The API server may be
              unavailable.
            </AlertDescription>
          </Alert>
        )}

        {/* Success */}
        {state.status === "success" && (
          <>
            <InstanceInfoCard data={state.data} />
            <CapabilitiesCard capabilities={state.data.capabilities} />
            <PublicationsCard publications={state.data.publications} />
            <TrustedPeersCard
              peers={state.data.trustedPeers}
              mode={state.data.mode}
            />
            <GovernanceSection />
            <TechnicalEndpointsCard
              apiUrl={apiUrl}
              domain={state.data.domain}
            />
          </>
        )}

        {/* Footer */}
        <footer className="text-center text-sm text-muted-foreground pt-4 border-t">
          &copy; {new Date().getFullYear()} Colophony. Open-source
          infrastructure for literary magazines.
        </footer>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function LoadingSkeletons() {
  return (
    <div className="space-y-6" data-testid="loading-skeletons">
      {Array.from({ length: 4 }).map((_, i) => (
        <Card key={i}>
          <CardHeader>
            <Skeleton className="h-6 w-48" />
          </CardHeader>
          <CardContent className="space-y-3">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function InstanceInfoCard({ data }: { data: InstanceMetadata }) {
  const modeInfo = MODE_LABELS[data.mode] ?? {
    label: data.mode,
    description: "",
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Instance Information</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2 items-center">
          <Badge variant="secondary" data-testid="version-badge">
            v{data.version}
          </Badge>
          <Badge variant="outline">{data.software}</Badge>
        </div>
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
          <div>
            <dt className="font-medium text-muted-foreground">Domain</dt>
            <dd data-testid="instance-domain">{data.domain}</dd>
          </div>
          <div>
            <dt className="font-medium text-muted-foreground">
              Federation Mode
            </dt>
            <dd>
              <span data-testid="mode-label">{modeInfo.label}</span>
              <p className="text-muted-foreground text-xs mt-1">
                {modeInfo.description}
              </p>
            </dd>
          </div>
          {data.contactEmail && (
            <div>
              <dt className="font-medium text-muted-foreground">Contact</dt>
              <dd>
                <a
                  href={`mailto:${data.contactEmail}`}
                  className="text-primary underline"
                >
                  {data.contactEmail}
                </a>
              </dd>
            </div>
          )}
        </dl>
      </CardContent>
    </Card>
  );
}

function CapabilitiesCard({ capabilities }: { capabilities: string[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Federation Capabilities</CardTitle>
        <CardDescription>
          Services this instance provides to the federation network
        </CardDescription>
      </CardHeader>
      <CardContent>
        {capabilities.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No capabilities advertised.
          </p>
        ) : (
          <ul className="space-y-2">
            {capabilities.map((cap) => (
              <li key={cap} className="flex items-start gap-2 text-sm">
                <Badge variant="outline" className="shrink-0 mt-0.5">
                  {cap}
                </Badge>
                <span className="text-muted-foreground">
                  {CAPABILITY_DESCRIPTIONS[cap] ?? "Custom capability"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function PublicationsCard({
  publications,
}: {
  publications: FederationPublication[];
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Publications</CardTitle>
        <CardDescription>
          Literary magazines hosted on this instance
        </CardDescription>
      </CardHeader>
      <CardContent>
        {publications.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No publications listed.
          </p>
        ) : (
          <ul className="space-y-1">
            {publications.map((pub) => (
              <li key={pub.id} className="text-sm">
                <span className="font-medium">{pub.name}</span>
                <span className="text-muted-foreground ml-2">
                  ({pub.organizationSlug}/{pub.slug})
                </span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function TrustedPeersCard({ peers, mode }: { peers?: string[]; mode: string }) {
  const peerList = peers ?? [];
  const emptyMessage =
    mode === "allowlist"
      ? "No trusted peers configured yet."
      : mode === "managed_hub"
        ? "Peers are managed through the federation hub."
        : "No peers have established trust with this instance yet.";

  return (
    <Card>
      <CardHeader>
        <CardTitle>Trusted Peers</CardTitle>
        <CardDescription>
          Instances this server has established federation trust with
        </CardDescription>
      </CardHeader>
      <CardContent>
        {peerList.length === 0 ? (
          <p className="text-sm text-muted-foreground">{emptyMessage}</p>
        ) : (
          <ul className="space-y-1">
            {peerList.map((domain) => (
              <li key={domain} className="text-sm font-mono">
                {domain}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function GovernanceSection() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Governance</CardTitle>
        <CardDescription>
          How this project is developed and maintained
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        <dl className="space-y-3">
          <div>
            <dt className="font-medium text-muted-foreground">License</dt>
            <dd>
              <a
                href={`${GITHUB_REPO}/LICENSE`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary underline"
              >
                AGPL-3.0-or-later
              </a>
            </dd>
          </div>
          <div>
            <dt className="font-medium text-muted-foreground">
              Governance Model
            </dt>
            <dd>Solo-maintainer with open contribution</dd>
          </div>
        </dl>
        <div className="flex flex-wrap gap-3 pt-2">
          <a
            href={`${GITHUB_REPO}/CONTRIBUTING.md`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary underline"
          >
            Contributing Guide
          </a>
          <a
            href={`${GITHUB_REPO}/CODE_OF_CONDUCT.md`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary underline"
          >
            Code of Conduct
          </a>
          <a
            href={`${GITHUB_REPO}/SECURITY.md`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary underline"
          >
            Security Policy
          </a>
          <a
            href={`${GITHUB_REPO}/docs/governance.md`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary underline"
          >
            Governance
          </a>
          <a
            href={`${GITHUB_REPO}/docs/licensing.md`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary underline"
          >
            Licensing
          </a>
        </div>
      </CardContent>
    </Card>
  );
}

function TechnicalEndpointsCard({
  apiUrl,
  domain,
}: {
  apiUrl: string;
  domain: string;
}) {
  const baseUrl =
    domain === "localhost" || domain.startsWith("localhost:")
      ? apiUrl
      : `https://${domain}`;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Technical Endpoints</CardTitle>
        <CardDescription>Machine-readable federation endpoints</CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="space-y-2 text-sm">
          <li>
            <a
              href={`${baseUrl}/.well-known/colophony`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary underline font-mono"
            >
              /.well-known/colophony
            </a>
            <span className="text-muted-foreground ml-2">
              Instance metadata (JSON)
            </span>
          </li>
          <li>
            <a
              href={`${baseUrl}/.well-known/did.json`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary underline font-mono"
            >
              /.well-known/did.json
            </a>
            <span className="text-muted-foreground ml-2">
              DID Document (W3C)
            </span>
          </li>
          <li>
            <a
              href={`${baseUrl}/v1/docs`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary underline font-mono"
            >
              /v1/docs
            </a>
            <span className="text-muted-foreground ml-2">
              OpenAPI documentation
            </span>
          </li>
        </ul>
      </CardContent>
    </Card>
  );
}
