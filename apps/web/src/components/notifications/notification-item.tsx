"use client";

import {
  FileText,
  CheckCircle2,
  XCircle,
  Undo2,
  FileSignature,
  PenTool,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";

const EVENT_ICONS: Record<string, React.ElementType> = {
  "submission.received": FileText,
  "submission.accepted": CheckCircle2,
  "submission.rejected": XCircle,
  "submission.withdrawn": Undo2,
  "contract.ready": FileSignature,
  "copyeditor.assigned": PenTool,
};

export interface InboxNotification {
  id: string;
  eventType: string;
  title: string;
  body: string | null;
  link: string | null;
  readAt: string | Date | null;
  createdAt: string | Date;
}

interface NotificationItemProps {
  notification: InboxNotification;
  onClick: (notification: InboxNotification) => void;
}

export function NotificationItem({
  notification,
  onClick,
}: NotificationItemProps) {
  const Icon = EVENT_ICONS[notification.eventType] ?? FileText;
  const isUnread = !notification.readAt;

  return (
    <button
      type="button"
      className={cn(
        "flex w-full items-start gap-3 rounded-md px-3 py-2 text-left transition-colors hover:bg-accent",
        isUnread && "bg-accent/50",
      )}
      onClick={() => onClick(notification)}
    >
      <Icon
        className={cn(
          "mt-0.5 h-4 w-4 shrink-0",
          isUnread ? "text-primary" : "text-muted-foreground",
        )}
      />
      <div className="flex-1 space-y-0.5 overflow-hidden">
        <p className={cn("truncate text-sm", isUnread && "font-medium")}>
          {notification.title}
        </p>
        {notification.body && (
          <p className="truncate text-xs text-muted-foreground">
            {notification.body}
          </p>
        )}
        <p className="text-xs text-muted-foreground">
          {formatDistanceToNow(new Date(notification.createdAt), {
            addSuffix: true,
          })}
        </p>
      </div>
      {isUnread && (
        <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-primary" />
      )}
    </button>
  );
}
