import { initTRPC, type AnyRouter } from '@trpc/server';

const t = initTRPC.create();

// Namespace stubs matching v1 router shape.
// Actual procedures added incrementally as services are ported.
export const appRouter: AnyRouter = t.router({
  health: t.procedure.query(() => ({ status: 'ok' as const })),
  auth: t.router({}),
  submissions: t.router({}),
  files: t.router({}),
  payments: t.router({}),
  gdpr: t.router({}),
  consent: t.router({}),
  audit: t.router({}),
  retention: t.router({}),
});

// Stub type — refined with concrete procedure types as services are ported.
// Using AnyRouter avoids TS2742 (non-portable inferred type) under NodeNext.
export type AppRouter = AnyRouter;
