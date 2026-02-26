"use client";

import { Bell } from "lucide-react";
import { useOrganization } from "@/hooks/use-organization";
import { useNotificationStream } from "@/hooks/use-notification-stream";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { NotificationList } from "./notification-list";
import { useState } from "react";

export function NotificationBell() {
  const { currentOrg } = useOrganization();
  const [open, setOpen] = useState(false);

  useNotificationStream();

  const { data } = trpc.notifications.unreadCount.useQuery(undefined, {
    enabled: !!currentOrg,
    refetchInterval: 60_000,
  });

  if (!currentOrg) return null;

  const count = data?.count ?? 0;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {count > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-medium text-destructive-foreground">
              {count > 99 ? "99+" : count}
            </span>
          )}
          <span className="sr-only">
            {count > 0
              ? `${count} unread notification${count === 1 ? "" : "s"}`
              : "Notifications"}
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <NotificationList onClose={() => setOpen(false)} />
      </PopoverContent>
    </Popover>
  );
}
