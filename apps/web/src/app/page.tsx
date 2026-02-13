"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { hasAuthTokens } from "@/lib/auth";
import { Button } from "@/components/ui/button";

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    // If user is authenticated, redirect to dashboard
    if (hasAuthTokens()) {
      router.push("/submissions");
    }
  }, [router]);

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="border-b">
        <div className="container flex h-14 items-center justify-between">
          <span className="font-bold text-lg">Colophony</span>
          <div className="flex items-center gap-2">
            <Link href="/login">
              <Button variant="ghost">Sign in</Button>
            </Link>
            <Link href="/register">
              <Button>Sign up</Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <main className="flex-1 flex items-center justify-center">
        <div className="container max-w-4xl py-12 text-center">
          <h1 className="text-4xl font-bold tracking-tight sm:text-6xl">
            Submissions Management Platform
          </h1>
          <p className="mt-6 text-lg text-muted-foreground max-w-2xl mx-auto">
            A modern platform for creative arts magazines to manage submissions,
            review content, and streamline the editorial workflow.
          </p>
          <div className="mt-10 flex items-center justify-center gap-4">
            <Link href="/register">
              <Button size="lg">Get Started</Button>
            </Link>
            <Link href="/login">
              <Button variant="outline" size="lg">
                Sign in
              </Button>
            </Link>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t py-6">
        <div className="container text-center text-sm text-muted-foreground">
          &copy; {new Date().getFullYear()} Colophony. All rights reserved.
        </div>
      </footer>
    </div>
  );
}
