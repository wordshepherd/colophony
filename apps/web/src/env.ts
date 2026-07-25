import { z } from "zod";

/**
 * Validated environment for the web app, mirroring `apps/api/src/config/env.ts`.
 *
 * Two rules govern this file:
 *
 * 1. **Every `process.env.NEXT_PUBLIC_*` read must be written as a full static
 *    literal.** Next.js replaces these textually at build time. `process.env[name]`
 *    or destructuring `const { NEXT_PUBLIC_API_URL } = process.env` defeats the
 *    substitution and yields `undefined` in the browser. That is why the client
 *    block below is verbose rather than looped.
 *
 * 2. **Client and server are separate.** Only `NEXT_PUBLIC_*` values are inlined
 *    into the browser bundle. Server-only values are read lazily so importing this
 *    module from a client component cannot leak them.
 *
 * Import from `next.config.ts` means an invalid environment fails `next build`
 * rather than surfacing as a runtime error in someone's browser.
 */

const SKIP =
  process.env.SKIP_ENV_VALIDATION === "1" ||
  process.env.SKIP_ENV_VALIDATION === "true";

const clientSchema = z.object({
  NEXT_PUBLIC_API_URL: z.string().url().default("http://localhost:4000"),
  NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:3000"),
  NEXT_PUBLIC_TUS_URL: z.string().url().default("http://localhost:1080/files/"),
  NEXT_PUBLIC_ZITADEL_AUTHORITY: z.string().url().optional(),
  NEXT_PUBLIC_ZITADEL_CLIENT_ID: z.string().min(1).optional(),
  NEXT_PUBLIC_SENTRY_DSN: z.string().url().optional().or(z.literal("")),
  NEXT_PUBLIC_SENTRY_ENVIRONMENT: z.string().min(1).default("development"),
  NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE: z.coerce
    .number()
    .min(0)
    .max(1)
    .default(0),
});

const serverSchema = z.object({
  // SSR-side base URL for tRPC. Distinct from NEXT_PUBLIC_API_URL so server
  // rendering can reach the API over an internal address.
  API_URL: z.string().url().default("http://localhost:4000"),
  SENTRY_DSN: z.string().url().optional().or(z.literal("")),
  SENTRY_ENVIRONMENT: z.string().min(1).default("development"),
  SENTRY_TRACES_SAMPLE_RATE: z.coerce.number().min(0).max(1).default(0),
  // Build-time only: used by @sentry/nextjs for sourcemap upload.
  SENTRY_AUTH_TOKEN: z.string().optional(),
  SENTRY_ORG: z.string().optional(),
  SENTRY_PROJECT: z.string().optional(),
});

export type ClientEnv = z.infer<typeof clientSchema>;
export type ServerEnv = z.infer<typeof serverSchema>;

function format(error: z.ZodError, scope: string): never {
  const issues = error.issues
    .map((i) => `  ${i.path.join(".") || "(root)"}: ${i.message}`)
    .join("\n");
  throw new Error(
    `Invalid ${scope} environment variables:\n${issues}\n\n` +
      `Set them in .env.local, or set SKIP_ENV_VALIDATION=1 to bypass ` +
      `(intended for Docker builds that supply values at runtime).`,
  );
}

function parseClient(): ClientEnv {
  // Each value written out in full — see rule 1 above.
  const raw = {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    NEXT_PUBLIC_TUS_URL: process.env.NEXT_PUBLIC_TUS_URL,
    NEXT_PUBLIC_ZITADEL_AUTHORITY: process.env.NEXT_PUBLIC_ZITADEL_AUTHORITY,
    NEXT_PUBLIC_ZITADEL_CLIENT_ID: process.env.NEXT_PUBLIC_ZITADEL_CLIENT_ID,
    NEXT_PUBLIC_SENTRY_DSN: process.env.NEXT_PUBLIC_SENTRY_DSN,
    NEXT_PUBLIC_SENTRY_ENVIRONMENT: process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT,
    NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE:
      process.env.NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE,
  };

  // Drop unset keys so zod applies defaults instead of failing on undefined.
  const defined = Object.fromEntries(
    Object.entries(raw).filter(([, v]) => v !== undefined && v !== ""),
  );

  if (SKIP) return { ...clientSchema.parse({}), ...defined } as ClientEnv;

  const parsed = clientSchema.safeParse(defined);
  if (!parsed.success) format(parsed.error, "client");
  return parsed.data;
}

function parseServer(): ServerEnv {
  const raw = {
    API_URL: process.env.API_URL,
    SENTRY_DSN: process.env.SENTRY_DSN,
    SENTRY_ENVIRONMENT: process.env.SENTRY_ENVIRONMENT,
    SENTRY_TRACES_SAMPLE_RATE: process.env.SENTRY_TRACES_SAMPLE_RATE,
    SENTRY_AUTH_TOKEN: process.env.SENTRY_AUTH_TOKEN,
    SENTRY_ORG: process.env.SENTRY_ORG,
    SENTRY_PROJECT: process.env.SENTRY_PROJECT,
  };
  const defined = Object.fromEntries(
    Object.entries(raw).filter(([, v]) => v !== undefined && v !== ""),
  );

  if (SKIP) return { ...serverSchema.parse({}), ...defined } as ServerEnv;

  const parsed = serverSchema.safeParse(defined);
  if (!parsed.success) format(parsed.error, "server");
  return parsed.data;
}

export const clientEnv: ClientEnv = parseClient();

/**
 * Server-only environment. Throws if read from the browser, so a stray import in a
 * client component fails loudly in development instead of silently shipping
 * `undefined`.
 */
export function getServerEnv(): ServerEnv {
  if (typeof window !== "undefined") {
    throw new Error(
      "getServerEnv() was called in the browser. Server-only environment values " +
        "are not available client-side — use clientEnv (NEXT_PUBLIC_*) instead.",
    );
  }
  return parseServer();
}

/** Exported for tests only. */
export const __testing = { clientSchema, serverSchema };
