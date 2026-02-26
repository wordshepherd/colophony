// Adapters
export type {
  AdapterHealthResult,
  AdapterInfo,
  AdapterType,
  BaseAdapter,
  CheckoutSessionParams,
  CheckoutSessionResult,
  EmailAdapter,
  EmailAttachment,
  PaymentAdapter,
  PaymentWebhookEvent,
  RefundResult,
  SearchAdapter,
  SearchDocument,
  SearchHit,
  SearchQuery,
  SearchResult,
  SendEmailOptions,
  SendEmailResult,
  StorageAdapter,
  UploadOptions,
  UploadResult,
  WebhookHandleResult,
} from "./adapters/index.js";

// Registry
export { AdapterRegistry } from "./registry.js";

// Hooks
export { HOOKS, type HookId } from "./hooks/definitions.js";
export { HookEngine, type HookHandlerOptions } from "./hooks/engine.js";
export type {
  EmailBeforeSendPayload,
  HookPayloadMap,
  IssuePublishedPayload,
  MemberJoinedPayload,
  PaymentCompletedPayload,
  PipelineCompletedPayload,
  PipelineStageChangedPayload,
  ReviewAssignedPayload,
  ReviewCompletedPayload,
  SubmissionAssignedPayload,
  SubmissionCreatedPayload,
  SubmissionExportPayload,
  SubmissionStatusChangedPayload,
  SubmissionSubmittedPayload,
  SubmissionValidationPayload,
} from "./hooks/payloads.js";
export type { HookDefinition, HookType } from "./hooks/types.js";

// Plugin
export {
  pluginManifestSchema,
  type PluginCategory,
  type PluginManifest,
  type PluginPermission,
} from "./plugin.js";
export {
  ColophonyPlugin,
  type AuditFn,
  type PluginBootstrapContext,
  type PluginRegisterContext,
} from "./plugin-base.js";

// UI
export type {
  UIContributionPoint,
  UIExtensionDeclaration,
} from "./ui/types.js";

// Config
export {
  defineConfig,
  loadConfig,
  type AdapterConstructor,
  type ColophonyConfig,
  type LoadConfigOptions,
  type LoadConfigResult,
} from "./config.js";

// Errors
export {
  AdapterInitializationError,
  AdapterNotFoundError,
  ConfigValidationError,
  HookExecutionError,
  PluginSdkError,
  type PluginSdkErrorCode,
} from "./errors.js";

// Logger
export type { Logger } from "./logger.js";

// Version
export { MIN_COLOPHONY_VERSION, SDK_VERSION } from "./version.js";
