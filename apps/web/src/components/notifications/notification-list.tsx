"use client";

import { useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Loader2, Inbox } from "lucide-react";
import { NotificationItem, type InboxNotification } from "./notification-item";

interface NotificationListProps {
  onClose?: () => void;
}

export function NotificationList({ onClose }: NotificationListProps) {
  const router = useRouter();
  const utils = trpc.useUtils();

  const { data, isPending } = trpc.notifications.list.useQuery({
    unreadOnly: false,
    page: 1,
    limit: 20,
  });

  const markReadMutation = trpc.notifications.markRead.useMutation({
    onSuccess: () => {
      void utils.notifications.unreadCount.invalidate();
      void utils.notifications.list.invalidate();
    },
  });

  const markAllReadMutation = trpc.notifications.markAllRead.useMutation({
    onSuccess: () => {
      void utils.notifications.unreadCount.invalidate();
      void utils.notifications.list.invalidate();
    },
  });

  function handleClick(notification: InboxNotification) {
    if (!notification.readAt) {
      markReadMutation.mutate({ id: notification.id });
    }
    if (notification.link) {
      router.push(notification.link);
    }
    onClose?.();
  }

  if (isPending) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!data?.items.length) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-8 text-muted-foreground">
        <Inbox className="h-8 w-8" />
        <p className="text-sm">No notifications</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      <div className="flex items-center justify-between border-b px-3 py-2">
        <span className="text-sm font-medium">Notifications</span>
        <Button
          variant="ghost"
          size="sm"
          className="h-auto px-2 py-1 text-xs"
          onClick={() => markAllReadMutation.mutate()}
          disabled={markAllReadMutation.isPending}
        >
          Mark all read
        </Button>
      </div>
      <div className="max-h-[400px] overflow-y-auto">
        {data.items.map((notification) => (
          <NotificationItem
            key={notification.id}
            notification={notification}
            onClick={handleClick}
          />
        ))}
      </div>
    </div>
  );
}
