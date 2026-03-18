import fs from "node:fs";
import { defineConfig } from "drizzle-kit";
import type { PoolConfig } from "pg";

function buildSslConfig(): PoolConfig["ssl"] {
  const mode = process.env.DB_SSL ?? "false";
  if (mode === "false") return undefined;
  if (mode === "no-verify") return { rejectUnauthorized: false };
  const caPath = process.env.DB_SSL_CA_PATH;
  return {
    rejectUnauthorized: true,
    ...(caPath ? { ca: fs.readFileSync(caPath, "utf8") } : {}),
  };
}

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/schema/*",
  out: "./migrations",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
    ssl: buildSslConfig(),
  },
  verbose: true,
  strict: true,
});
