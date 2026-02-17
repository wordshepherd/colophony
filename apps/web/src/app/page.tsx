"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getUserManager } from "@/lib/oidc";
import { Button } from "@/components/ui/button";

export default function Home() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const userManager = getUserManager();
    if (!userManager) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- sync guard, fires once before any async work
      setChecking(false);
      return;
    }

    userManager
      .getUser()
      .then((user) => {
        if (user && !user.expired) {
          router.push("/submissions");
        } else {
          setChecking(false);
        }
      })
      .catch(() => {
        setChecking(false);
      });
  }, [router]);

  if (checking) {
    return null;
  }

  const handleSignIn = () => {
    const userManager = getUserManager();
    if (userManager) {
      void userManager.signinRedirect();
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="border-b">
        <div className="container flex h-14 items-center justify-between">
          <span className="font-bold text-lg">Colophony</span>
          <Button variant="ghost" onClick={handleSignIn}>
            Sign in
          </Button>
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
            <Button size="lg" onClick={handleSignIn}>
              Get Started
            </Button>
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
