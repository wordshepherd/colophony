"use client";

import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";

const navLinks = [
  { label: "Features", href: "#features" },
  { label: "For Writers", href: "#writers" },
  { label: "For Editors", href: "#editors" },
  { label: "Hosting", href: "#hosting" },
] as const;

interface LandingHeaderProps {
  onSignIn: () => void;
}

export function LandingHeader({ onSignIn }: LandingHeaderProps) {
  return (
    <header className="sticky top-0 z-50 border-b border-border/50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6 lg:px-8">
        <Link href="/" aria-label="Colophony home">
          <Image
            src="/logos/logotype-dark.svg"
            alt="Colophony"
            width={160}
            height={32}
            priority
          />
        </Link>

        <nav className="hidden items-center gap-8 md:flex" aria-label="Main">
          {navLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              {link.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-4">
          <button
            onClick={onSignIn}
            className="hidden text-sm text-muted-foreground transition-colors hover:text-foreground md:inline"
          >
            Sign in
          </button>
          <Button variant="ghost" asChild className="hidden md:inline-flex">
            <Link href="/demo">Try Demo</Link>
          </Button>
          <Button
            asChild
            className="bg-accent text-accent-foreground hover:bg-accent/90"
          >
            <a href="#demo">Request a Demo</a>
          </Button>
        </div>
      </div>
    </header>
  );
}
