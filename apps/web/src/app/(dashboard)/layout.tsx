"use client";

import { ProtectedRoute } from "@/components/auth/protected-route";
import { Header } from "@/components/layout/header";
import { Sidebar } from "@/components/layout/sidebar";
import { BreadcrumbBar } from "@/components/layout/breadcrumb-bar";
import { Toaster } from "@/components/ui/sonner";
import { DensityProvider } from "@/hooks/use-density";
import { CommandPaletteProvider } from "@/components/command-palette/command-palette";
import { TooltipProvider } from "@/components/ui/tooltip";
import { DemoBanner } from "@/components/demo/demo-banner";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ProtectedRoute>
      <DensityProvider density="comfortable">
        <TooltipProvider delayDuration={300}>
          <CommandPaletteProvider>
            <div className="min-h-screen flex flex-col">
              <a
                href="#main-content"
                className="sr-only focus:not-sr-only focus:absolute focus:z-[100] focus:top-2 focus:left-2 focus:bg-background focus:text-foreground focus:px-4 focus:py-2 focus:rounded-md focus:ring-2 focus:ring-ring"
              >
                Skip to main content
              </a>
              <DemoBanner />
              <Header />
              <div className="flex-1 flex">
                {/* Sidebar - hidden on mobile */}
                <aside className="hidden md:flex w-64 flex-col border-r border-sidebar-border">
                  <Sidebar />
                </aside>

                {/* Main content */}
                <main
                  id="main-content"
                  tabIndex={-1}
                  className="flex-1 overflow-auto"
                >
                  <BreadcrumbBar />
                  <div className="container py-6">{children}</div>
                </main>
              </div>
              <Toaster />
            </div>
          </CommandPaletteProvider>
        </TooltipProvider>
      </DensityProvider>
    </ProtectedRoute>
  );
}
