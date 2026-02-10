/**
 * Direct API client for test setup/teardown.
 * Uses fetch to call tRPC endpoints without going through the browser.
 */

const API_URL = process.env.API_URL || 'http://localhost:4000';

interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

interface TrpcSuccessResponse<T> {
  result: { data: T };
}

/**
 * Sleep for the given number of milliseconds.
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Call a tRPC mutation via POST with retry on 429 rate limiting.
 */
async function trpcMutation<T>(
  path: string,
  input?: unknown,
  headers?: Record<string, string>,
  maxRetries = 3,
): Promise<T> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const res = await fetch(`${API_URL}/trpc/${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
      body: input ? JSON.stringify(input) : undefined,
    });

    if (res.status === 429 && attempt < maxRetries) {
      const body = await res.json().catch(() => ({})) as { retryAfter?: number };
      const waitSec = body.retryAfter ?? (attempt + 1) * 2;
      await sleep(waitSec * 1000);
      continue;
    }

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`tRPC ${path} failed (${res.status}): ${body}`);
    }

    const body = (await res.json()) as TrpcSuccessResponse<T>;
    return body.result.data;
  }

  throw new Error(`tRPC ${path} failed after ${maxRetries} retries (rate limited)`);
}

/**
 * Call a tRPC query via GET.
 */
async function trpcQuery<T>(
  path: string,
  input?: unknown,
  headers?: Record<string, string>,
): Promise<T> {
  let url = `${API_URL}/trpc/${path}`;
  if (input !== undefined) {
    url += `?input=${encodeURIComponent(JSON.stringify(input))}`;
  }

  const res = await fetch(url, {
    headers: {
      ...headers,
    },
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`tRPC ${path} failed (${res.status}): ${body}`);
  }

  const body = (await res.json()) as TrpcSuccessResponse<T>;
  return body.result.data;
}

/**
 * Build authorization headers.
 */
export function authHeaders(
  accessToken: string,
  orgId?: string,
): Record<string, string> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${accessToken}`,
  };
  if (orgId) {
    headers['x-organization-id'] = orgId;
  }
  return headers;
}

/**
 * Register a new user via the API.
 */
export async function registerUser(input: {
  email: string;
  password: string;
  name?: string;
}): Promise<AuthTokens> {
  return trpcMutation<AuthTokens>('auth.register', input);
}

/**
 * Login a user via the API.
 */
export async function loginUser(input: {
  email: string;
  password: string;
}): Promise<AuthTokens> {
  return trpcMutation<AuthTokens>('auth.login', input);
}

/**
 * Get current user info via the API.
 */
export async function getMe(
  accessToken: string,
): Promise<{
  id: string;
  email: string;
  emailVerified: boolean;
  organizations: Array<{
    organization: { id: string; name: string; slug: string };
    role: string;
  }>;
}> {
  return trpcQuery('auth.me', undefined, authHeaders(accessToken));
}

/**
 * Create a submission via the API.
 */
export async function createSubmission(
  accessToken: string,
  orgId: string,
  input: { title: string; content?: string; coverLetter?: string },
): Promise<{ id: string; title: string; status: string }> {
  return trpcMutation(
    'submissions.create',
    input,
    authHeaders(accessToken, orgId),
  );
}

/**
 * Submit a submission for review via the API.
 */
export async function submitSubmission(
  accessToken: string,
  orgId: string,
  id: string,
): Promise<{ id: string; status: string }> {
  return trpcMutation(
    'submissions.submit',
    { id },
    authHeaders(accessToken, orgId),
  );
}

/**
 * Update submission status via the API (editor action).
 */
export async function updateSubmissionStatus(
  accessToken: string,
  orgId: string,
  id: string,
  status: string,
  comment?: string,
): Promise<unknown> {
  return trpcMutation(
    'submissions.updateStatus',
    { id, data: { status, comment } },
    authHeaders(accessToken, orgId),
  );
}
