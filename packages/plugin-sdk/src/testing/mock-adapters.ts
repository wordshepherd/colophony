import type { Readable } from "node:stream";

import { z } from "zod";

import type { AdapterHealthResult } from "../adapters/common.js";
import type {
  EmailAdapter,
  SendEmailOptions,
  SendEmailResult,
} from "../adapters/email.js";
import type {
  CheckoutSessionParams,
  CheckoutSessionResult,
  PaymentAdapter,
  PaymentWebhookEvent,
  RefundResult,
  WebhookHandleResult,
} from "../adapters/payment.js";
import type {
  SearchAdapter,
  SearchDocument,
  SearchQuery,
  SearchResult,
} from "../adapters/search.js";
import type {
  StorageAdapter,
  UploadOptions,
  UploadResult,
} from "../adapters/storage.js";

// ── Mock Email ──

export class MockEmailAdapter implements EmailAdapter {
  readonly id = "mock-email";
  readonly name = "Mock Email";
  readonly version = "0.0.0";
  readonly configSchema = z.object({}).passthrough();

  sentEmails: SendEmailOptions[] = [];

  async initialize(): Promise<void> {}
  async healthCheck(): Promise<AdapterHealthResult> {
    return { healthy: true, message: "Mock email OK" };
  }
  async destroy(): Promise<void> {}

  async send(options: SendEmailOptions): Promise<SendEmailResult> {
    this.sentEmails.push(options);
    return { success: true, messageId: `mock-${Date.now()}` };
  }

  getLastEmail(): SendEmailOptions | undefined {
    return this.sentEmails[this.sentEmails.length - 1];
  }

  reset(): void {
    this.sentEmails = [];
  }
}

// ── Mock Payment ──

export class MockPaymentAdapter implements PaymentAdapter {
  readonly id = "mock-payment";
  readonly name = "Mock Payment";
  readonly version = "0.0.0";
  readonly configSchema = z.object({}).passthrough();

  sessions: CheckoutSessionParams[] = [];
  refunds: Array<{ paymentId: string; amount?: number }> = [];

  async initialize(): Promise<void> {}
  async healthCheck(): Promise<AdapterHealthResult> {
    return { healthy: true, message: "Mock payment OK" };
  }
  async destroy(): Promise<void> {}

  async createCheckoutSession(
    params: CheckoutSessionParams,
  ): Promise<CheckoutSessionResult> {
    this.sessions.push(params);
    return {
      sessionId: `sess-${Date.now()}`,
      url: "https://mock.pay/checkout",
    };
  }

  async verifyWebhook(
    _headers: Record<string, string>,
    _body: string,
  ): Promise<PaymentWebhookEvent> {
    return { id: "evt-mock", type: "payment.completed", data: {} };
  }

  async handleWebhookEvent(
    _event: PaymentWebhookEvent,
  ): Promise<WebhookHandleResult> {
    return { handled: true };
  }

  async refund(paymentId: string, amount?: number): Promise<RefundResult> {
    this.refunds.push({ paymentId, amount });
    return {
      refundId: `ref-${Date.now()}`,
      status: "succeeded",
      amount: amount ?? 0,
    };
  }

  reset(): void {
    this.sessions = [];
    this.refunds = [];
  }
}

// ── Mock Storage ──

export class MockStorageAdapter implements StorageAdapter {
  readonly id = "mock-storage";
  readonly name = "Mock Storage";
  readonly version = "0.0.0";
  readonly configSchema = z.object({}).passthrough();

  files = new Map<string, Buffer>();

  async initialize(): Promise<void> {}
  async healthCheck(): Promise<AdapterHealthResult> {
    return { healthy: true, message: "Mock storage OK" };
  }
  async destroy(): Promise<void> {}

  async upload(options: UploadOptions): Promise<UploadResult> {
    const buf =
      options.body instanceof Buffer
        ? options.body
        : await streamToBuffer(options.body as Readable);
    this.files.set(options.key, buf);
    return { key: options.key, size: buf.length };
  }

  async download(key: string): Promise<Readable> {
    const buf = this.files.get(key);
    if (!buf) throw new Error(`Key not found: ${key}`);
    const { Readable: ReadableStream } = await import("node:stream");
    return ReadableStream.from(buf);
  }

  async delete(key: string): Promise<void> {
    this.files.delete(key);
  }

  async exists(key: string): Promise<boolean> {
    return this.files.has(key);
  }

  async getSignedUrl(key: string): Promise<string> {
    return `https://mock.storage/${key}?signed=true`;
  }

  async move(sourceKey: string, destinationKey: string): Promise<void> {
    const buf = this.files.get(sourceKey);
    if (!buf) throw new Error(`Key not found: ${sourceKey}`);
    this.files.set(destinationKey, buf);
    this.files.delete(sourceKey);
  }

  reset(): void {
    this.files.clear();
  }
}

// ── Mock Search ──

export class MockSearchAdapter implements SearchAdapter {
  readonly id = "mock-search";
  readonly name = "Mock Search";
  readonly version = "0.0.0";
  readonly configSchema = z.object({}).passthrough();

  documents = new Map<string, SearchDocument>();

  async initialize(): Promise<void> {}
  async healthCheck(): Promise<AdapterHealthResult> {
    return { healthy: true, message: "Mock search OK" };
  }
  async destroy(): Promise<void> {}

  async index(document: SearchDocument): Promise<void> {
    this.documents.set(`${document.index}:${document.id}`, document);
  }

  async indexBulk(documents: SearchDocument[]): Promise<void> {
    for (const doc of documents) {
      await this.index(doc);
    }
  }

  async search(query: SearchQuery): Promise<SearchResult> {
    const start = Date.now();
    const hits = [...this.documents.values()]
      .filter((doc) => {
        if (doc.index !== query.index) return false;
        const text = JSON.stringify(doc.fields).toLowerCase();
        return text.includes(query.query.toLowerCase());
      })
      .map((doc) => ({
        id: doc.id,
        score: 1,
        fields: doc.fields,
      }));

    return {
      hits: hits.slice(
        query.offset ?? 0,
        (query.offset ?? 0) + (query.limit ?? 10),
      ),
      total: hits.length,
      took: Date.now() - start,
    };
  }

  async remove(documentId: string, index: string): Promise<void> {
    this.documents.delete(`${index}:${documentId}`);
  }

  reset(): void {
    this.documents.clear();
  }
}

// ── Helpers ──

async function streamToBuffer(stream: Readable): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(
      Buffer.isBuffer(chunk)
        ? chunk
        : Buffer.from(
            typeof chunk === "string" ? chunk : (chunk as Uint8Array),
          ),
    );
  }
  return Buffer.concat(chunks);
}
