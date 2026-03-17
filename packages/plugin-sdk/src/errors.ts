export class AdapterNotFoundError extends Error {
  constructor(type: string) {
    super(`No adapter registered for type "${type}"`);
    this.name = "AdapterNotFoundError";
  }
}

export class AdapterInitializationError extends Error {
  readonly cause: unknown;

  constructor(adapterId: string, cause: unknown) {
    const msg = cause instanceof Error ? cause.message : String(cause);
    super(`Failed to initialize adapter "${adapterId}": ${msg}`);
    this.name = "AdapterInitializationError";
    this.cause = cause;
  }
}
