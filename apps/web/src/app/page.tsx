"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Toaster } from "@/components/ui/sonner";
import { getUserManager } from "@/lib/oidc";
import { LandingHeader } from "@/components/landing/landing-header";
import { LandingHero } from "@/components/landing/landing-hero";
import { LogotypeMorph } from "@/components/landing/logotype-morph";
import {
  LandingTwoSides,
  LandingDifferentiators,
} from "@/components/landing/landing-features";
import { LandingDeployment } from "@/components/landing/landing-deployment";
import { LandingDemoForm } from "@/components/landing/landing-demo-form";
import { LandingFooter } from "@/components/landing/landing-footer";

export default function Home() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const heroLogoRef = useRef<HTMLDivElement>(null);
  const headerLogoRef = useRef<HTMLDivElement>(null);

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
    return <div className="dark min-h-screen bg-background" />;
  }

  const handleSignIn = () => {
    const userManager = getUserManager();
    if (userManager) {
      void userManager.signinRedirect();
    }
  };

  const scrollToConsult = () => {
    document.getElementById("consult")?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <div className="dark min-h-screen scroll-smooth bg-background text-foreground animate-in fade-in duration-300">
      <LandingHeader onSignIn={handleSignIn} headerLogoRef={headerLogoRef} />
      <LogotypeMorph heroSlotRef={heroLogoRef} headerSlotRef={headerLogoRef} />
      <main>
        <LandingHero
          onRequestConsult={scrollToConsult}
          heroLogoRef={heroLogoRef}
        />
        <LandingTwoSides />
        <LandingDifferentiators />
        <LandingDeployment />
        <LandingDemoForm />
      </main>
      <LandingFooter />
      <Toaster theme="dark" />
    </div>
  );
}
