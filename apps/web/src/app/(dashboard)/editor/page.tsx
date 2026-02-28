import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { BarChart3, ClipboardList, Inbox } from "lucide-react";
import { DashboardPluginSlot } from "./dashboard-plugin-slot";
import { OverviewStatsCards } from "@/components/analytics/overview-stats-cards";

export default function EditorPage() {
  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Editor Dashboard</h1>
        <p className="text-muted-foreground mt-1">
          Manage your publication&apos;s submission process.
        </p>
      </div>

      <OverviewStatsCards />

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Link href="/editor/submissions">
          <Card className="hover:border-primary/50 transition-colors cursor-pointer">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-primary/10 p-2">
                  <Inbox className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-base">Submissions</CardTitle>
                  <CardDescription>
                    Review and manage incoming submissions
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Button variant="outline" size="sm" className="w-full">
                View Queue
              </Button>
            </CardContent>
          </Card>
        </Link>

        <Link href="/editor/forms">
          <Card className="hover:border-primary/50 transition-colors cursor-pointer">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-primary/10 p-2">
                  <ClipboardList className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-base">Forms</CardTitle>
                  <CardDescription>
                    Build and manage submission forms
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Button variant="outline" size="sm" className="w-full">
                Manage Forms
              </Button>
            </CardContent>
          </Card>
        </Link>

        <Link href="/editor/analytics">
          <Card className="hover:border-primary/50 transition-colors cursor-pointer">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-primary/10 p-2">
                  <BarChart3 className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-base">Analytics</CardTitle>
                  <CardDescription>
                    Submission trends and performance metrics
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Button variant="outline" size="sm" className="w-full">
                View Analytics
              </Button>
            </CardContent>
          </Card>
        </Link>
      </div>

      <DashboardPluginSlot />
    </div>
  );
}
