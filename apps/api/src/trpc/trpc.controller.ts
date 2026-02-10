import { Controller, All, Req, Res, Next } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import * as trpcExpress from '@trpc/server/adapters/express';
import { appRouter } from './trpc.router';
import { createContext } from './trpc.context';

/**
 * Create the tRPC Express middleware
 */
const trpcMiddleware = trpcExpress.createExpressMiddleware({
  router: appRouter,
  createContext: ({ req }) => createContext(req),
  onError({ error, path }) {
    console.error(`tRPC Error on ${path}:`, error);
  },
});

/**
 * tRPC Controller
 *
 * Handles all tRPC requests via the /trpc/* route.
 * Uses the Express adapter for native compatibility.
 */
@Controller('trpc')
export class TrpcController {
  @All('*')
  async trpc(
    @Req() req: Request,
    @Res() res: Response,
    @Next() next: NextFunction,
  ) {
    // Strip everything up to and including /trpc so the tRPC middleware
    // sees only the procedure path (e.g., /auth.register).
    // NestJS controllers don't strip the controller prefix from req.url
    // like Express sub-router mounting (app.use('/trpc', handler)) would.
    const originalUrl = req.url;
    req.url = req.url.replace(/^.*?\/trpc/, '') || '/';
    trpcMiddleware(req, res, () => {
      req.url = originalUrl;
      next();
    });
  }
}
