import type { Readable } from "node:stream";

import type { BaseAdapter } from "./common.js";

export interface UploadOptions {
  key: string;
  body: Buffer | Readable;
  contentType?: string;
  metadata?: Record<string, string>;
}

export interface UploadResult {
  key: string;
  size: number;
  etag?: string;
}

export interface StorageAdapter extends BaseAdapter {
  upload(options: UploadOptions): Promise<UploadResult>;
  download(key: string): Promise<Readable>;
  delete(key: string): Promise<void>;
  exists(key: string): Promise<boolean>;
  getSignedUrl(key: string, expiresInSeconds?: number): Promise<string>;
  move(sourceKey: string, destinationKey: string): Promise<void>;
}
