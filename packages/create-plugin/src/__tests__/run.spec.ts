import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { buildFileMap, scaffoldProject } from "../write.js";
import type { IntegrationAnswers, AdapterAnswers } from "../prompts.js";

const integrationAnswers: IntegrationAnswers = {
  name: "test-plugin",
  description: "A test plugin",
  author: "Test",
  license: "MIT",
  category: "integration",
  pluginType: "integration",
};

const adapterAnswers: AdapterAnswers = {
  name: "test-email",
  description: "A test email adapter",
  author: "Test",
  license: "MIT",
  category: "adapter",
  pluginType: "adapter",
  adapterType: "email",
};

describe("run integration", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "create-plugin-test-"));
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it("creates the output directory", async () => {
    const input = buildFileMap(integrationAnswers, { cwd: tmpDir });
    await scaffoldProject(input);

    const stat = await fs.stat(input.outputDir);
    expect(stat.isDirectory()).toBe(true);
  });

  it("generates all required files for integration type", async () => {
    const input = buildFileMap(integrationAnswers, { cwd: tmpDir });
    await scaffoldProject(input);

    const files = await fs.readdir(input.outputDir, { recursive: true });
    expect(files).toContain("package.json");
    expect(files).toContain("tsconfig.json");
    expect(files).toContain("README.md");
    expect(files).toContain(".gitignore");
    expect(files).toContain("LICENSE");
  });

  it("generates package.json with correct name", async () => {
    const input = buildFileMap(integrationAnswers, { cwd: tmpDir });
    await scaffoldProject(input);

    const pkgJson = JSON.parse(
      await fs.readFile(path.join(input.outputDir, "package.json"), "utf-8"),
    );
    expect(pkgJson.name).toBe("colophony-plugin-test-plugin");
  });

  it("generates adapter file for adapter type", async () => {
    const input = buildFileMap(adapterAnswers, { cwd: tmpDir });
    await scaffoldProject(input);

    const adapterPath = path.join(
      input.outputDir,
      "src",
      "adapters",
      "email.adapter.ts",
    );
    const content = await fs.readFile(adapterPath, "utf-8");
    expect(content).toContain("implements EmailAdapter");
  });

  it("does NOT generate adapter file for integration type", async () => {
    const input = buildFileMap(integrationAnswers, { cwd: tmpDir });
    await scaffoldProject(input);

    const adaptersDir = path.join(input.outputDir, "src", "adapters");
    const exists = await fs
      .access(adaptersDir)
      .then(() => true)
      .catch(() => false);
    expect(exists).toBe(false);
  });

  it("throws if directory already exists", async () => {
    const input = buildFileMap(integrationAnswers, { cwd: tmpDir });
    await fs.mkdir(input.outputDir, { recursive: true });

    await expect(scaffoldProject(input)).rejects.toThrow(
      "Directory already exists",
    );
  });
});
