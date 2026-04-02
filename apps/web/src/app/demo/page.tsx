"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { loginAsDemo } from "@/lib/demo-auth";

export default function DemoPage() {
  const router = useRouter();
  const [loading, setLoading] = useState<"writer" | "editor" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = useCallback(
    async (role: "writer" | "editor") => {
      setLoading(role);
      setError(null);
      try {
        const redirectPath = await loginAsDemo(role);
        router.push(redirectPath);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong");
        setLoading(null);
      }
    },
    [router],
  );

  return (
    <div className="dark min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-4xl px-6 py-16 sm:py-24">
        {/* Header */}
        <div className="text-center mb-12">
          <Link
            href="/"
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            &larr; Back to home
          </Link>
          <h1 className="mt-6 font-serif text-4xl font-bold tracking-tight sm:text-5xl">
            Try Colophony
          </h1>
          <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">
            Explore the platform from either perspective. No account required
            &mdash; demo data resets every few hours.
          </p>
        </div>

        {error && (
          <div className="mb-8 rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-center text-sm text-destructive">
            {error}
          </div>
        )}

        {/* Role cards */}
        <div className="grid gap-6 sm:grid-cols-2">
          {/* Writer card */}
          <button
            onClick={() => handleLogin("writer")}
            disabled={loading !== null}
            className="group relative rounded-xl border border-border bg-card p-8 text-left transition-all hover:border-primary/50 hover:shadow-lg hover:shadow-primary/5 disabled:opacity-60 disabled:cursor-wait"
          >
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                <path d="m15 5 4 4" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold">Explore as a Writer</h2>
            <p className="mt-1 text-sm text-muted-foreground font-medium">
              Elena Vasquez
            </p>
            <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
              Submit work, track manuscripts across multiple magazines, manage
              simultaneous submissions, and monitor your acceptance rates.
            </p>
            {loading === "writer" && (
              <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-card/80">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              </div>
            )}
          </button>

          {/* Editor card */}
          <button
            onClick={() => handleLogin("editor")}
            disabled={loading !== null}
            className="group relative rounded-xl border border-border bg-card p-8 text-left transition-all hover:border-primary/50 hover:shadow-lg hover:shadow-primary/5 disabled:opacity-60 disabled:cursor-wait"
          >
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
                <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold">Explore as an Editor</h2>
            <p className="mt-1 text-sm text-muted-foreground font-medium">
              Margaret Chen, The Meridian Review
            </p>
            <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
              Review submissions, score and vote on pieces, build issues, manage
              contracts, track contributor payments, and run your magazine.
            </p>
            {loading === "editor" && (
              <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-card/80">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              </div>
            )}
          </button>
        </div>

        {/* Footer note */}
        <p className="mt-10 text-center text-xs text-muted-foreground">
          Demo data is shared and resets periodically. Don&apos;t enter real
          information.
        </p>
      </div>
    </div>
  );
}
