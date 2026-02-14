"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getUserManager } from "@/lib/oidc";

export default function AuthCallbackPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const userManager = getUserManager();
    if (!userManager) {
      setError("OIDC is not configured.");
      return;
    }

    userManager
      .signinRedirectCallback()
      .then(() => {
        // Redirect to stored returnTo path or dashboard
        const returnTo = sessionStorage.getItem("auth_return_to");
        sessionStorage.removeItem("auth_return_to");
        router.replace(returnTo || "/");
      })
      .catch((err: unknown) => {
        console.error("OIDC callback error:", err);
        setError(err instanceof Error ? err.message : "Authentication failed.");
      });
  }, [router]);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4 max-w-md">
          <h1 className="text-xl font-semibold">Authentication Error</h1>
          <p className="text-muted-foreground">{error}</p>
          <button
            onClick={() => {
              const userManager = getUserManager();
              if (userManager) {
                void userManager.signinRedirect();
              }
            }}
            className="text-primary hover:underline"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center space-y-2">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto" />
        <p className="text-muted-foreground">Completing sign in...</p>
      </div>
    </div>
  );
}
