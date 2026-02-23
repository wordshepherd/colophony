"use client";

import { useState, useEffect, useRef } from "react";
import { fetchUploadStatus, type EmbedApiError } from "@/lib/embed-api";
import type { EmbedUploadStatusResponse } from "@colophony/types";

const BASE_POLL_INTERVAL = 3000;

interface UseEmbedUploadStatusOptions {
  apiUrl: string;
  token: string;
  manuscriptVersionId: string | null;
  email: string;
  enabled: boolean;
  uploadsInFlight: boolean;
}

function isTerminalStatus(status: string): boolean {
  return status === "CLEAN" || status === "INFECTED" || status === "FAILED";
}

export function useEmbedUploadStatus({
  apiUrl,
  token,
  manuscriptVersionId,
  email,
  enabled,
  uploadsInFlight,
}: UseEmbedUploadStatusOptions) {
  const [files, setFiles] = useState<EmbedUploadStatusResponse["files"]>([]);
  const [allClean, setAllClean] = useState(false);
  const [isPolling, setIsPolling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollIntervalMs = useRef(BASE_POLL_INTERVAL);

  useEffect(() => {
    if (!enabled || !manuscriptVersionId) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      setIsPolling(false);
      return;
    }

    let cancelled = false;

    async function doPoll() {
      if (cancelled || !manuscriptVersionId) return;

      try {
        const result = await fetchUploadStatus(
          apiUrl,
          token,
          manuscriptVersionId,
          email,
        );
        if (cancelled) return;

        setFiles(result.files);
        setAllClean(result.allClean);
        setError(null);

        // Reset interval to base rate after successful poll (recovers from 429 backoff)
        if (pollIntervalMs.current !== BASE_POLL_INTERVAL) {
          pollIntervalMs.current = BASE_POLL_INTERVAL;
          if (intervalRef.current) {
            clearInterval(intervalRef.current);
          }
          intervalRef.current = setInterval(doPoll, BASE_POLL_INTERVAL);
        }

        // Stop polling when no uploads in flight AND all files are in terminal state
        const allTerminal =
          result.files.length > 0 &&
          result.files.every((f) => isTerminalStatus(f.scanStatus));
        if (!uploadsInFlight && allTerminal) {
          if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
          }
          setIsPolling(false);
        }
      } catch (err) {
        if (cancelled) return;

        const apiErr = err as EmbedApiError;
        if (apiErr.status === 429 && apiErr.retryAfter) {
          // Back off on rate limit — restart interval with longer delay
          pollIntervalMs.current = apiErr.retryAfter * 1000;
          if (intervalRef.current) {
            clearInterval(intervalRef.current);
          }
          intervalRef.current = setInterval(doPoll, pollIntervalMs.current);
        } else {
          setError(apiErr.message ?? "Failed to check upload status");
        }
      }
    }

    // Initial poll
    doPoll();

    // Set up interval
    intervalRef.current = setInterval(doPoll, pollIntervalMs.current);
    setIsPolling(true);

    return () => {
      cancelled = true;
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      setIsPolling(false);
    };
  }, [enabled, manuscriptVersionId, apiUrl, token, email, uploadsInFlight]);

  return { files, allClean, isPolling, error };
}
