"use client";

import { useState, useEffect } from "react";
import { fetchSubmissionStatus, type EmbedApiError } from "@/lib/embed-api";
import type { EmbedStatusCheckResponse } from "@colophony/types";
import {
  Loader2,
  CheckCircle,
  XCircle,
  Clock,
  AlertCircle,
} from "lucide-react";

type ViewState = "loading" | "loaded" | "not_found" | "token_expired" | "error";

const STATUS_ICONS: Record<string, typeof CheckCircle> = {
  Accepted: CheckCircle,
  "Not Accepted": XCircle,
  Withdrawn: AlertCircle,
};

const STATUS_COLORS: Record<string, string> = {
  "Under Review": "bg-yellow-100 text-yellow-800",
  Accepted: "bg-green-100 text-green-800",
  "Not Accepted": "bg-red-100 text-red-800",
  Withdrawn: "bg-gray-100 text-gray-800",
  "Revision Requested": "bg-blue-100 text-blue-800",
};

interface EmbedStatusCheckProps {
  statusToken: string;
  apiUrl: string;
}

export function EmbedStatusCheck({
  statusToken,
  apiUrl,
}: EmbedStatusCheckProps) {
  const [viewState, setViewState] = useState<ViewState>("loading");
  const [data, setData] = useState<EmbedStatusCheckResponse | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const result = await fetchSubmissionStatus(apiUrl, statusToken);
        if (!cancelled) {
          setData(result);
          setViewState("loaded");
        }
      } catch (err) {
        if (cancelled) return;
        const apiErr = err as EmbedApiError;
        if (apiErr.status === 410) {
          setViewState("token_expired");
        } else if (apiErr.status === 404) {
          setViewState("not_found");
        } else {
          setViewState("error");
        }
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [apiUrl, statusToken]);

  if (viewState === "loading") {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (viewState === "not_found") {
    return (
      <div className="max-w-md mx-auto text-center py-16 px-4">
        <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
        <h2 className="text-lg font-semibold">Submission Not Found</h2>
        <p className="text-sm text-muted-foreground mt-2">
          This status link is invalid or has expired.
        </p>
      </div>
    );
  }

  if (viewState === "token_expired") {
    return (
      <div className="max-w-md mx-auto text-center py-16 px-4">
        <Clock className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
        <h2 className="text-lg font-semibold">Status Link Expired</h2>
        <p className="text-sm text-muted-foreground mt-2">
          This status link has expired. Please contact the publication directly
          for an update on your submission.
        </p>
      </div>
    );
  }

  if (viewState === "error") {
    return (
      <div className="max-w-md mx-auto text-center py-16 px-4">
        <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
        <h2 className="text-lg font-semibold">Something Went Wrong</h2>
        <p className="text-sm text-muted-foreground mt-2">
          Unable to load submission status. Please try again later.
        </p>
      </div>
    );
  }

  if (!data) return null;

  const StatusIcon = STATUS_ICONS[data.status] ?? Clock;
  const statusColor =
    STATUS_COLORS[data.status] ?? "bg-yellow-100 text-yellow-800";

  return (
    <div className="max-w-md mx-auto py-12 px-4">
      <div className="border rounded-lg p-6 space-y-4">
        <div className="text-center">
          <p className="text-sm text-muted-foreground">
            {data.organizationName}
          </p>
          <h2 className="text-lg font-semibold mt-1">Submission Status</h2>
        </div>

        <div className="space-y-3">
          {data.title && (
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide">
                Title
              </p>
              <p className="font-medium">{data.title}</p>
            </div>
          )}

          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wide">
              Status
            </p>
            <div className="flex items-center gap-2 mt-1">
              <StatusIcon className="h-4 w-4" />
              <span
                className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium ${statusColor}`}
              >
                {data.status}
              </span>
            </div>
          </div>

          {data.periodName && (
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide">
                Submission Period
              </p>
              <p className="text-sm">{data.periodName}</p>
            </div>
          )}

          {data.submittedAt && (
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide">
                Submitted
              </p>
              <p className="text-sm">
                {new Date(data.submittedAt).toLocaleDateString(undefined, {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
