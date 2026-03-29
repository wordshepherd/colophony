"use client";

import Link from "next/link";
import { Users, FileCheck, DollarSign } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BusinessDashboardCards } from "./business-dashboard-cards";

// ---------------------------------------------------------------------------
// Quick links
// ---------------------------------------------------------------------------

const quickLinks = [
  {
    title: "Contributors",
    description: "Manage authors, translators, and creative contributors.",
    href: "/business/contributors",
    icon: Users,
  },
  {
    title: "Rights Agreements",
    description: "Track IP rights, reversion dates, and agreement status.",
    href: "/business/rights",
    icon: FileCheck,
  },
  {
    title: "Payments",
    description: "View payment transactions, fees, and revenue.",
    href: "/business/payments",
    icon: DollarSign,
  },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function BusinessDashboard() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Business Operations</h1>
        <p className="text-sm text-muted-foreground">
          Contributor management, rights agreements, and payment tracking.
        </p>
      </div>

      {/* Health card grid */}
      <BusinessDashboardCards />

      {/* Quick links */}
      <section>
        <h2 className="mb-3 text-sm font-medium text-muted-foreground">
          Quick Links
        </h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {quickLinks.map((link) => (
            <Card key={link.href} className="transition-colors hover:bg-accent">
              <Link href={link.href} className="block">
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-2">
                    <link.icon className="h-4 w-4 text-muted-foreground" />
                    <CardTitle className="text-sm">{link.title}</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-muted-foreground">
                    {link.description}
                  </p>
                </CardContent>
              </Link>
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
}
