"use client";

import Image from "next/image";
import { useInView } from "@/hooks/use-in-view";
import { BookOpen, Eye, type LucideIcon } from "lucide-react";

/* -------------------------------------------------------------------------- */
/*  Section 1 — "Two Sides of Every Submission"                               */
/* -------------------------------------------------------------------------- */

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

function PerspectiveColumn({
  icon: Icon,
  label,
  heading,
  features,
  screenshot,
}: {
  icon: LucideIcon;
  label: string;
  heading: string;
  features: string[];
  screenshot: { src: string; alt: string };
}) {
  return (
    <div className="flex flex-col gap-8">
      <div>
        <div className="mb-4 flex items-center gap-2 text-accent">
          <Icon className="h-5 w-5" />
          <span className="text-sm font-semibold uppercase tracking-wider">
            {label}
          </span>
        </div>
        <h3 className="text-2xl font-bold lg:text-3xl">{heading}</h3>
        <ul className="mt-6 space-y-3">
          {features.map((f) => (
            <li key={f} className="text-muted-foreground leading-relaxed">
              {f}
            </li>
          ))}
        </ul>
      </div>
      <Image
        src={screenshot.src}
        alt={screenshot.alt}
        width={1280}
        height={800}
        className="rounded-lg border border-white/10 shadow-xl"
      />
    </div>
  );
}

export function LandingTwoSides() {
  return (
    <section id="features" className="scroll-mt-20 py-24 md:py-32">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <FadeIn>
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Two sides of every submission
            </h2>
            <p className="mt-4 text-lg text-muted-foreground">
              Colophony serves both writers and editors, and treats both with
              respect.
            </p>
          </div>
        </FadeIn>

        <div className="mt-16 grid gap-16 lg:mt-20 lg:grid-cols-2 lg:gap-12">
          <FadeIn>
            <PerspectiveColumn
              icon={BookOpen}
              label="For Writers"
              heading="Your work, organized."
              features={[
                "A manuscript library with version history — not just a submissions list. The work itself is the primary object.",
                "Submit once, send to many magazines. No re-uploading, no duplicate files, no lost track of where things went.",
                "Track every submission across every magazine from a single dashboard. When one accepts, withdrawals happen automatically.",
              ]}
              screenshot={{
                src: "/screenshots/sim-sub-dashboard.png",
                alt: "Writer's simultaneous submission dashboard showing a single manuscript tracked across multiple magazine submissions with real-time status updates",
              }}
            />
          </FadeIn>

          <FadeIn>
            <PerspectiveColumn
              icon={Eye}
              label="For Editors"
              heading="Read, review, decide."
              features={[
                "A submissions queue with information density tuned for editorial triage — sort, filter, and batch-process without losing context.",
                "Read manuscripts directly in the platform. Prose and poetry rendered with reading-quality typography, not pasted into a text box.",
                "Score, discuss, and decide without leaving the platform. Internal discussion threads, voting, and blind review modes built in.",
              ]}
              screenshot={{
                src: "/screenshots/editor-queue.png",
                alt: "Editor's review queue showing submissions with status badges, reviewer assignments, scores, and batch action controls",
              }}
            />
          </FadeIn>
        </div>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/*  Section 2 — Key Differentiators                                           */
/* -------------------------------------------------------------------------- */

function Differentiator({
  heading,
  description,
  screenshot,
  reverse,
}: {
  heading: string;
  description: string;
  screenshot: { src: string; alt: string };
  reverse?: boolean;
}) {
  return (
    <FadeIn>
      <div
        className={`grid items-center gap-10 lg:grid-cols-2 lg:gap-16 ${
          reverse ? "lg:[&>*:first-child]:order-2" : ""
        }`}
      >
        <div>
          <h3 className="text-2xl font-bold italic lg:text-3xl">{heading}</h3>
          <p className="mt-4 text-lg leading-relaxed text-muted-foreground">
            {description}
          </p>
        </div>
        <Image
          src={screenshot.src}
          alt={screenshot.alt}
          width={1280}
          height={800}
          className="rounded-lg border border-white/10 shadow-xl"
        />
      </div>
    </FadeIn>
  );
}

export function LandingDifferentiators() {
  return (
    <section
      id="writers"
      className="scroll-mt-20 border-t border-border/50 py-24 md:py-32"
    >
      <div className="mx-auto max-w-7xl space-y-24 px-6 md:space-y-32 lg:px-8">
        <Differentiator
          heading="Manuscripts rendered like literature, not like web forms."
          description="Colophony renders prose with proper paragraph indentation, generous margins, and careful typographic conventions. Poetry preserves line breaks, stanza spacing, indentation, and stepped lines exactly as written. Editors read work the way it was meant to be read. Toggle between the rendered view and the original document with a single click."
          screenshot={{
            src: "/screenshots/manuscript-detail.png",
            alt: "Manuscript detail view showing a literary work rendered with reading-quality typography — proper paragraph indentation, generous margins, and version history sidebar",
          }}
        />

        <Differentiator
          heading="Simultaneous submissions without the spreadsheet."
          description="Writers send the same piece to multiple magazines and track every submission from a single dashboard. When one magazine accepts, the platform coordinates withdrawals and status cascades across the network. No more cross-referencing spreadsheets or wondering where something was sent three months ago."
          screenshot={{
            src: "/screenshots/federation-sim-sub.png",
            alt: "Federation simultaneous submission coordination view showing cross-instance submission tracking with automatic status synchronization between magazines",
          }}
          reverse
        />

        <Differentiator
          heading="From acceptance to publication — and payment."
          description="Most platforms stop at the editorial decision. Colophony continues through contracts, copyediting, issue assembly, CMS integration, contributor payments, and year-end tax forms. The full publication lifecycle, from first submission to final contributor payment, in one place."
          screenshot={{
            src: "/screenshots/slate-pipeline.png",
            alt: "Slate publication pipeline showing accepted pieces moving through contract signing, copyediting, proofing, and issue assembly stages with status indicators",
          }}
        />
      </div>
    </section>
  );
}
