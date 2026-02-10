'use client';

import { ProtectedRoute } from '@/components/auth/protected-route';
import { Header } from '@/components/layout/header';
import { Sidebar } from '@/components/layout/sidebar';
import { Toaster } from '@/components/ui/sonner';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ProtectedRoute>
      <div className="min-h-screen flex flex-col">
        <Header />
        <div className="flex-1 flex">
          {/* Sidebar - hidden on mobile */}
          <aside className="hidden md:flex w-64 flex-col border-r">
            <Sidebar />
          </aside>

          {/* Main content */}
          <main className="flex-1 overflow-auto">
            <div className="container py-6">{children}</div>
          </main>
        </div>
        <Toaster />
      </div>
    </ProtectedRoute>
  );
}
