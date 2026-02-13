# Colophony Web — Next.js Frontend

## Key Paths

| What           | Path                                      |
| -------------- | ----------------------------------------- |
| tRPC client    | `src/lib/trpc.ts`                         |
| Auth utilities | `src/lib/auth.ts`                         |
| Root providers | `src/components/providers.tsx`            |
| ProtectedRoute | `src/components/auth/protected-route.tsx` |
| Hooks          | `src/hooks/`                              |
| Components     | `src/components/`                         |

---

## tRPC Client (`src/lib/trpc.ts`)

```typescript
export const trpc = createTRPCReact<AppRouter>();
```

- `AppRouter` type imported via source path alias: `@colophony/api/trpc/router` (bundler resolution, not `.d.ts`)
- `httpBatchLink` to `${NEXT_PUBLIC_API_URL}/trpc`
- Headers: `Authorization: Bearer <token>` + `x-organization-id` from localStorage
- `credentials: "include"` on fetch

---

## Providers (`src/components/providers.tsx`)

`trpc.Provider` + `QueryClientProvider` wrapping the app. Must have `"use client"` directive.

QueryClient defaults:

- `staleTime`: 60s (avoids immediate refetch after SSR)
- `retry`: 1

---

## Auth Utilities (`src/lib/auth.ts`)

Token storage via `STORAGE_KEYS` constants (defined in `trpc.ts`):

- `accessToken`, `refreshToken`, `tokenExpiresAt`, `currentOrgId`

Key functions:

- `setAuthTokens(accessToken, refreshToken, expiresIn)` — stores tokens + calculates expiry
- `clearAuthData()` — removes all auth keys from localStorage
- `hasAuthTokens()` — checks if access token exists
- `isTokenExpiringSoon()` — true if within 1 minute of expiry
- `getAccessToken()`, `getCurrentOrgId()`, `setCurrentOrgId()` — in `trpc.ts`

---

## Conventions

- **`"use client"` directive** — required on all components using hooks, state, or browser APIs
- **shadcn/ui** — New York style variant. Import from `@/components/ui/`
- **ProtectedRoute** — wraps auth-required pages (`src/components/auth/protected-route.tsx`)
- **Org context** — `x-organization-id` header sent on every tRPC request from `getCurrentOrgId()`

---

## API Response Patterns

- **Paginated lists:** `{ items, total, page, limit, totalPages }`
- **Status transitions:** use defined allowed-transition maps

---

## Quirks

| Quirk                             | Details                                                                                                      |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| **TanStack Query v4 `isLoading`** | `isLoading` is `true` even when query is disabled (`enabled: false`). Check `fetchStatus !== 'idle'` instead |

## Version Pins

| Package        | Pinned | Notes                              |
| -------------- | ------ | ---------------------------------- |
| TanStack Query | 4.36   | `isLoading` behavior changes in v5 |
| tus-js-client  | 4.3.1  | —                                  |
