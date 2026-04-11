"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type RefObject,
} from "react";
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
  const taglineRef = useRef<HTMLParagraphElement>(null);
  const [taglineOpacity, setTaglineOpacity] = useState(1);

  const updateTaglineOpacity = useCallback(() => {
    const slot = heroLogoRef.current;
    if (!slot) return;
    const rect = slot.getBoundingClientRect();
    // Fade tagline out over the first 30% of the hero slot scrolling away
    const fadeEnd = rect.height * 0.3;
    const scrolled = Math.max(0, -rect.top);
    setTaglineOpacity(Math.max(0, 1 - scrolled / fadeEnd));
  }, [heroLogoRef]);

  useEffect(() => {
    updateTaglineOpacity();
    window.addEventListener("scroll", updateTaglineOpacity, { passive: true });
    return () => window.removeEventListener("scroll", updateTaglineOpacity);
  }, [updateTaglineOpacity]);

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
          {/* Logotype hero slot — invisible placeholder sized for the morph animation (wordmark only) */}
          <div
            ref={heroLogoRef}
            className="mx-auto mb-1 w-full max-w-3xl aspect-[50/9]"
            aria-hidden="true"
          />
          {/* Tagline — separate from morph element, fades out on scroll */}
          <p
            ref={taglineRef}
            className="mb-16 font-serif text-2xl tracking-wide text-[#d8cfc2] md:text-3xl"
            style={{ opacity: taglineOpacity }}
          >
            Submissions, <em className="text-[#c87941]">managed.</em>
          </p>
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
            The editorial workflow your magazine deserves.
          </h1>
          <p className="mt-6 text-lg leading-relaxed text-muted-foreground lg:text-xl">
            End-to-end manuscript management purpose-built for writers and
            literary magazines — from submission to publication and all the
            details along the way.
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
                href="https://github.com/wordshepherd/colophony"
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
        <div className="relative mx-auto mt-24 max-w-5xl lg:mt-32">
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
