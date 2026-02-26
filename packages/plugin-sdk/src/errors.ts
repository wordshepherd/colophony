export type PluginSdkErrorCode =
  | "ADAPTER_NOT_FOUND"
  | "ADAPTER_INIT_FAILED"
  | "CONFIG_VALIDATION_FAILED"
  | "HOOK_EXECUTION_FAILED";

export class PluginSdkError extends Error {
  readonly code: PluginSdkErrorCode;

  constructor(message: string, code: PluginSdkErrorCode) {
    super(message);
    this.name = "PluginSdkError";
    this.code = code;
  }
}

export class AdapterNotFoundError extends PluginSdkError {
  constructor(type: string) {
    super(`No adapter registered for type "${type}"`, "ADAPTER_NOT_FOUND");
    this.name = "AdapterNotFoundError";
  }
}

export class AdapterInitializationError extends PluginSdkError {
  readonly cause: unknown;

  constructor(adapterId: string, cause: unknown) {
    const msg = cause instanceof Error ? cause.message : String(cause);
    super(
      `Failed to initialize adapter "${adapterId}": ${msg}`,
      "ADAPTER_INIT_FAILED",
    );
    this.name = "AdapterInitializationError";
    this.cause = cause;
  }
}

export class ConfigValidationError extends PluginSdkError {
  constructor(message: string) {
    super(message, "CONFIG_VALIDATION_FAILED");
    this.name = "ConfigValidationError";
  }
}

export class HookExecutionError extends PluginSdkError {
  readonly cause: unknown;

  constructor(hookId: string, cause: unknown) {
    const msg = cause instanceof Error ? cause.message : String(cause);
    super(`Hook "${hookId}" execution failed: ${msg}`, "HOOK_EXECUTION_FAILED");
    this.name = "HookExecutionError";
    this.cause = cause;
  }
}
