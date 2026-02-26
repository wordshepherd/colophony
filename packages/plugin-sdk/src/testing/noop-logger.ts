import type { Logger } from "../logger.js";

export function createNoopLogger(): Logger {
  const noop = () => {};
  const logger: Logger = {
    info: noop,
    warn: noop,
    error: noop,
    debug: noop,
    child: () => logger,
  };
  return logger;
}
