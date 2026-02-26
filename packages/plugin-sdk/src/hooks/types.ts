export type HookType = "action" | "filter";

export interface HookDefinition<TPayload = unknown> {
  id: string;
  type: HookType;
  description: string;
  /** Phantom field for TypeScript inference only. */
  _payload?: TPayload;
}
