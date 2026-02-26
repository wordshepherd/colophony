"use client";

import { useOrganization } from "@/hooks/use-organization";
import { trpc } from "@/lib/trpc";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Bell, AlertCircle } from "lucide-react";
import type { NotificationEventType } from "@colophony/types";

interface EventConfig {
  eventType: NotificationEventType;
  label: string;
  description: string;
}

const SUBMISSION_EVENTS: EventConfig[] = [
  {
    eventType: "submission.received",
    label: "Submission Received",
    description: "When a new submission is received",
  },
  {
    eventType: "submission.accepted",
    label: "Submission Accepted",
    description: "When your submission is accepted",
  },
  {
    eventType: "submission.rejected",
    label: "Submission Rejected",
    description: "When your submission is rejected",
  },
  {
    eventType: "submission.withdrawn",
    label: "Submission Withdrawn",
    description: "When a submission is withdrawn",
  },
];

const SLATE_EVENTS: EventConfig[] = [
  {
    eventType: "contract.ready",
    label: "Contract Ready",
    description: "When a contract is ready for signing",
  },
  {
    eventType: "copyeditor.assigned",
    label: "Copyeditor Assigned",
    description: "When you are assigned as copyeditor",
  },
];

type NotificationChannel = "email" | "in_app";

function deriveEnabled(
  preferences:
    | Array<{ eventType: string; channel: string; enabled: boolean }>
    | undefined,
  eventType: NotificationEventType,
  channel: NotificationChannel,
): boolean {
  if (!preferences) return true;
  const record = preferences.find(
    (p) => p.eventType === eventType && p.channel === channel,
  );
  return record ? record.enabled : true;
}

export function NotificationPreferencesCard() {
  const { currentOrg } = useOrganization();
  const {
    data: preferences,
    isPending,
    error,
    refetch,
  } = trpc.notificationPreferences.list.useQuery(undefined, {
    enabled: !!currentOrg,
  });
  const utils = trpc.useUtils();

  const upsertMutation = trpc.notificationPreferences.upsert.useMutation({
    onSuccess: () => {
      void utils.notificationPreferences.list.invalidate();
      toast.success("Notification preference updated");
    },
    onError: (err) => {
      toast.error(err.message || "Failed to update preference");
    },
  });

  function handleToggle(
    eventType: NotificationEventType,
    channel: NotificationChannel,
    currentEnabled: boolean,
  ) {
    upsertMutation.mutate({
      channel,
      eventType,
      enabled: !currentEnabled,
    });
  }

  if (!currentOrg) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Notification Preferences
          </CardTitle>
          <CardDescription>
            Select an organization to manage notification preferences.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bell className="h-5 w-5" />
          Notification Preferences
        </CardTitle>
        <CardDescription>
          Manage notifications for {currentOrg.name}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isPending ? (
          <div className="space-y-4" data-testid="notification-prefs-skeleton">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex items-center justify-between">
                <div className="space-y-1">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-48" />
                </div>
                <div className="flex gap-4">
                  <Skeleton className="h-5 w-9 rounded-full" />
                  <Skeleton className="h-5 w-9 rounded-full" />
                </div>
              </div>
            ))}
          </div>
        ) : error ? (
          <div role="alert" className="flex items-center gap-3 text-sm">
            <AlertCircle className="h-4 w-4 text-destructive" />
            <span className="text-destructive">
              Failed to load preferences: {error.message}
            </span>
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              Try again
            </Button>
          </div>
        ) : (
          <div className="space-y-6">
            <EventGroup
              title="Submissions"
              events={SUBMISSION_EVENTS}
              preferences={preferences}
              onToggle={handleToggle}
              disabled={upsertMutation.isPending}
            />
            <Separator />
            <EventGroup
              title="Publication Pipeline"
              events={SLATE_EVENTS}
              preferences={preferences}
              onToggle={handleToggle}
              disabled={upsertMutation.isPending}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function EventGroup({
  title,
  events,
  preferences,
  onToggle,
  disabled,
}: {
  title: string;
  events: EventConfig[];
  preferences:
    | Array<{ eventType: string; channel: string; enabled: boolean }>
    | undefined;
  onToggle: (
    eventType: NotificationEventType,
    channel: NotificationChannel,
    currentEnabled: boolean,
  ) => void;
  disabled: boolean;
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium">{title}</h4>
        <div className="flex gap-4 text-xs text-muted-foreground">
          <span className="w-9 text-center">Email</span>
          <span className="w-9 text-center">In-App</span>
        </div>
      </div>
      {events.map((event) => {
        const emailEnabled = deriveEnabled(
          preferences,
          event.eventType,
          "email",
        );
        const inAppEnabled = deriveEnabled(
          preferences,
          event.eventType,
          "in_app",
        );
        return (
          <div
            key={event.eventType}
            className="flex items-center justify-between"
          >
            <div className="space-y-0.5">
              <p className="text-sm font-medium">{event.label}</p>
              <p className="text-xs text-muted-foreground">
                {event.description}
              </p>
            </div>
            <div className="flex gap-4">
              <Switch
                checked={emailEnabled}
                onCheckedChange={() =>
                  onToggle(event.eventType, "email", emailEnabled)
                }
                disabled={disabled}
                aria-label={`Toggle ${event.label} email notifications`}
              />
              <Switch
                checked={inAppEnabled}
                onCheckedChange={() =>
                  onToggle(event.eventType, "in_app", inAppEnabled)
                }
                disabled={disabled}
                aria-label={`Toggle ${event.label} in-app notifications`}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
