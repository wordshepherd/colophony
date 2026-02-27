import type { FastifyBaseLogger } from 'fastify';

/**
 * Shared logger reference for BullMQ workers and other non-request code.
 *
 * Initialized from `main.ts` after the Fastify instance is created.
 * Falls back to console-based logging if called before initialization
 * (e.g., during tests or unusual startup sequences).
 */
let _logger: FastifyBaseLogger | null = null;

const _fallback = {
  fatal: console.error.bind(console),
  error: console.error.bind(console),
  warn: console.warn.bind(console),
  info: console.info.bind(console),
  debug: console.debug.bind(console),
  trace: console.debug.bind(console),
  silent: () => {},
  child: () => _fallback,
  level: 'info',
} as unknown as FastifyBaseLogger;

export function setWorkerLogger(logger: FastifyBaseLogger): void {
  _logger = logger;
}

export function getLogger(): FastifyBaseLogger {
  return _logger ?? _fallback;
}
