import { initTRPC } from "@trpc/server";

const t = initTRPC.create();

// Namespace stubs matching v1 router shape.
// Actual procedures added incrementally as services are ported.
export const appRouter = t.router({
  health: t.procedure.query(() => ({ status: "ok" as const })),
  auth: t.router({}),
  submissions: t.router({}),
  files: t.router({}),
  payments: t.router({}),
  gdpr: t.router({}),
  consent: t.router({}),
  audit: t.router({}),
  retention: t.router({}),
});

export type AppRouter = typeof appRouter;
