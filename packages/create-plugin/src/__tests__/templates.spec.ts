import { describe, it, expect } from "vitest";
import { generatePackageJson } from "../templates/package-json.js";
import { generateTsConfig } from "../templates/tsconfig.js";
import { generatePluginClass } from "../templates/plugin-class.js";
import { generateAdapterClass } from "../templates/adapter-class.js";
import { generateTestFile } from "../templates/test-file.js";
import { generateReadme } from "../templates/readme.js";
import type {
  IntegrationAnswers,
  AdapterAnswers,
  FullAnswers,
} from "../prompts.js";

const integrationAnswers: IntegrationAnswers = {
  name: "my-notifier",
  description: "A notification plugin",
  author: "Test Author",
  license: "MIT",
  category: "notification",
  pluginType: "integration",
};

const adapterAnswers: AdapterAnswers = {
  name: "custom-email",
  description: "A custom email adapter",
  author: "Test Author",
  license: "MIT",
  category: "adapter",
  pluginType: "adapter",
  adapterType: "email",
};

const fullAnswers: FullAnswers = {
  name: "full-plugin",
  description: "A full plugin",
  author: "Test Author",
  license: "MIT",
  category: "integration",
  pluginType: "full",
  adapterType: "storage",
};

describe("generatePackageJson", () => {
  it("generates correct package name", () => {
    const result = JSON.parse(generatePackageJson(integrationAnswers));
    expect(result.name).toBe("colophony-plugin-my-notifier");
  });

  it("includes plugin-sdk dependency", () => {
    const result = JSON.parse(generatePackageJson(integrationAnswers));
    expect(result.dependencies["@colophony/plugin-sdk"]).toBeDefined();
  });

  it("is not private", () => {
    const result = JSON.parse(generatePackageJson(integrationAnswers));
    expect(result.private).toBeUndefined();
  });

  it("uses ESM type module", () => {
    const result = JSON.parse(generatePackageJson(integrationAnswers));
    expect(result.type).toBe("module");
  });
});

describe("generateTsConfig", () => {
  it("enables strict mode", () => {
    const result = JSON.parse(generateTsConfig());
    expect(result.compilerOptions.strict).toBe(true);
  });

  it("uses NodeNext module", () => {
    const result = JSON.parse(generateTsConfig());
    expect(result.compilerOptions.module).toBe("NodeNext");
  });

  it("does not extend shared config", () => {
    const result = JSON.parse(generateTsConfig());
    expect(result.extends).toBeUndefined();
  });

  it("enables declaration output", () => {
    const result = JSON.parse(generateTsConfig());
    expect(result.compilerOptions.declaration).toBe(true);
  });
});

describe("generatePluginClass", () => {
  it("generates integration class with register method", () => {
    const result = generatePluginClass(integrationAnswers);
    expect(result).toContain("class MyNotifierPlugin extends ColophonyPlugin");
    expect(result).toContain("async register(context");
  });

  it("includes adapter import for adapter type", () => {
    const result = generatePluginClass(adapterAnswers);
    expect(result).toContain("import { CustomEmailAdapter }");
    expect(result).toContain('registerAdapter("email"');
  });

  it("generates full plugin with adapter and hook stubs", () => {
    const result = generatePluginClass(fullAnswers);
    expect(result).toContain("import { FullPluginAdapter }");
    expect(result).toContain('registerAdapter("storage"');
    expect(result).toContain("TODO: Register hooks");
  });

  it("includes correct manifest category", () => {
    const result = generatePluginClass(integrationAnswers);
    expect(result).toContain('category: "notification"');
  });
});

describe("generateAdapterClass", () => {
  it("generates email adapter with send method", () => {
    const result = generateAdapterClass({
      name: "my-mailer",
      adapterType: "email",
    });
    expect(result).toContain("implements EmailAdapter");
    expect(result).toContain("async send(");
    expect(result).toContain("configSchema");
  });

  it("generates payment adapter with required methods", () => {
    const result = generateAdapterClass({
      name: "pay",
      adapterType: "payment",
    });
    expect(result).toContain("implements PaymentAdapter");
    expect(result).toContain("createCheckoutSession");
    expect(result).toContain("verifyWebhook");
    expect(result).toContain("refund");
  });

  it("generates storage adapter with required methods", () => {
    const result = generateAdapterClass({
      name: "store",
      adapterType: "storage",
    });
    expect(result).toContain("implements StorageAdapter");
    expect(result).toContain("upload");
    expect(result).toContain("download");
    expect(result).toContain("getSignedUrl");
    expect(result).toContain("move");
  });

  it("generates search adapter with required methods", () => {
    const result = generateAdapterClass({
      name: "finder",
      adapterType: "search",
    });
    expect(result).toContain("implements SearchAdapter");
    expect(result).toContain("index(");
    expect(result).toContain("indexBulk");
    expect(result).toContain("search(");
    expect(result).toContain("remove(");
  });
});

describe("generateTestFile", () => {
  it("uses createTestHarness for integration type", () => {
    const result = generateTestFile(integrationAnswers);
    expect(result).toContain("createTestHarness");
    expect(result).not.toContain("createMockRegisterContext");
  });

  it("uses createMockRegisterContext for adapter type", () => {
    const result = generateTestFile(adapterAnswers);
    expect(result).toContain("createMockRegisterContext");
    expect(result).not.toContain("createTestHarness");
  });
});

describe("generateReadme", () => {
  it("includes plugin name as heading", () => {
    const result = generateReadme(integrationAnswers);
    expect(result).toContain("# my-notifier");
  });

  it("includes installation section", () => {
    const result = generateReadme(integrationAnswers);
    expect(result).toContain("## Installation");
    expect(result).toContain("npm install colophony-plugin-my-notifier");
  });
});
