"use client";

import { useState, type RefObject } from "react";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { getDemoUrl } from "@/lib/demo-url";

const navLinks = [
  { label: "Features", href: "#features" },
  { label: "For Writers", href: "#writers" },
  { label: "For Editors", href: "#editors" },
  { label: "Hosting", href: "#hosting" },
] as const;

function LandingMobileMenu({ onSignIn }: { onSignIn: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="md:hidden">
          <Menu className="h-5 w-5" />
          <span className="sr-only">Toggle menu</span>
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-64">
        <SheetTitle className="sr-only">Navigation</SheetTitle>
        <nav className="mt-8 flex flex-col gap-4">
          {navLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              onClick={() => setOpen(false)}
              className="text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              {link.label}
            </a>
          ))}
          <hr className="border-border/50" />
          <button
            onClick={() => {
              onSignIn();
              setOpen(false);
            }}
            className="text-left text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            Sign in
          </button>
          <Button variant="ghost" asChild className="justify-start">
            <a href={getDemoUrl()} onClick={() => setOpen(false)}>
              Try Demo
            </a>
          </Button>
          <Button
            asChild
            className="justify-start bg-accent text-accent-foreground hover:bg-accent/90"
          >
            <a href="#consult" onClick={() => setOpen(false)}>
              Request a Consult
            </a>
          </Button>
        </nav>
      </SheetContent>
    </Sheet>
  );
}

interface LandingHeaderProps {
  onSignIn: () => void;
  headerLogoRef: RefObject<HTMLDivElement | null>;
}

export function LandingHeader({ onSignIn, headerLogoRef }: LandingHeaderProps) {
  return (
    <header className="sticky top-0 z-50 border-b border-border/50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6 lg:px-8">
        <div className="flex items-center gap-2">
          <LandingMobileMenu onSignIn={onSignIn} />
          {/* Logotype header slot — invisible placeholder for the morph animation target */}
          <div
            ref={headerLogoRef}
            className="h-10 w-[200px]"
            aria-hidden="true"
          />
        </div>

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
            <a href={getDemoUrl()}>Try Demo</a>
          </Button>
          <Button
            asChild
            className="hidden bg-accent text-accent-foreground hover:bg-accent/90 md:inline-flex"
          >
            <a href="#consult">Request a Consult</a>
          </Button>
        </div>
      </div>
    </header>
  );
}
