# Colophony Web — Next.js Frontend

## Key Paths

| What           | Path                                      |
| -------------- | ----------------------------------------- |
| tRPC client    | `src/lib/trpc.ts`                         |
| OIDC client    | `src/lib/oidc.ts`                         |
| Root providers | `src/components/providers.tsx`            |
| ProtectedRoute | `src/components/auth/protected-route.tsx` |
| Hooks          | `src/hooks/`                              |
| Components     | `src/components/`                         |

---

## tRPC Client (`src/lib/trpc.ts`)

```typescript
export const trpc = createTRPCReact<AppRouter>();
```

- `AppRouter` type imported via source path alias: `@colophony/api/trpc/client-types` (bundler resolution, not `.d.ts`). This is the only allowed import from `@colophony/api` — enforced by ESLint `no-restricted-imports`
- `httpBatchLink` to `${NEXT_PUBLIC_API_URL}/trpc`
- Headers: `Authorization: Bearer <token>` + `x-organization-id` from localStorage
- Token sourced from `oidc-client-ts` `UserManager` (async `getUser()`)
- `credentials: "include"` on fetch

---

## Providers (`src/components/providers.tsx`)

`trpc.Provider` + `QueryClientProvider` wrapping the app. Must have `"use client"` directive.

QueryClient defaults:

- `staleTime`: 60s (avoids immediate refetch after SSR)
- `retry`: 1

---

## OIDC Client (`src/lib/oidc.ts`)

Zitadel OIDC Authorization Code flow with PKCE via `oidc-client-ts`:

- `getUserManager()` — returns singleton `UserManager` (SSR-safe, returns `null` on server)
- Config from `NEXT_PUBLIC_ZITADEL_AUTHORITY` and `NEXT_PUBLIC_ZITADEL_CLIENT_ID` env vars
- `automaticSilentRenew: true` — uses refresh tokens from `offline_access` scope
- Callback page: `src/app/auth/callback/page.tsx`

Key functions in `trpc.ts`:

- `getAccessToken()` — async, reads from OIDC user manager
- `getCurrentOrgId()`, `setCurrentOrgId()` — localStorage for org context

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

| Quirk                              | Details                                                                                                                                                                                                      |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **TanStack Query v5 `isPending`**  | TQ5 renamed `isLoading` to `isPending`. Use `isPending: isLoading` alias pattern in destructuring to minimize downstream changes. TQ5 also fixed the disabled-query bug (no `fetchStatus` workaround needed) |
| **Next.js 16 async params**        | Next.js 16 types require `params: Promise<>`. In server components use `await params`; in client components use `use(params)` (React 19 exports `use()`)                                                     |
| **React 19 deferred deprecations** | `forwardRef` (19 shadcn/ui components) and `Context.Provider` still work in React 19 but are deprecated. Migrate when updating shadcn/ui components                                                          |

## Version Pins

| Package        | Pinned | Notes                 |
| -------------- | ------ | --------------------- |
| TanStack Query | 5.x    | Upgraded with tRPC 11 |
| tus-js-client  | 4.3.1  | —                     |
