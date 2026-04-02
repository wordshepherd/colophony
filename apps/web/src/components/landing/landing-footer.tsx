import Image from "next/image";

const footerLinks = [
  {
    label: "GitHub",
    href: "https://github.com/colophony-project",
    external: true,
  },
  // TODO: Add documentation URL when docs site is live
  { label: "Documentation", href: "#", external: false },
  {
    label: "License (AGPL-3.0)",
    href: "https://github.com/colophony-project/colophony/blob/main/LICENSE",
    external: true,
  },
  // TODO: Add contact page or email when ready
  { label: "Contact", href: "#demo", external: false },
] as const;

export function LandingFooter() {
  return (
    <footer className="border-t border-border/50 py-12">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="flex flex-col items-center gap-8 md:flex-row md:justify-between">
          <Image
            src="/logos/logotype-dark.svg"
            alt="Colophony"
            width={120}
            height={24}
          />

          <nav
            className="flex flex-wrap justify-center gap-6"
            aria-label="Footer"
          >
            {footerLinks.map((link) => (
              <a
                key={link.label}
                href={link.href}
                className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                {...(link.external
                  ? { target: "_blank", rel: "noopener noreferrer" }
                  : {})}
              >
                {link.label}
              </a>
            ))}
          </nav>
        </div>

        <div className="mt-8 border-t border-border/30 pt-8 text-center">
          <p className="text-sm text-muted-foreground">
            Built for the literary community.
          </p>
          <p className="mt-2 text-xs text-muted-foreground/60">
            &copy; {new Date().getFullYear()} Colophony Project
          </p>
        </div>
      </div>
    </footer>
  );
}
