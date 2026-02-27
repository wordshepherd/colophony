import { toPascalCase } from "../utils.js";
import type { AdapterKind } from "../prompts.js";

interface AdapterInput {
  name: string;
  adapterType: AdapterKind;
}

const NOT_IMPLEMENTED_ERROR = `
class NotImplementedError extends Error {
  constructor(method: string) {
    super(\`Not implemented: \${method}\`);
    this.name = "NotImplementedError";
  }
}
`;

const ADAPTER_TEMPLATES: Record<AdapterKind, (pascal: string) => string> = {
  email: (
    pascal,
  ) => `import type { EmailAdapter, SendEmailOptions, SendEmailResult, AdapterHealthResult } from "@colophony/plugin-sdk";
import { z } from "zod";

export const configSchema = z.object({
  // TODO: Define your adapter configuration
  apiKey: z.string().describe("API key for the email service"),
});

export class ${pascal}Adapter implements EmailAdapter {
  readonly id = "${pascal.toLowerCase()}-email";
  readonly name = "${pascal} Email Adapter";
  readonly version = "0.1.0";
  readonly configSchema = configSchema;

  async initialize(config: Record<string, unknown>): Promise<void> {
    const _validated = configSchema.parse(config);
    // TODO: Initialize email client
  }

  async send(options: SendEmailOptions): Promise<SendEmailResult> {
    // TODO: Implement email sending
    throw new NotImplementedError(" send()");
  }

  // Optional: implement sendBulk for batch email sending
  // async sendBulk(recipients: string[], options: Omit<SendEmailOptions, "to">): Promise<SendEmailResult[]> { }

  async healthCheck(): Promise<AdapterHealthResult> {
    return { healthy: true, message: "OK" };
  }

  async destroy(): Promise<void> {
    // TODO: Cleanup resources
  }
}
`,

  payment: (pascal) => `import type {
  PaymentAdapter,
  CheckoutSessionParams,
  CheckoutSessionResult,
  PaymentWebhookEvent,
  WebhookHandleResult,
  RefundResult,
  AdapterHealthResult,
} from "@colophony/plugin-sdk";
import { z } from "zod";

export const configSchema = z.object({
  // TODO: Define your adapter configuration
  secretKey: z.string().describe("Secret key for the payment provider"),
});

export class ${pascal}Adapter implements PaymentAdapter {
  readonly id = "${pascal.toLowerCase()}-payment";
  readonly name = "${pascal} Payment Adapter";
  readonly version = "0.1.0";
  readonly configSchema = configSchema;

  async initialize(config: Record<string, unknown>): Promise<void> {
    const _validated = configSchema.parse(config);
    // TODO: Initialize payment client
  }

  async createCheckoutSession(params: CheckoutSessionParams): Promise<CheckoutSessionResult> {
    // TODO: Implement checkout session creation
    throw new NotImplementedError(" createCheckoutSession()");
  }

  async verifyWebhook(headers: Record<string, string>, body: string): Promise<PaymentWebhookEvent> {
    // TODO: Verify webhook signature and parse event
    throw new NotImplementedError(" verifyWebhook()");
  }

  async handleWebhookEvent(event: PaymentWebhookEvent): Promise<WebhookHandleResult> {
    // TODO: Handle payment events
    throw new NotImplementedError(" handleWebhookEvent()");
  }

  async refund(paymentId: string, amount?: number): Promise<RefundResult> {
    // TODO: Implement refund
    throw new NotImplementedError(" refund()");
  }

  async healthCheck(): Promise<AdapterHealthResult> {
    return { healthy: true, message: "OK" };
  }

  async destroy(): Promise<void> {
    // TODO: Cleanup resources
  }
}
`,

  storage: (
    pascal,
  ) => `import type { StorageAdapter, UploadOptions, UploadResult, AdapterHealthResult } from "@colophony/plugin-sdk";
import type { Readable } from "node:stream";
import { z } from "zod";

export const configSchema = z.object({
  // TODO: Define your adapter configuration
  bucket: z.string().describe("Storage bucket name"),
});

export class ${pascal}Adapter implements StorageAdapter {
  readonly id = "${pascal.toLowerCase()}-storage";
  readonly name = "${pascal} Storage Adapter";
  readonly version = "0.1.0";
  readonly configSchema = configSchema;

  async initialize(config: Record<string, unknown>): Promise<void> {
    const _validated = configSchema.parse(config);
    // TODO: Initialize storage client
  }

  async upload(options: UploadOptions): Promise<UploadResult> {
    // TODO: Implement file upload
    throw new NotImplementedError(" upload()");
  }

  async download(key: string): Promise<Readable> {
    // TODO: Implement file download
    throw new NotImplementedError(" download()");
  }

  async delete(key: string): Promise<void> {
    // TODO: Implement file deletion
    throw new NotImplementedError(" delete()");
  }

  async exists(key: string): Promise<boolean> {
    // TODO: Implement existence check
    throw new NotImplementedError(" exists()");
  }

  async getSignedUrl(key: string, expiresInSeconds?: number): Promise<string> {
    // TODO: Implement signed URL generation
    throw new NotImplementedError(" getSignedUrl()");
  }

  async move(sourceKey: string, destinationKey: string): Promise<void> {
    // TODO: Implement file move
    throw new NotImplementedError(" move()");
  }

  async healthCheck(): Promise<AdapterHealthResult> {
    return { healthy: true, message: "OK" };
  }

  async destroy(): Promise<void> {
    // TODO: Cleanup resources
  }
}
`,

  search: (pascal) => `import type {
  SearchAdapter,
  SearchDocument,
  SearchQuery,
  SearchResult,
  AdapterHealthResult,
} from "@colophony/plugin-sdk";
import { z } from "zod";

export const configSchema = z.object({
  // TODO: Define your adapter configuration
  endpoint: z.string().describe("Search service endpoint URL"),
});

export class ${pascal}Adapter implements SearchAdapter {
  readonly id = "${pascal.toLowerCase()}-search";
  readonly name = "${pascal} Search Adapter";
  readonly version = "0.1.0";
  readonly configSchema = configSchema;

  async initialize(config: Record<string, unknown>): Promise<void> {
    const _validated = configSchema.parse(config);
    // TODO: Initialize search client
  }

  async index(document: SearchDocument): Promise<void> {
    // TODO: Implement document indexing
    throw new NotImplementedError(" index()");
  }

  async indexBulk(documents: SearchDocument[]): Promise<void> {
    // TODO: Implement bulk indexing
    throw new NotImplementedError(" indexBulk()");
  }

  async search(query: SearchQuery): Promise<SearchResult> {
    // TODO: Implement search
    throw new NotImplementedError(" search()");
  }

  async remove(documentId: string, index: string): Promise<void> {
    // TODO: Implement document removal
    throw new NotImplementedError(" remove()");
  }

  async healthCheck(): Promise<AdapterHealthResult> {
    return { healthy: true, message: "OK" };
  }

  async destroy(): Promise<void> {
    // TODO: Cleanup resources
  }
}
`,
};

export function generateAdapterClass(input: AdapterInput): string {
  const pascal = toPascalCase(input.name);
  const template = ADAPTER_TEMPLATES[input.adapterType];
  const code = template(pascal);
  // Inject NotImplementedError after the last import line
  const lastImportIdx = code.lastIndexOf("import ");
  const insertIdx = code.indexOf("\n", lastImportIdx) + 1;
  return (
    code.slice(0, insertIdx) + NOT_IMPLEMENTED_ERROR + code.slice(insertIdx)
  );
}
