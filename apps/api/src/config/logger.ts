import type { FastifyBaseLogger } from 'fastify';

/**
 * Shared logger reference for BullMQ workers and other non-request code.
 *
 * Initialized from `main.ts` after the Fastify instance is created.
 * Workers call `getLogger()` instead of `console.error()`.
 */
let _logger: FastifyBaseLogger | null = null;

export function setWorkerLogger(logger: FastifyBaseLogger): void {
  _logger = logger;
}

export function getLogger(): FastifyBaseLogger {
  if (!_logger) {
    throw new Error(
      'Worker logger not initialized — call setWorkerLogger() from main.ts first',
    );
  }
  return _logger;
}
