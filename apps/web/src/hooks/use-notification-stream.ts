"use client";

import { useEffect, useRef } from "react";
import { getAccessToken, getCurrentOrgId, trpc } from "@/lib/trpc";
import { useOrganization } from "./use-organization";

function getBaseUrl() {
  return process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
}

export function useNotificationStream(): void {
  const { currentOrg } = useOrganization();
  const utils = trpc.useUtils();
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!currentOrg) return;

    let cancelled = false;
    let reconnectTimeout: ReturnType<typeof setTimeout>;

    async function connect() {
      const token = await getAccessToken();
      const orgId = getCurrentOrgId();
      if (!token || !orgId || cancelled) return;

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const response = await fetch(
          `${getBaseUrl()}/api/notifications/stream`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
              "x-organization-id": orgId,
            },
            signal: controller.signal,
          },
        );

        if (!response.ok || !response.body) return;

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (!cancelled) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          let currentEvent = "";
          for (const line of lines) {
            if (line.startsWith("event: ")) {
              currentEvent = line.slice(7).trim();
            } else if (
              line.startsWith("data: ") &&
              currentEvent === "notification"
            ) {
              void utils.notifications.unreadCount.invalidate();
              void utils.notifications.list.invalidate();
              currentEvent = "";
            }
          }
        }
      } catch {
        // AbortError is expected on unmount/reconnect
      }

      // Reconnect with backoff
      if (!cancelled) {
        reconnectTimeout = setTimeout(connect, 5000);
      }
    }

    void connect();

    return () => {
      cancelled = true;
      clearTimeout(reconnectTimeout);
      abortRef.current?.abort();
      abortRef.current = null;
    };
  }, [currentOrg?.id, utils]);
}
