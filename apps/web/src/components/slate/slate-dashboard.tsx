"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Library,
  GitBranch,
  BookCopy,
  Calendar,
  FileSignature,
  Globe,
} from "lucide-react";

const sections = [
  {
    name: "Publications",
    description: "Manage your publications and their settings",
    href: "/slate/publications",
    icon: Library,
    cta: "View Publications",
    comingSoon: false,
  },
  {
    name: "Pipeline",
    description: "Track pieces through the editorial pipeline",
    href: "/slate/pipeline",
    icon: GitBranch,
    cta: "View Pipeline",
    comingSoon: false,
  },
  {
    name: "Issues",
    description: "Assemble and organize publication issues",
    href: "/slate/issues",
    icon: BookCopy,
    cta: "View Issues",
    comingSoon: false,
  },
  {
    name: "Calendar",
    description: "Plan your editorial calendar and deadlines",
    href: "/slate/calendar",
    icon: Calendar,
    cta: "View Calendar",
    comingSoon: false,
  },
  {
    name: "Contracts",
    description: "Manage contributor contracts and templates",
    href: "/slate/contracts",
    icon: FileSignature,
    cta: "View Contracts",
    comingSoon: false,
  },
  {
    name: "CMS Connections",
    description: "Connect to external content management systems",
    href: "/slate/cms",
    icon: Globe,
    cta: "View Connections",
    comingSoon: false,
  },
];

export function SlateDashboard() {
  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Slate</h1>
        <p className="text-muted-foreground mt-1">
          Manage your publication pipeline — from accepted pieces to published
          issues.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {sections.map((section) => {
          const content = (
            <Card
              className={`transition-colors ${section.comingSoon ? "opacity-60" : "hover:border-primary/50 cursor-pointer"}`}
            >
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-primary/10 p-2">
                    <section.icon className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <CardTitle className="text-base">
                        {section.name}
                      </CardTitle>
                      {section.comingSoon && (
                        <Badge variant="secondary" className="text-xs">
                          Coming Soon
                        </Badge>
                      )}
                    </div>
                    <CardDescription>{section.description}</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  disabled={section.comingSoon}
                >
                  {section.cta}
                </Button>
              </CardContent>
            </Card>
          );

          if (section.comingSoon) {
            return <div key={section.name}>{content}</div>;
          }

          return (
            <Link key={section.name} href={section.href}>
              {content}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
