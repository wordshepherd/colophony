"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Toaster } from "@/components/ui/sonner";
import { getUserManager } from "@/lib/oidc";
import { LandingHeader } from "@/components/landing/landing-header";
import { LandingHero } from "@/components/landing/landing-hero";
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

  const scrollToDemo = () => {
    document.getElementById("demo")?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <div className="dark min-h-screen scroll-smooth bg-background text-foreground">
      <LandingHeader onSignIn={handleSignIn} />
      <main>
        <LandingHero onRequestDemo={scrollToDemo} />
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
