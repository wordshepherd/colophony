"use client";

import { useInView } from "@/hooks/use-in-view";
import { Server, Cloud } from "lucide-react";

function FadeIn({ children }: { children: React.ReactNode }) {
  const { ref, isInView } = useInView(0.1);
  return (
    <div
      ref={ref}
      className={`transition-all duration-700 ease-out ${
        isInView ? "translate-y-0 opacity-100" : "translate-y-8 opacity-0"
      }`}
    >
      {children}
    </div>
  );
}

export function LandingDeployment() {
  return (
    <section
      id="hosting"
      className="scroll-mt-20 border-t border-border/50 py-24 md:py-32"
    >
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <FadeIn>
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Run it your way
            </h2>
            <p className="mt-4 text-lg text-muted-foreground">
              Your magazine, your rules. Choose the deployment model that fits
              your team.
            </p>
          </div>
        </FadeIn>

        <div className="mt-16 grid gap-8 lg:grid-cols-2">
          <FadeIn>
            <div className="flex h-full flex-col rounded-xl border border-border/50 bg-card p-8 lg:p-10">
              <div className="mb-6 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary">
                  <Server className="h-5 w-5 text-foreground" />
                </div>
                <h3 className="text-xl font-bold">Self-Hosted</h3>
              </div>
              <p className="mb-6 text-sm font-semibold uppercase tracking-wider text-accent">
                Open Source — AGPL-3.0
              </p>
              <ul className="flex-1 space-y-4 text-muted-foreground">
                <li>
                  Full source on GitHub. Run it on your own infrastructure with
                  Docker Compose — one server, your data, your rules.
                </li>
                <li>
                  No vendor lock-in. If you leave, you take everything — your
                  data, your configuration, your submission history. The code is
                  yours to run forever.
                </li>
                <li>
                  Full control over branding, integrations, and infrastructure
                  decisions.
                </li>
                <li className="text-sm italic text-muted-foreground/70">
                  Ideal for magazines with technical staff or existing
                  infrastructure.
                </li>
              </ul>
            </div>
          </FadeIn>

          <FadeIn>
            <div className="relative flex h-full flex-col rounded-xl border border-accent/30 bg-card p-8 lg:p-10">
              <div className="mb-6 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent/15">
                  <Cloud className="h-5 w-5 text-accent" />
                </div>
                <h3 className="text-xl font-bold">Managed Hosting</h3>
                {/* TODO: Replace "Coming soon" with launch date when available */}
                <span className="rounded-full bg-accent/15 px-3 py-0.5 text-xs font-medium text-accent">
                  Coming soon
                </span>
              </div>
              <p className="mb-6 text-muted-foreground">
                Colophony runs the infrastructure. You run the magazine.
              </p>
              <ul className="flex-1 space-y-4 text-muted-foreground">
                <li>
                  No servers to maintain, no updates to apply, no backups to
                  manage.
                </li>
                <li>
                  Your data is still portable. Managed hosting runs the same
                  open-source software. Export everything and move to
                  self-hosting at any time — no lock-in, no proprietary formats.
                </li>
                <li>
                  <span className="text-foreground">Federation included:</span>{" "}
                  your magazine joins a network of Colophony instances. When a
                  writer accepts an offer elsewhere, you know immediately — not
                  three months later.
                </li>
                <li className="text-sm italic text-muted-foreground/70">
                  Ideal for editors who want to focus on editorial work, not
                  DevOps.
                </li>
              </ul>
            </div>
          </FadeIn>
        </div>
      </div>
    </section>
  );
}
