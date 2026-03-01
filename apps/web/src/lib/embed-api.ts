import type {
  EmbedFormResponse,
  EmbedSubmitInput,
  EmbedSubmitResponse,
  EmbedPrepareUploadResponse,
  EmbedUploadStatusResponse,
  EmbedStatusCheckResponse,
} from "@colophony/types";

export interface EmbedApiError {
  status: number;
  error: string;
  message: string;
  details?: Array<{ path: string; message: string }>;
  retryAfter?: number;
}

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => ({
      error: res.statusText,
      message: res.statusText,
    }));
    const err: EmbedApiError = {
      status: res.status,
      error: body.error ?? res.statusText,
      message: body.message ?? res.statusText,
      details: body.details,
    };
    if (res.status === 429) {
      const retryAfter = res.headers.get("Retry-After");
      if (retryAfter) {
        err.retryAfter = parseInt(retryAfter, 10);
      }
    }
    throw err;
  }
  return res.json() as Promise<T>;
}

export async function fetchEmbedForm(
  apiUrl: string,
  token: string,
): Promise<EmbedFormResponse> {
  const res = await fetch(`${apiUrl}/embed/${token}`, {
    headers: { Accept: "application/json" },
  });
  return handleResponse<EmbedFormResponse>(res);
}

export async function submitEmbedForm(
  apiUrl: string,
  token: string,
  body: EmbedSubmitInput,
): Promise<EmbedSubmitResponse> {
  const res = await fetch(`${apiUrl}/embed/${token}/submit`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(body),
  });
  return handleResponse(res);
}

export async function prepareEmbedUpload(
  apiUrl: string,
  token: string,
  body: { email: string; name?: string },
): Promise<EmbedPrepareUploadResponse> {
  const res = await fetch(`${apiUrl}/embed/${token}/prepare-upload`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(body),
  });
  return handleResponse<EmbedPrepareUploadResponse>(res);
}

export async function fetchUploadStatus(
  apiUrl: string,
  token: string,
  manuscriptVersionId: string,
  email: string,
): Promise<EmbedUploadStatusResponse> {
  const params = new URLSearchParams({ email });
  const res = await fetch(
    `${apiUrl}/embed/${token}/upload-status/${manuscriptVersionId}?${params}`,
    {
      headers: { Accept: "application/json" },
    },
  );
  return handleResponse<EmbedUploadStatusResponse>(res);
}

export async function fetchSubmissionStatus(
  apiUrl: string,
  statusToken: string,
): Promise<EmbedStatusCheckResponse> {
  const res = await fetch(`${apiUrl}/embed/status/${statusToken}`, {
    headers: { Accept: "application/json" },
  });
  return handleResponse<EmbedStatusCheckResponse>(res);
}
