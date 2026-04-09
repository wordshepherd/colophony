"use client";

import type { RefObject } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { ExternalLink } from "lucide-react";
import { getDemoUrl } from "@/lib/demo-url";

interface LandingHeroProps {
  onRequestConsult: () => void;
  heroLogoRef: RefObject<HTMLDivElement | null>;
}

export function LandingHero({
  onRequestConsult,
  heroLogoRef,
}: LandingHeroProps) {
  return (
    <section className="relative overflow-hidden pb-24 pt-20 md:pb-32 md:pt-28">
      {/* Subtle radial gradient behind hero */}
      <div
        className="pointer-events-none absolute inset-0 -z-10"
        aria-hidden="true"
        style={{
          background:
            "radial-gradient(ellipse 80% 60% at 50% 30%, hsl(230 27% 18%) 0%, transparent 70%)",
        }}
      />

      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="mx-auto max-w-3xl text-center">
          {/* Logotype hero slot — invisible placeholder sized for the morph animation */}
          <div
            ref={heroLogoRef}
            className="mx-auto mb-8 w-full max-w-3xl aspect-[5/2]"
            aria-hidden="true"
          />
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
            The editorial workflow your magazine deserves.
          </h1>
          <p className="mt-6 text-lg leading-relaxed text-muted-foreground lg:text-xl">
            End-to-end manuscript management purpose-built for literary
            magazines — from the moment a writer submits to the day the piece is
            published and the contributor is paid.
          </p>
          <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Button size="lg" className="px-8 text-base" asChild>
              <a href={getDemoUrl()}>Try the Demo</a>
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="px-8 text-base"
              onClick={onRequestConsult}
            >
              Request a Consult
            </Button>
            <Button variant="ghost" size="lg" className="text-base" asChild>
              <a
                href="https://github.com/colophony-project"
                target="_blank"
                rel="noopener noreferrer"
              >
                View on GitHub
                <ExternalLink className="ml-2 h-4 w-4" />
              </a>
            </Button>
          </div>
        </div>

        {/* Hero screenshots — overlapping writer + editor views */}
        <div className="relative mx-auto mt-16 max-w-5xl lg:mt-20">
          <div className="relative">
            {/* Writer manuscript library — positioned left, slightly behind */}
            <div className="relative z-10 mx-auto w-[85%] md:ml-0 md:w-[65%]">
              <Image
                src="/screenshots/manuscripts-list.png"
                alt="Writer's manuscript library showing a list of works with version history, status tracking, and submission counts for each piece"
                width={1280}
                height={800}
                priority
                className="rounded-lg border border-white/10 shadow-2xl"
              />
            </div>
            {/* Editor submissions queue — overlapping right, in front */}
            <div className="relative z-20 -mt-[30%] ml-auto w-[85%] md:-mt-[45%] md:w-[55%]">
              <Image
                src="/screenshots/editor-submissions.png"
                alt="Editor's All Submissions queue showing four submissions with status badges, submitter emails, submission dates, and age indicators for editorial triage"
                width={1280}
                height={800}
                priority
                className="rounded-lg border border-white/10 shadow-2xl"
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
