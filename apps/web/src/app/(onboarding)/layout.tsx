"use client";

import { ProtectedRoute } from "@/components/auth/protected-route";
import { Toaster } from "@/components/ui/sonner";

export default function OnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ProtectedRoute requireOrganization={false}>
      <div className="min-h-screen flex items-center justify-center p-4">
        {children}
      </div>
      <Toaster />
    </ProtectedRoute>
  );
}
