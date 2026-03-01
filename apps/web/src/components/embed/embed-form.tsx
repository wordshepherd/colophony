"use client";

import { useState, useEffect, useCallback } from "react";
import {
  fetchEmbedForm,
  submitEmbedForm,
  prepareEmbedUpload,
  type EmbedApiError,
} from "@/lib/embed-api";
import type {
  EmbedFormResponse,
  EmbedPrepareUploadResponse,
} from "@colophony/types";
import { EmbedThemeProvider } from "./embed-theme-provider";
import { EmbedIdentityStep } from "./embed-identity-step";
import { EmbedFormStep } from "./embed-form-step";
import { EmbedSuccess } from "./embed-success";
import { EmbedError } from "./embed-error";
import { Loader2 } from "lucide-react";

type EmbedStep =
  | "loading"
  | "identity"
  | "form"
  | "submitting"
  | "success"
  | "error";

interface EmbedState {
  step: EmbedStep;
  formData: EmbedFormResponse | null;
  identity: { email: string; name?: string } | null;
  uploadContext: EmbedPrepareUploadResponse | null;
  error: {
    type: "not_found" | "gone" | "rate_limited" | "validation" | "unknown";
    message: string;
    retryAfter?: number;
  } | null;
  submissionId: string | null;
  statusToken: string | null;
}

function mapErrorType(
  status: number,
): "not_found" | "gone" | "rate_limited" | "validation" | "unknown" {
  if (status === 404) return "not_found";
  if (status === 410) return "gone";
  if (status === 429) return "rate_limited";
  if (status === 400 || status === 422) return "validation";
  return "unknown";
}

interface EmbedFormProps {
  token: string;
  apiUrl: string;
}

export function EmbedForm({ token, apiUrl }: EmbedFormProps) {
  const [state, setState] = useState<EmbedState>({
    step: "loading",
    formData: null,
    identity: null,
    uploadContext: null,
    error: null,
    submissionId: null,
    statusToken: null,
  });

  const [identityLoading, setIdentityLoading] = useState(false);
  const [loadAttempt, setLoadAttempt] = useState(0);

  // Load form data on mount (and on retry)
  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const data = await fetchEmbedForm(apiUrl, token);
        if (!cancelled) {
          setState((prev) => ({
            ...prev,
            step: "identity",
            formData: data,
          }));
        }
      } catch (err) {
        if (cancelled) return;
        const apiErr = err as EmbedApiError;
        setState((prev) => ({
          ...prev,
          step: "error",
          error: {
            type: mapErrorType(apiErr.status ?? 500),
            message: apiErr.message ?? "Failed to load form",
            retryAfter: apiErr.retryAfter,
          },
        }));
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [apiUrl, token, loadAttempt]);

  // Handle identity continue — optionally prepare upload
  const handleIdentityContinue = useCallback(
    async (identity: { email: string; name?: string }) => {
      setIdentityLoading(true);

      const hasFileUpload = state.formData?.form?.fields.some(
        (f) => (f as { fieldType?: string }).fieldType === "file_upload",
      );

      try {
        let uploadContext: EmbedPrepareUploadResponse | null = null;

        if (hasFileUpload) {
          uploadContext = await prepareEmbedUpload(apiUrl, token, {
            email: identity.email,
            name: identity.name,
          });
        }

        setState((prev) => ({
          ...prev,
          step: "form",
          identity,
          uploadContext,
        }));
      } catch (err) {
        const apiErr = err as EmbedApiError;
        setState((prev) => ({
          ...prev,
          step: "error",
          error: {
            type: mapErrorType(apiErr.status ?? 500),
            message: apiErr.message ?? "Failed to prepare upload",
            retryAfter: apiErr.retryAfter,
          },
        }));
      } finally {
        setIdentityLoading(false);
      }
    },
    [apiUrl, token, state.formData],
  );

  // Handle form submission
  const handleFormSubmit = useCallback(
    async (data: {
      title: string;
      content?: string;
      coverLetter?: string;
      formData?: Record<string, unknown>;
      manuscriptVersionId?: string;
    }) => {
      if (!state.identity) return;

      setState((prev) => ({ ...prev, step: "submitting" }));

      try {
        const result = await submitEmbedForm(apiUrl, token, {
          email: state.identity.email,
          name: state.identity.name,
          title: data.title,
          content: data.content,
          coverLetter: data.coverLetter,
          formData: data.formData,
          manuscriptVersionId: data.manuscriptVersionId,
        });

        setState((prev) => ({
          ...prev,
          step: "success",
          submissionId: result.submissionId,
          statusToken: result.statusToken ?? null,
        }));
      } catch (err) {
        const apiErr = err as EmbedApiError;
        setState((prev) => ({
          ...prev,
          step: "error",
          error: {
            type: mapErrorType(apiErr.status ?? 500),
            message: apiErr.message ?? "Submission failed",
            retryAfter: apiErr.retryAfter,
          },
        }));
      }
    },
    [apiUrl, token, state.identity],
  );

  // Handle retry from error
  const handleRetry = useCallback(() => {
    setState((prev) => ({
      ...prev,
      step: prev.formData ? "identity" : "loading",
      error: null,
    }));
    // Increment to re-trigger the load effect when formData is null
    setLoadAttempt((n) => n + 1);
  }, []);

  return (
    <EmbedThemeProvider theme={state.formData?.theme ?? null}>
      <div className="max-w-2xl mx-auto p-4">
        {state.step === "loading" && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        )}

        {state.step === "identity" && state.formData && (
          <EmbedIdentityStep
            periodName={state.formData.period.name}
            onContinue={handleIdentityContinue}
            isLoading={identityLoading}
          />
        )}

        {(state.step === "form" || state.step === "submitting") &&
          state.formData?.form &&
          state.identity && (
            <EmbedFormStep
              formDefinition={state.formData.form}
              uploadContext={state.uploadContext}
              token={token}
              apiUrl={apiUrl}
              identity={state.identity}
              onSubmit={handleFormSubmit}
              isSubmitting={state.step === "submitting"}
            />
          )}

        {state.step === "success" && state.formData && state.submissionId && (
          <EmbedSuccess
            submissionId={state.submissionId}
            periodName={state.formData.period.name}
            statusToken={state.statusToken ?? undefined}
          />
        )}

        {state.step === "error" && state.error && (
          <EmbedError
            type={state.error.type}
            message={state.error.message}
            retryAfter={state.error.retryAfter}
            onRetry={handleRetry}
          />
        )}
      </div>
    </EmbedThemeProvider>
  );
}
