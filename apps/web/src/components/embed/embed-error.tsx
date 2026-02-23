"use client";

import { useState, useEffect } from "react";
import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface EmbedErrorProps {
  type: "not_found" | "gone" | "rate_limited" | "validation" | "unknown";
  message: string;
  retryAfter?: number;
  onRetry?: () => void;
}

const errorMessages: Record<string, { title: string; description: string }> = {
  not_found: {
    title: "Invalid Link",
    description: "This submission link is not valid. Please check the URL.",
  },
  gone: {
    title: "Submissions Closed",
    description:
      "The submission period for this form has ended or the link has been revoked.",
  },
  rate_limited: {
    title: "Too Many Requests",
    description: "Please wait before trying again.",
  },
  validation: {
    title: "Submission Error",
    description: "There was a problem with your submission.",
  },
  unknown: {
    title: "Something Went Wrong",
    description: "An unexpected error occurred. Please try again.",
  },
};

export function EmbedError({
  type,
  message,
  retryAfter,
  onRetry,
}: EmbedErrorProps) {
  const [countdown, setCountdown] = useState(retryAfter ?? 0);

  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [countdown]);

  const config = errorMessages[type] ?? errorMessages.unknown;

  return (
    <div className="flex flex-col items-center text-center py-8 space-y-4">
      <AlertCircle className="h-16 w-16 text-destructive" />
      <div>
        <h2 className="text-xl font-semibold">{config.title}</h2>
        <p className="text-sm text-muted-foreground mt-2">
          {message || config.description}
        </p>
      </div>
      {onRetry && (type === "rate_limited" || type === "unknown") && (
        <Button onClick={onRetry} disabled={countdown > 0} variant="outline">
          {countdown > 0 ? `Retry in ${countdown}s` : "Try Again"}
        </Button>
      )}
    </div>
  );
}
