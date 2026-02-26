import type { z } from "zod";

export interface AdapterHealthResult {
  healthy: boolean;
  message: string;
  latencyMs?: number;
}

export type AdapterType =
  | "email"
  | "payment"
  | "storage"
  | "search"
  | "auth"
  | "newsletter";

export interface AdapterInfo {
  id: string;
  name: string;
  version: string;
  type: AdapterType;
  active: boolean;
}

export interface BaseAdapter {
  readonly id: string;
  readonly name: string;
  readonly version: string;
  readonly configSchema: z.ZodType<Record<string, unknown>>;
  initialize(config: Record<string, unknown>): Promise<void>;
  healthCheck(): Promise<AdapterHealthResult>;
  destroy(): Promise<void>;
}
